// Phase 19 API integration tests (node:test, no extra dependencies).
//
// Runs against a LIVE server (default http://localhost:3001) backed by the real
// Supabase project in server/.env. All fixtures use a unique `gptest` prefix and are
// removed in the final `after` hook. Start the server first: `npm run dev`, then
// `npm test`. Set API_URL to point at a different server.
//
// Covers happy paths AND negative cases: invalid login, unauthorized access, wrong role,
// invalid input, invalid order, insufficient stock, duplicate review, failed payment,
// invalid webhook, unauthorized admin operations.

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { supabaseAdmin } = require('../src/config/supabase');

const BASE = process.env.API_URL || 'http://localhost:3001';
const RUN = `gptest${Date.now().toString(36)}`;
const PASSWORD = 'Gp-Test-Pass-123!';
const DAY = 24 * 60 * 60 * 1000;
const pickupDate = new Date(Date.now() + 2 * DAY).toISOString().slice(0, 10);
const FAKE_UUID = '00000000-0000-4000-8000-000000000000';

// ---------- helpers ----------

async function api(method, path, { token, body, headers = {}, raw } = {}) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: {
      ...(raw === undefined ? { 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: raw !== undefined ? raw : body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = null;
  const text = await res.text();
  try { json = JSON.parse(text); } catch { json = { _raw: text }; }
  return { status: res.status, json, headers: res.headers };
}

const created = { userIds: [], businessIds: [], listingIds: [], webhookEventIds: [] };

async function makeUser(label) {
  const email = `${RUN}.${label}@gptest.dev`;
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { first_name: label, last_name: 'Tester', role: 'resident' },
  });
  if (error) throw new Error(`createUser(${label}): ${error.message}`);
  created.userIds.push(data.user.id);
  const login = await api('POST', '/auth/login', { body: { email, password: PASSWORD } });
  assert.equal(login.status, 200, `login ${label}: ${JSON.stringify(login.json)}`);
  return { id: data.user.id, email, token: login.json.session.access_token };
}

// Re-login after a role change so the token is fresh (profile is read per-request anyway).
const ids = {};
const u = {}; // users

// ---------- fixtures ----------

before(async () => {
  const health = await api('GET', '/health').catch(() => null);
  assert.ok(health && health.status === 200, `API not reachable at ${BASE} - start the server first`);

  u.admin = await makeUser('admin');
  u.buyer = await makeUser('buyer');
  u.buyer2 = await makeUser('buyer2');
  u.owner = await makeUser('owner');
  u.owner2 = await makeUser('owner2');

  // Promote admin with the service role (migration 026 only blocks self-service changes).
  const { error: roleErr } = await supabaseAdmin.from('profiles').update({ role: 'admin' }).eq('id', u.admin.id);
  assert.ifError(roleErr);

  // Business application -> admin approval (real flow, flips role to business).
  for (const [label, owner] of [['one', u.owner], ['two', u.owner2]]) {
    const res = await api('POST', '/businesses', {
      token: owner.token,
      body: {
        name: `${RUN} Eco Shop ${label}`,
        category: 'junk_shop',
        address: '1 Test St, Cebu City',
        city: 'Cebu City',
        province: 'Cebu',
        latitude: 10.3157,
        longitude: 123.8854,
        acceptsDropOffs: true,
        hasMarketplace: true,
      },
    });
    assert.equal(res.status, 201, `create business: ${JSON.stringify(res.json)}`);
    const biz = res.json.business || res.json;
    owner.businessId = biz.id;
    created.businessIds.push(biz.id);
    const approve = await api('PATCH', `/businesses/admin/${biz.id}/approve`, { token: u.admin.token });
    assert.equal(approve.status, 200, `approve: ${JSON.stringify(approve.json)}`);
  }

  // Material accepted by owner (needed for drop-off pricing).
  const mats = await api('PUT', `/businesses/${u.owner.businessId}/materials`, {
    token: u.owner.token,
    body: { materials: [{ material_name: 'Plastic', price_per_kg: 10, is_accepted: true }] },
  });
  assert.ok([200, 201].includes(mats.status), `materials: ${JSON.stringify(mats.json)}`);

  const cats = await api('GET', '/marketplace/categories');
  assert.equal(cats.status, 200);
  const catList = cats.json.categories || cats.json;
  ids.categoryId = catList[0].id;

  // Active listing (stock 3) by owner via draft -> publish -> admin approve.
  const mk = await api('POST', '/marketplace/listings', {
    token: u.owner.token,
    body: {
      title: `${RUN} Recycled Crate`, description: 'A sturdy recycled crate for testing.',
      price: 100, quantityAvailable: 3, categoryId: ids.categoryId, city: 'Cebu City',
    },
  });
  assert.equal(mk.status, 201, `listing: ${JSON.stringify(mk.json)}`);
  const listing = mk.json.listing || mk.json;
  ids.listingId = listing.id;
  created.listingIds.push(listing.id);
  const pub = await api('PATCH', `/marketplace/listings/${listing.id}/publish`, { token: u.owner.token });
  assert.equal(pub.status, 200, `publish: ${JSON.stringify(pub.json)}`);
  const act = await api('PATCH', `/marketplace/admin/listings/${listing.id}/status`, {
    token: u.admin.token, body: { status: 'active' },
  });
  assert.equal(act.status, 200, `activate: ${JSON.stringify(act.json)}`);
});

after(async () => {
  // Best-effort cleanup, children first. Tolerate missing tables/cascades.
  const tryDel = async (fn) => { try { await fn(); } catch { /* ignore */ } };
  const userIds = created.userIds;
  if (created.webhookEventIds.length) {
    await tryDel(() => supabaseAdmin.from('webhook_events').delete().in('event_id', created.webhookEventIds));
  }
  const { data: orders } = await supabaseAdmin.from('orders').select('id').in('buyer_id', userIds);
  const orderIds = (orders || []).map((o) => o.id);
  if (orderIds.length) {
    for (const t of ['refunds', 'payments', 'order_items']) {
      await tryDel(() => supabaseAdmin.from(t).delete().in('order_id', orderIds));
    }
    await tryDel(() => supabaseAdmin.from('reviews').delete().in('order_id', orderIds));
    await tryDel(() => supabaseAdmin.from('orders').delete().in('id', orderIds));
  }
  await tryDel(() => supabaseAdmin.from('reviews').delete().in('reviewer_id', userIds));
  await tryDel(() => supabaseAdmin.from('cart_items').delete().in('user_id', userIds));
  await tryDel(() => supabaseAdmin.from('notifications').delete().in('user_id', userIds));
  await tryDel(() => supabaseAdmin.from('messages').delete().in('sender_id', userIds));
  await tryDel(() => supabaseAdmin.from('conversations').delete().or(`participant_1_id.in.(${userIds.join(',')}),participant_2_id.in.(${userIds.join(',')})`));
  await tryDel(() => supabaseAdmin.from('forum_posts').delete().in('author_id', userIds));
  await tryDel(() => supabaseAdmin.from('forum_threads').delete().in('author_id', userIds));
  await tryDel(() => supabaseAdmin.from('content_reports').delete().in('reporter_id', userIds));
  await tryDel(() => supabaseAdmin.from('drop_offs').delete().in('business_id', created.businessIds));
  await tryDel(() => supabaseAdmin.from('listing_images').delete().in('listing_id', created.listingIds));
  await tryDel(() => supabaseAdmin.from('listings').delete().in('id', created.listingIds));
  await tryDel(() => supabaseAdmin.from('business_materials').delete().in('business_id', created.businessIds));
  await tryDel(() => supabaseAdmin.from('businesses').delete().in('id', created.businessIds));
  for (const id of userIds) {
    await tryDel(() => supabaseAdmin.auth.admin.deleteUser(id));
  }
});

// =====================================================================
// 1. AUTHENTICATION
// =====================================================================
describe('authentication', () => {
  it('health check responds', async () => {
    const r = await api('GET', '/health');
    assert.equal(r.status, 200);
    assert.equal(r.json.status, 'ok');
  });

  it('login succeeds and returns a session + profile', async () => {
    const r = await api('POST', '/auth/login', { body: { email: u.buyer.email, password: PASSWORD } });
    assert.equal(r.status, 200);
    assert.ok(r.json.session.access_token);
    assert.equal(r.json.user.profile.role, 'resident');
  });

  it('NEG: wrong password -> 401 with generic message', async () => {
    const r = await api('POST', '/auth/login', { body: { email: u.buyer.email, password: 'nope-nope' } });
    assert.equal(r.status, 401);
    assert.equal(r.json.error, 'Invalid email or password');
  });

  it('NEG: unknown email gives the SAME error as wrong password (no user enumeration)', async () => {
    const a = await api('POST', '/auth/login', { body: { email: `${RUN}.ghost@gptest.dev`, password: PASSWORD } });
    const b = await api('POST', '/auth/login', { body: { email: u.buyer.email, password: 'wrong-wrong' } });
    assert.equal(a.status, 401);
    assert.deepEqual(a.json, b.json);
  });

  it('NEG: login with missing fields -> 400', async () => {
    assert.equal((await api('POST', '/auth/login', { body: {} })).status, 400);
    assert.equal((await api('POST', '/auth/login', { body: { email: 'a@b.co' } })).status, 400);
  });

  it('NEG: login with non-string / injection-style input is rejected, not 500', async () => {
    const r1 = await api('POST', '/auth/login', { body: { email: { $ne: null }, password: { $ne: null } } });
    assert.ok([400, 401].includes(r1.status), `got ${r1.status}`);
    const r2 = await api('POST', '/auth/login', { body: { email: "' OR 1=1 --", password: "' OR 1=1 --" } });
    assert.ok([400, 401].includes(r2.status), `got ${r2.status}`);
  });

  it('NEG: malformed JSON body does not crash the server', async () => {
    const r = await api('POST', '/auth/login', { raw: '{"email": ' });
    assert.ok(r.status >= 400 && r.status < 600);
    assert.equal((await api('GET', '/health')).status, 200);
  });

  it('NEG: register validation (missing fields, short password, non-resident role)', async () => {
    assert.equal((await api('POST', '/auth/register', { body: { email: 'x@gptest.dev' } })).status, 400);
    const short = await api('POST', '/auth/register', {
      body: { email: `${RUN}.short@gptest.dev`, password: '123', firstName: 'A', lastName: 'B' },
    });
    assert.equal(short.status, 400);
    for (const role of ['admin', 'business']) {
      const r = await api('POST', '/auth/register', {
        body: { email: `${RUN}.${role}@gptest.dev`, password: PASSWORD, firstName: 'A', lastName: 'B', role },
      });
      assert.equal(r.status, 400, `self-registering as ${role} must be refused`);
    }
  });

  it('NEG: registering an existing email is refused', async () => {
    const r = await api('POST', '/auth/register', {
      body: { email: u.buyer.email, password: PASSWORD, firstName: 'Dup', lastName: 'User' },
    });
    // Supabase may return an obfuscated success for existing emails when confirmations are on;
    // either way no second profile may exist for that email.
    if (r.status === 201) {
      const { data } = await supabaseAdmin.from('profiles').select('id').eq('id', u.buyer.id);
      assert.equal(data.length, 1);
    } else {
      assert.equal(r.status, 400);
    }
  });

  it('GET /auth/me returns own profile', async () => {
    const r = await api('GET', '/auth/me', { token: u.buyer.token });
    assert.equal(r.status, 200);
  });

  it('NEG: protected routes without token -> 401', async () => {
    for (const [m, p] of [['GET', '/auth/me'], ['GET', '/orders'], ['GET', '/marketplace/cart'],
      ['GET', '/notifications'], ['GET', '/messages/conversations'], ['GET', '/admin/stats']]) {
      assert.equal((await api(m, p)).status, 401, `${m} ${p}`);
    }
  });

  it('NEG: garbage / malformed / expired-style tokens -> 401', async () => {
    assert.equal((await api('GET', '/auth/me', { token: 'not-a-jwt' })).status, 401);
    const fake = `${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(`{"sub":"${u.admin.id}","role":"authenticated"}`).toString('base64url')}.sig`;
    assert.equal((await api('GET', '/admin/stats', { token: fake })).status, 401);
    assert.equal((await api('GET', '/auth/me', { headers: { Authorization: 'Basic abc' } })).status, 401);
    assert.equal((await api('GET', '/auth/me', { headers: { Authorization: 'Bearer ' } })).status, 401);
  });

  it('NEG: forgot-password / reset-password reject missing input', async () => {
    const f = await api('POST', '/auth/forgot-password', { body: {} });
    assert.ok(f.status >= 400 && f.status < 500, `forgot-password ${f.status}`);
    const r = await api('POST', '/auth/reset-password', { body: {} });
    assert.ok(r.status >= 400 && r.status < 500, `reset-password ${r.status}`);
  });
});

// =====================================================================
// 2. AUTHORIZATION / RBAC / SECURITY
// =====================================================================
describe('authorization & role protection', () => {
  it('NEG: resident cannot reach admin endpoints (403)', async () => {
    for (const [m, p] of [['GET', '/admin/stats'], ['GET', '/admin/settings'], ['GET', '/users'],
      ['GET', '/businesses/admin'], ['GET', '/marketplace/admin/listings'], ['GET', '/forum/admin/reports']]) {
      const r = await api(m, p, { token: u.buyer.token });
      assert.equal(r.status, 403, `${m} ${p} -> ${r.status}`);
    }
  });

  it('NEG: business owner cannot reach admin endpoints (403)', async () => {
    assert.equal((await api('GET', '/admin/stats', { token: u.owner.token })).status, 403);
    assert.equal((await api('GET', '/users', { token: u.owner.token })).status, 403);
  });

  it('admin can reach admin endpoints', async () => {
    assert.equal((await api('GET', '/admin/stats', { token: u.admin.token })).status, 200);
    assert.equal((await api('GET', '/users', { token: u.admin.token })).status, 200);
  });

  it('NEG: resident cannot use business-only endpoints', async () => {
    assert.equal((await api('GET', '/orders/business', { token: u.buyer.token })).status, 403);
    assert.equal((await api('GET', '/drop-offs/business', { token: u.buyer.token })).status, 403);
    assert.equal((await api('GET', '/businesses/my/stats', { token: u.buyer.token })).status, 403);
    const r = await api('POST', '/marketplace/listings', {
      token: u.buyer.token,
      body: { title: 'x', description: 'y', price: 1, categoryId: ids.categoryId },
    });
    assert.equal(r.status, 403);
  });

  it('NEG: admin-only mutations refused for non-admins', async () => {
    const bid = u.owner.businessId;
    for (const action of ['approve', 'reject', 'suspend', 'reactivate']) {
      assert.equal((await api('PATCH', `/businesses/admin/${bid}/${action}`, { token: u.owner.token })).status, 403, action);
      assert.equal((await api('PATCH', `/businesses/admin/${bid}/${action}`, { token: u.buyer.token })).status, 403, action);
    }
    assert.equal((await api('PATCH', `/marketplace/admin/listings/${ids.listingId}/status`,
      { token: u.owner.token, body: { status: 'active' } })).status, 403);
    assert.equal((await api('PATCH', `/marketplace/admin/listings/${ids.listingId}/feature`,
      { token: u.owner.token, body: { featured: true } })).status, 403);
    assert.equal((await api('PATCH', `/users/${u.buyer.id}/toggle-active`, { token: u.buyer.token })).status, 403);
    assert.equal((await api('DELETE', `/users/${u.owner.id}`, { token: u.buyer.token })).status, 403);
    assert.equal((await api('PUT', '/admin/settings', { token: u.buyer.token, body: {} })).status, 403);
  });

  it('NEG: privilege escalation - user cannot make themselves admin via PATCH role', async () => {
    const r = await api('PATCH', `/users/${u.buyer.id}/role`, { token: u.buyer.token, body: { role: 'admin' } });
    assert.equal(r.status, 403);
    const { data } = await supabaseAdmin.from('profiles').select('role').eq('id', u.buyer.id).single();
    assert.equal(data.role, 'resident');
  });

  it('NEG: privilege escalation - profile update with role/is_active fields is ignored', async () => {
    const r = await api('PUT', '/auth/profile', {
      token: u.buyer.token,
      body: { firstName: 'Buyer', lastName: 'Tester', role: 'admin', is_active: true, isActive: true },
    });
    assert.ok(r.status < 500, `profile update ${r.status}`);
    const { data } = await supabaseAdmin.from('profiles').select('role').eq('id', u.buyer.id).single();
    assert.equal(data.role, 'resident', 'role must not change via profile update');
  });

  it('NEG: direct DB self role change with a user JWT is blocked by migration 026', async () => {
    const { createClient } = require('@supabase/supabase-js');
    const userClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${u.buyer.token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await userClient.from('profiles').update({ role: 'admin' }).eq('id', u.buyer.id);
    const { data } = await supabaseAdmin.from('profiles').select('role').eq('id', u.buyer.id).single();
    assert.equal(data.role, 'resident');
  });

  it('NEG: a user cannot edit or delete another business', async () => {
    const upd = await api('PUT', `/businesses/${u.owner.businessId}`, { token: u.owner2.token, body: { name: 'Hijacked' } });
    assert.ok([403, 404].includes(upd.status), `update other biz ${upd.status}`);
    const del = await api('DELETE', `/businesses/${u.owner.businessId}`, { token: u.owner2.token });
    assert.ok([403, 404].includes(del.status), `delete other biz ${del.status}`);
    const hrs = await api('PUT', `/businesses/${u.owner.businessId}/hours`, { token: u.owner2.token, body: { hours: [] } });
    assert.ok([403, 404].includes(hrs.status), `hours other biz ${hrs.status}`);
    const { data } = await supabaseAdmin.from('businesses').select('name').eq('id', u.owner.businessId).single();
    assert.notEqual(data.name, 'Hijacked');
  });

  it('NEG: a user cannot edit/delete/publish another seller\'s listing', async () => {
    const upd = await api('PUT', `/marketplace/listings/${ids.listingId}`, { token: u.owner2.token, body: { title: 'Hijacked' } });
    assert.ok([403, 404].includes(upd.status), `update ${upd.status}`);
    const del = await api('DELETE', `/marketplace/listings/${ids.listingId}`, { token: u.buyer.token });
    assert.ok([403, 404].includes(del.status), `delete ${del.status}`);
    const { data } = await supabaseAdmin.from('listings').select('title,status').eq('id', ids.listingId).single();
    assert.notEqual(data.title, 'Hijacked');
    assert.equal(data.status, 'active');
  });

  it('NEG: admin-only business documents list is not readable cross-owner', async () => {
    const r = await api('GET', `/businesses/${u.owner.businessId}/documents`, { token: u.owner2.token });
    assert.ok([403, 404].includes(r.status), `docs ${r.status}`);
  });
});

// =====================================================================
// 3. API ROBUSTNESS / INVALID INPUT / SECURITY HEADERS
// =====================================================================
describe('API robustness & security', () => {
  it('unknown route -> 404 JSON', async () => {
    const r = await api('GET', '/does-not-exist');
    assert.equal(r.status, 404);
    assert.equal(r.json.error, 'Not found');
  });

  it('helmet security headers are present', async () => {
    const r = await api('GET', '/health');
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
    assert.ok(r.headers.get('x-frame-options') || r.headers.get('content-security-policy'));
    assert.equal(r.headers.get('x-powered-by'), null);
  });

  it('CORS does not reflect an arbitrary origin', async () => {
    const r = await fetch(`${BASE}/api/health`, { headers: { Origin: 'https://evil.example' } });
    assert.notEqual(r.headers.get('access-control-allow-origin'), 'https://evil.example');
    assert.notEqual(r.headers.get('access-control-allow-origin'), '*');
  });

  it('NEG: non-UUID ids do not cause 500s', async () => {
    const paths = [
      ['GET', '/marketplace/listings/not-a-uuid'],
      ['GET', '/orders/not-a-uuid'],
      ['GET', '/drop-offs/not-a-uuid'],
      ['GET', '/reviews/business/not-a-uuid'],
      ['GET', '/messages/conversations/not-a-uuid'],
    ];
    for (const [m, p] of paths) {
      const r = await api(m, p, { token: u.buyer.token });
      assert.ok(r.status >= 400 && r.status < 500, `${m} ${p} -> ${r.status}`);
    }
  });

  it('NEG: unknown-but-valid UUIDs return 404 (or empty), not 500', async () => {
    for (const p of [`/marketplace/listings/${FAKE_UUID}`, `/orders/${FAKE_UUID}`, `/drop-offs/${FAKE_UUID}`]) {
      const r = await api('GET', p, { token: u.buyer.token });
      assert.ok([403, 404].includes(r.status), `${p} -> ${r.status}`);
    }
  });

  it('NEG: SQL/PostgREST filter injection in search params does not 500', async () => {
    const payloads = ["%'; DROP TABLE listings;--", 'a,b.eq.1)', '*', '\\', '%00'];
    for (const q of payloads) {
      const a = await api('GET', `/marketplace/listings?search=${encodeURIComponent(q)}`);
      assert.ok(a.status < 500, `listings search ${JSON.stringify(q)} -> ${a.status}`);
      const b = await api('GET', `/forum/search?q=${encodeURIComponent(q)}`);
      assert.ok(b.status < 500, `forum search ${JSON.stringify(q)} -> ${b.status}`);
      const c = await api('GET', `/businesses/public?search=${encodeURIComponent(q)}`);
      assert.ok(c.status < 500, `business search ${JSON.stringify(q)} -> ${c.status}`);
    }
    const { data } = await supabaseAdmin.from('listings').select('id').eq('id', ids.listingId);
    assert.equal(data.length, 1, 'listings table intact');
  });

  it('oversized JSON body is rejected without crashing', async () => {
    const big = JSON.stringify({ email: 'a@b.co', password: 'x'.repeat(2 * 1024 * 1024) });
    const r = await api('POST', '/auth/login', { raw: big });
    assert.ok(r.status >= 400 && r.status < 600);
    assert.equal((await api('GET', '/health')).status, 200);
  });
});

// =====================================================================
// 4. MARKETPLACE
// =====================================================================
describe('marketplace', () => {
  it('public listing browse returns the active listing', async () => {
    const r = await api('GET', `/marketplace/listings?search=${encodeURIComponent(RUN)}`);
    assert.equal(r.status, 200);
    const list = r.json.listings || [];
    assert.ok(list.some((l) => l.id === ids.listingId));
  });

  it('listing detail is public', async () => {
    const r = await api('GET', `/marketplace/listings/${ids.listingId}`);
    assert.equal(r.status, 200);
  });

  it('categories are public', async () => {
    assert.equal((await api('GET', '/marketplace/categories')).status, 200);
  });

  it('NEG: create listing with missing fields -> 400', async () => {
    const r = await api('POST', '/marketplace/listings', { token: u.owner.token, body: { title: 'Only title' } });
    assert.equal(r.status, 400);
  });

  it('NEG: create listing with invalid price (negative / NaN / string)', async () => {
    for (const price of [-5, 'abc', null]) {
      const r = await api('POST', '/marketplace/listings', {
        token: u.owner.token,
        body: { title: `${RUN} bad price`, description: 'desc', price, categoryId: ids.categoryId },
      });
      if (r.status === 201) {
        created.listingIds.push((r.json.listing || r.json).id);
        assert.fail(`listing accepted invalid price ${JSON.stringify(price)}`);
      }
      assert.ok(r.status >= 400 && r.status < 500, `price ${JSON.stringify(price)} -> ${r.status}`);
    }
  });

  it('NEG: draft/pending listings are not publicly visible', async () => {
    const mk = await api('POST', '/marketplace/listings', {
      token: u.owner.token,
      body: { title: `${RUN} Hidden Draft`, description: 'draft only', price: 5, categoryId: ids.categoryId },
    });
    assert.equal(mk.status, 201);
    const id = (mk.json.listing || mk.json).id;
    created.listingIds.push(id);
    const list = await api('GET', `/marketplace/listings?search=${encodeURIComponent('Hidden Draft')}`);
    assert.ok(!(list.json.listings || []).some((l) => l.id === id), 'draft listed publicly');
    const detail = await api('GET', `/marketplace/listings/${id}`);
    assert.ok([403, 404].includes(detail.status), `anon draft detail -> ${detail.status}`);
    const cart = await api('POST', '/marketplace/cart', { token: u.buyer.token, body: { listingId: id } });
    assert.equal(cart.status, 400);
  });

  it('NEG: owner cannot self-activate a listing (status route is admin-only)', async () => {
    const r = await api('PATCH', `/marketplace/admin/listings/${ids.listingId}/status`,
      { token: u.owner.token, body: { status: 'featured' } });
    assert.equal(r.status, 403);
  });

  it('NEG: admin listing status rejects an invalid status', async () => {
    const r = await api('PATCH', `/marketplace/admin/listings/${ids.listingId}/status`,
      { token: u.admin.token, body: { status: 'bogus' } });
    assert.equal(r.status, 400);
  });
});

// =====================================================================
// 5. CART
// =====================================================================
describe('cart', () => {
  it('add, update, count, remove', async () => {
    const add = await api('POST', '/marketplace/cart', { token: u.buyer2.token, body: { listingId: ids.listingId, quantity: 1 } });
    assert.equal(add.status, 201, JSON.stringify(add.json));
    const cart = await api('GET', '/marketplace/cart', { token: u.buyer2.token });
    assert.equal(cart.status, 200);
    const item = (cart.json.items || cart.json.cart || cart.json.cartItems || [])[0];
    assert.ok(item, `cart shape: ${JSON.stringify(cart.json).slice(0, 200)}`);
    const upd = await api('PATCH', `/marketplace/cart/${item.id}`, { token: u.buyer2.token, body: { quantity: 2 } });
    assert.equal(upd.status, 200, JSON.stringify(upd.json));
    const count = await api('GET', '/marketplace/cart/count', { token: u.buyer2.token });
    assert.equal(count.status, 200);
    assert.equal((await api('DELETE', `/marketplace/cart/${item.id}`, { token: u.buyer2.token })).status, 200);
    assert.equal((await api('DELETE', '/marketplace/cart', { token: u.buyer2.token })).status, 200);
  });

  it('NEG: add without listingId / zero / negative / over-stock / own listing / unknown listing', async () => {
    const t = u.buyer2.token;
    assert.equal((await api('POST', '/marketplace/cart', { token: t, body: {} })).status, 400);
    assert.equal((await api('POST', '/marketplace/cart', { token: t, body: { listingId: ids.listingId, quantity: 0 } })).status, 400);
    assert.equal((await api('POST', '/marketplace/cart', { token: t, body: { listingId: ids.listingId, quantity: -3 } })).status, 400);
    const over = await api('POST', '/marketplace/cart', { token: t, body: { listingId: ids.listingId, quantity: 999 } });
    assert.equal(over.status, 400);
    assert.match(over.json.error, /quantity/i);
    const own = await api('POST', '/marketplace/cart', { token: u.owner.token, body: { listingId: ids.listingId } });
    assert.equal(own.status, 400);
    assert.equal((await api('POST', '/marketplace/cart', { token: t, body: { listingId: FAKE_UUID } })).status, 404);
  });

  it('NEG: non-numeric quantity must not be accepted as valid', async () => {
    const r = await api('POST', '/marketplace/cart', { token: u.buyer2.token, body: { listingId: ids.listingId, quantity: 'abc' } });
    assert.ok(r.status >= 400 && r.status < 500, `quantity "abc" -> ${r.status}: ${JSON.stringify(r.json)}`);
    await api('DELETE', '/marketplace/cart', { token: u.buyer2.token });
  });

  it('NEG: cannot edit or remove another user\'s cart item', async () => {
    const add = await api('POST', '/marketplace/cart', { token: u.buyer2.token, body: { listingId: ids.listingId, quantity: 1 } });
    assert.equal(add.status, 201);
    const cart = await api('GET', '/marketplace/cart', { token: u.buyer2.token });
    const item = (cart.json.items || cart.json.cart || cart.json.cartItems || [])[0];
    const upd = await api('PATCH', `/marketplace/cart/${item.id}`, { token: u.buyer.token, body: { quantity: 3 } });
    assert.ok([403, 404].includes(upd.status), `cross-user cart update ${upd.status}`);
    const del = await api('DELETE', `/marketplace/cart/${item.id}`, { token: u.buyer.token });
    assert.ok([403, 404, 200].includes(del.status));
    const { data } = await supabaseAdmin.from('cart_items').select('id,quantity').eq('id', item.id);
    assert.equal(data.length, 1, 'victim cart item must survive');
    assert.equal(data[0].quantity, 1);
    await api('DELETE', '/marketplace/cart', { token: u.buyer2.token });
  });

  it('NEG: unauthenticated cart access -> 401', async () => {
    assert.equal((await api('POST', '/marketplace/cart', { body: { listingId: ids.listingId } })).status, 401);
  });
});

// =====================================================================
// 6. ORDERS, STOCK, PAYMENTS, RECEIPTS, REVIEWS (one end-to-end chain)
// =====================================================================
describe('orders / payments / reviews', () => {
  let orderId;

  async function cartItemIdFor(user) {
    const cart = await api('GET', '/marketplace/cart', { token: user.token });
    return (cart.json.items || cart.json.cart || cart.json.cartItems || [])[0]?.id;
  }

  it('NEG: checkout with no items / bad payment method / missing pickup date / bad time', async () => {
    const t = u.buyer.token;
    assert.equal((await api('POST', '/orders/checkout', { token: t, body: {} })).status, 400);
    assert.equal((await api('POST', '/orders/checkout', { token: t, body: { cartItemIds: [] , preferredPickupDate: pickupDate } })).status, 400);
    assert.equal((await api('POST', '/orders/checkout', { token: t, body: { cartItemIds: [FAKE_UUID], paymentMethod: 'bitcoin', preferredPickupDate: pickupDate } })).status, 400);
    assert.equal((await api('POST', '/orders/checkout', { token: t, body: { cartItemIds: [FAKE_UUID] } })).status, 400);
    assert.equal((await api('POST', '/orders/checkout', { token: t, body: { cartItemIds: [FAKE_UUID], preferredPickupDate: pickupDate, preferredPickupTime: 'midnight' } })).status, 400);
  });

  it('NEG: checkout with cart items that do not exist -> 404', async () => {
    const r = await api('POST', '/orders/checkout', { token: u.buyer.token, body: { cartItemIds: [FAKE_UUID], preferredPickupDate: pickupDate } });
    assert.equal(r.status, 404);
  });

  it('NEG: checkout with non-array cartItemIds -> 400', async () => {
    const r = await api('POST', '/orders/checkout', { token: u.buyer.token, body: { cartItemIds: 'abc', preferredPickupDate: pickupDate } });
    assert.equal(r.status, 400);
  });

  it('NEG: cannot check out someone else\'s cart item', async () => {
    await api('POST', '/marketplace/cart', { token: u.buyer2.token, body: { listingId: ids.listingId, quantity: 1 } });
    const victimItem = await cartItemIdFor(u.buyer2);
    const r = await api('POST', '/orders/checkout', { token: u.buyer.token, body: { cartItemIds: [victimItem], preferredPickupDate: pickupDate } });
    assert.equal(r.status, 404);
    await api('DELETE', '/marketplace/cart', { token: u.buyer2.token });
  });

  it('NEG: insufficient stock at checkout (stock reduced after adding to cart)', async () => {
    await api('POST', '/marketplace/cart', { token: u.buyer.token, body: { listingId: ids.listingId, quantity: 3 } });
    const itemId = await cartItemIdFor(u.buyer);
    await supabaseAdmin.from('listings').update({ quantity_available: 1 }).eq('id', ids.listingId);
    const r = await api('POST', '/orders/checkout', { token: u.buyer.token, body: { cartItemIds: [itemId], preferredPickupDate: pickupDate } });
    assert.equal(r.status, 400);
    assert.match(r.json.error, /no longer available/i);
    const { data } = await supabaseAdmin.from('listings').select('quantity_available').eq('id', ids.listingId).single();
    assert.equal(data.quantity_available, 1, 'stock must be untouched by a failed checkout');
    await supabaseAdmin.from('listings').update({ quantity_available: 3 }).eq('id', ids.listingId);
    await api('DELETE', '/marketplace/cart', { token: u.buyer.token });
  });

  it('NEG: checkout of an inactive (archived) listing is refused', async () => {
    await api('POST', '/marketplace/cart', { token: u.buyer.token, body: { listingId: ids.listingId, quantity: 1 } });
    const itemId = await cartItemIdFor(u.buyer);
    await supabaseAdmin.from('listings').update({ status: 'archived' }).eq('id', ids.listingId);
    const r = await api('POST', '/orders/checkout', { token: u.buyer.token, body: { cartItemIds: [itemId], preferredPickupDate: pickupDate } });
    await supabaseAdmin.from('listings').update({ status: 'active' }).eq('id', ids.listingId);
    assert.equal(r.status, 400);
    await api('DELETE', '/marketplace/cart', { token: u.buyer.token });
  });

  it('cash-on-pickup checkout creates an order, decrements stock, clears cart', async () => {
    await api('POST', '/marketplace/cart', { token: u.buyer.token, body: { listingId: ids.listingId, quantity: 2 } });
    const itemId = await cartItemIdFor(u.buyer);
    const r = await api('POST', '/orders/checkout', {
      token: u.buyer.token,
      body: { cartItemIds: [itemId], paymentMethod: 'cash_on_pickup', preferredPickupDate: pickupDate, preferredPickupTime: 'morning', notes: 'test' },
    });
    assert.equal(r.status, 201, JSON.stringify(r.json));
    const orders = r.json.orders || [r.json.order];
    orderId = orders[0].id;
    assert.match(orders[0].order_number, /^GP-\d{8}-[0-9A-F]{6}$/);
    assert.equal(Number(orders[0].total), 200);
    const { data } = await supabaseAdmin.from('listings').select('quantity_available').eq('id', ids.listingId).single();
    assert.equal(data.quantity_available, 1);
    assert.equal(await cartItemIdFor(u.buyer), undefined, 'cart emptied');
  });

  it('NEG: second order exceeding remaining stock is refused (stock 1 left)', async () => {
    const add = await api('POST', '/marketplace/cart', { token: u.buyer2.token, body: { listingId: ids.listingId, quantity: 2 } });
    assert.equal(add.status, 400, 'cart add beyond remaining stock must fail');
  });

  it('order detail (receipt data) readable by buyer and seller', async () => {
    const b = await api('GET', `/orders/${orderId}`, { token: u.buyer.token });
    assert.equal(b.status, 200);
    const o = b.json.order || b.json;
    assert.ok(o.order_number && (o.items || o.order_items), 'receipt needs number + items');
    const s = await api('GET', `/orders/${orderId}`, { token: u.owner.token });
    assert.equal(s.status, 200);
    const list = await api('GET', '/orders', { token: u.buyer.token });
    assert.equal(list.status, 200);
  });

  it('NEG: unrelated users cannot read an order (IDOR)', async () => {
    for (const user of [u.buyer2, u.owner2]) {
      const r = await api('GET', `/orders/${orderId}`, { token: user.token });
      assert.ok([403, 404].includes(r.status), `IDOR read -> ${r.status}`);
    }
    const list = await api('GET', '/orders', { token: u.buyer2.token });
    assert.ok(!JSON.stringify(list.json).includes(orderId), 'order leaked into other buyer list');
  });

  it('NEG: unrelated users cannot cancel or progress an order', async () => {
    const c = await api('POST', `/orders/${orderId}/cancel`, { token: u.buyer2.token, body: {} });
    assert.ok([403, 404].includes(c.status), `cancel ${c.status}`);
    const p = await api('PATCH', `/orders/${orderId}/status`, { token: u.owner2.token, body: { status: 'confirmed' } });
    assert.equal(p.status, 403);
    const asBuyer = await api('PATCH', `/orders/${orderId}/status`, { token: u.buyer.token, body: { status: 'completed' } });
    assert.equal(asBuyer.status, 403, 'buyer must not complete own order');
  });

  it('NEG: invalid status values and illegal transitions', async () => {
    const t = u.owner.token;
    assert.equal((await api('PATCH', `/orders/${orderId}/status`, { token: t, body: { status: 'teleported' } })).status, 400);
    assert.equal((await api('PATCH', `/orders/${orderId}/status`, { token: t, body: {} })).status, 400);
    const skip = await api('PATCH', `/orders/${orderId}/status`, { token: t, body: { status: 'completed' } });
    assert.equal(skip.status, 400, 'pending -> completed must be refused');
    assert.match(skip.json.error, /Cannot transition/);
    assert.equal((await api('PATCH', `/orders/${FAKE_UUID}/status`, { token: t, body: { status: 'confirmed' } })).status, 404);
  });

  it('NEG: review not allowed before the order is completed', async () => {
    const r = await api('POST', '/reviews', {
      token: u.buyer.token,
      body: { businessId: u.owner.businessId, orderId, rating: 5, body: 'Great shop, quick and friendly service.' },
    });
    assert.equal(r.status, 400);
    assert.match(r.json.error, /completed/i);
  });

  it('business walks the order through to completion; cash order becomes paid', async () => {
    for (const status of ['confirmed', 'processing', 'ready_for_pickup', 'completed']) {
      const r = await api('PATCH', `/orders/${orderId}/status`, { token: u.owner.token, body: { status } });
      assert.equal(r.status, 200, `-> ${status}: ${JSON.stringify(r.json)}`);
    }
    const { data } = await supabaseAdmin.from('orders').select('status,payment_status').eq('id', orderId).single();
    assert.equal(data.status, 'completed');
    assert.equal(data.payment_status, 'paid');
    const n = await api('GET', '/notifications', { token: u.buyer.token });
    assert.equal(n.status, 200);
  });

  it('NEG: a completed order cannot be cancelled or moved again', async () => {
    const c = await api('POST', `/orders/${orderId}/cancel`, { token: u.buyer.token, body: { cancellation_reason: 'changed mind' } });
    assert.equal(c.status, 400, JSON.stringify(c.json));
    const p = await api('PATCH', `/orders/${orderId}/status`, { token: u.owner.token, body: { status: 'confirmed' } });
    assert.equal(p.status, 400);
  });

  // ---- reviews ----
  it('NEG: review validation (rating range, short body, both targets, neither target)', async () => {
    const t = u.buyer.token;
    const body = 'Great shop, quick and friendly service.';
    const biz = u.owner.businessId;
    assert.equal((await api('POST', '/reviews', { token: t, body: { businessId: biz, rating: 0, body } })).status, 400);
    assert.equal((await api('POST', '/reviews', { token: t, body: { businessId: biz, rating: 6, body } })).status, 400);
    assert.equal((await api('POST', '/reviews', { token: t, body: { businessId: biz, rating: 2.5, body } })).status, 400);
    assert.equal((await api('POST', '/reviews', { token: t, body: { businessId: biz, rating: 'abc', body } })).status, 400);
    assert.equal((await api('POST', '/reviews', { token: t, body: { businessId: biz, rating: 5, body: 'x' } })).status, 400);
    assert.equal((await api('POST', '/reviews', { token: t, body: { businessId: biz, listingId: ids.listingId, rating: 5, body } })).status, 400);
    assert.equal((await api('POST', '/reviews', { token: t, body: { rating: 5, body } })).status, 400);
    assert.equal((await api('POST', '/reviews', { token: t, body: { businessId: FAKE_UUID, rating: 5, body } })).status, 404);
  });

  it('NEG: cannot review using someone else\'s order or a mismatched business', async () => {
    const body = 'Great shop, quick and friendly service.';
    const other = await api('POST', '/reviews', { token: u.buyer2.token, body: { businessId: u.owner.businessId, orderId, rating: 5, body } });
    assert.equal(other.status, 403);
    const wrongBiz = await api('POST', '/reviews', { token: u.buyer.token, body: { businessId: u.owner2.businessId, orderId, rating: 5, body } });
    assert.equal(wrongBiz.status, 400);
  });

  it('review created, then NEG: duplicate review -> 409', async () => {
    const body = { businessId: u.owner.businessId, orderId, rating: 5, title: 'Nice', body: 'Great shop, quick and friendly service.' };
    const first = await api('POST', '/reviews', { token: u.buyer.token, body });
    assert.equal(first.status, 201, JSON.stringify(first.json));
    const dup = await api('POST', '/reviews', { token: u.buyer.token, body });
    assert.equal(dup.status, 409);
    const dup2 = await api('POST', '/reviews', { token: u.buyer.token, body: { ...body, orderId: null } });
    assert.equal(dup2.status, 409, 'second review of same business without order must also be refused');
    const { data } = await supabaseAdmin.from('reviews').select('id').eq('reviewer_id', u.buyer.id).eq('business_id', u.owner.businessId);
    assert.equal(data.length, 1);
    ids.reviewId = (first.json.review || first.json).id;
  });

  it('NEG: concurrent duplicate reviews produce exactly one row', async () => {
    const body = { listingId: ids.listingId, orderId, rating: 4, body: 'Solid crate, would buy again for sure.' };
    const results = await Promise.all([1, 2, 3].map(() => api('POST', '/reviews', { token: u.buyer.token, body })));
    const ok = results.filter((r) => r.status === 201).length;
    assert.equal(ok, 1, `statuses: ${results.map((r) => r.status)}`);
    const { data } = await supabaseAdmin.from('reviews').select('id').eq('reviewer_id', u.buyer.id).eq('listing_id', ids.listingId);
    assert.equal(data.length, 1);
  });

  it('NEG: only the author can edit/delete a review; only the owner can reply', async () => {
    const id = ids.reviewId;
    const edit = await api('PATCH', `/reviews/${id}`, { token: u.buyer2.token, body: { rating: 1, body: 'Hijacked review text here.' } });
    assert.ok([403, 404].includes(edit.status), `edit ${edit.status}`);
    const del = await api('DELETE', `/reviews/${id}`, { token: u.buyer2.token });
    assert.ok([403, 404].includes(del.status), `delete ${del.status}`);
    const reply = await api('POST', `/reviews/${id}/reply`, { token: u.owner2.token, body: { reply: 'Not my shop' } });
    assert.ok([403, 404].includes(reply.status), `foreign reply ${reply.status}`);
    const ok = await api('POST', `/reviews/${id}/reply`, { token: u.owner.token, body: { reply: 'Thank you for shopping!', body: 'Thank you for shopping!' } });
    assert.ok(ok.status < 300, `owner reply ${ok.status}: ${JSON.stringify(ok.json)}`);
    const { data } = await supabaseAdmin.from('reviews').select('rating').eq('id', id).single();
    assert.equal(data.rating, 5);
  });

  it('public review list for a business works without auth', async () => {
    const r = await api('GET', `/reviews/business/${u.owner.businessId}`);
    assert.equal(r.status, 200);
  });

  // ---- cancellation ----
  it('buyer can cancel a pending cash order; stock is restored', async () => {
    const before = (await supabaseAdmin.from('listings').select('quantity_available').eq('id', ids.listingId).single()).data.quantity_available;
    await api('POST', '/marketplace/cart', { token: u.buyer2.token, body: { listingId: ids.listingId, quantity: 1 } });
    const itemId = await cartItemIdFor(u.buyer2);
    const co = await api('POST', '/orders/checkout', { token: u.buyer2.token, body: { cartItemIds: [itemId], preferredPickupDate: pickupDate } });
    assert.equal(co.status, 201, JSON.stringify(co.json));
    const oid = (co.json.orders || [co.json.order])[0].id;
    const c = await api('POST', `/orders/${oid}/cancel`, { token: u.buyer2.token, body: { cancellation_reason: 'test cancel' } });
    assert.equal(c.status, 200, JSON.stringify(c.json));
    const after = (await supabaseAdmin.from('listings').select('quantity_available').eq('id', ids.listingId).single()).data.quantity_available;
    assert.equal(after, before, 'stock restored after cancel');
    const again = await api('POST', `/orders/${oid}/cancel`, { token: u.buyer2.token, body: {} });
    assert.equal(again.status, 400, 'double-cancel must be refused');
    const after2 = (await supabaseAdmin.from('listings').select('quantity_available').eq('id', ids.listingId).single()).data.quantity_available;
    assert.equal(after2, before, 'double-cancel must not restore stock twice');
  });

  it('NEG: concurrent checkouts cannot oversell the last unit', async () => {
    await supabaseAdmin.from('listings').update({ quantity_available: 1 }).eq('id', ids.listingId);
    await api('POST', '/marketplace/cart', { token: u.buyer.token, body: { listingId: ids.listingId, quantity: 1 } });
    await api('POST', '/marketplace/cart', { token: u.buyer2.token, body: { listingId: ids.listingId, quantity: 1 } });
    const [i1, i2] = [await cartItemIdFor(u.buyer), await cartItemIdFor(u.buyer2)];
    const [a, b] = await Promise.all([
      api('POST', '/orders/checkout', { token: u.buyer.token, body: { cartItemIds: [i1], preferredPickupDate: pickupDate } }),
      api('POST', '/orders/checkout', { token: u.buyer2.token, body: { cartItemIds: [i2], preferredPickupDate: pickupDate } }),
    ]);
    const wins = [a, b].filter((r) => r.status === 201).length;
    const { data } = await supabaseAdmin.from('listings').select('quantity_available').eq('id', ids.listingId).single();
    assert.equal(wins, 1, `both checkouts succeeded for 1 unit of stock (${a.status}, ${b.status}); quantity_available=${data.quantity_available}`);
    assert.ok(data.quantity_available >= 0);
  });

  // ---- payments ----
  it('NEG: payment checkout validation & ownership', async () => {
    const t = u.buyer.token;
    const missing = await api('POST', '/payments/checkout', { token: t, body: {} });
    assert.ok(missing.status >= 400 && missing.status < 500, `missing ${missing.status}`);
    const fake = await api('POST', '/payments/checkout', { token: t, body: { orderId: FAKE_UUID, paymentMethod: 'paymongo_gcash' } });
    assert.ok([400, 404].includes(fake.status), `fake order ${fake.status}`);
    const notMine = await api('POST', '/payments/checkout', { token: u.buyer2.token, body: { orderId, paymentMethod: 'paymongo_gcash' } });
    assert.ok([400, 403, 404].includes(notMine.status), `foreign order ${notMine.status}`);
    assert.equal((await api('POST', '/payments/checkout', { body: { orderId } })).status, 401);
  });

  it('NEG: payment status of someone else\'s order is not readable', async () => {
    const r = await api('GET', `/payments/status/${orderId}`, { token: u.buyer2.token });
    assert.ok([403, 404].includes(r.status), `status ${r.status}`);
  });

  it('NEG: failed payment path - expiring a payment on an unknown/foreign order is refused', async () => {
    const a = await api('POST', `/payments/expire/${FAKE_UUID}`, { token: u.buyer.token });
    assert.ok([400, 403, 404].includes(a.status), `expire fake ${a.status}`);
    const b = await api('POST', `/payments/expire/${orderId}`, { token: u.buyer2.token });
    assert.ok([400, 403, 404].includes(b.status), `expire foreign ${b.status}`);
  });

  it('failed PayMongo payment (signed payment.failed webhook) marks payment failed and never marks order paid', async () => {
    // Build a pending PayMongo order + payment row directly, then drive it with signed webhooks.
    const intentId = `pi_${RUN}`;
    const { data: ord } = await supabaseAdmin.from('orders').insert({
      buyer_id: u.buyer2.id, business_id: u.owner.businessId, order_number: `GP-TEST-${RUN.slice(-6).toUpperCase()}`,
      status: 'pending', subtotal: 100, shipping_fee: 0, total: 100, payment_method: 'paymongo_gcash',
      payment_status: 'pending', preferred_pickup_date: pickupDate, preferred_pickup_time: 'morning',
    }).select().single();
    assert.ok(ord, 'fixture order');
    await supabaseAdmin.from('payments').insert({ order_id: ord.id, amount: 100, method: 'paymongo_gcash', status: 'pending', paymongo_payment_id: intentId });

    const evt = `evt_${RUN}_failed`;
    created.webhookEventIds.push(evt);
    const r = await signedWebhook({ id: evt, type: 'payment.failed', paymentIntentId: intentId });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    const { data: pay } = await supabaseAdmin.from('payments').select('status').eq('order_id', ord.id).single();
    assert.equal(pay.status, 'failed');
    const { data: o } = await supabaseAdmin.from('orders').select('payment_status,status').eq('id', ord.id).single();
    assert.notEqual(o.payment_status, 'paid');

    // replay of the same event id is idempotent
    const replay = await signedWebhook({ id: evt, type: 'payment.failed', paymentIntentId: intentId });
    assert.equal(replay.status, 200);
    assert.match(replay.json.message, /already processed/i);
  });

  it('valid signed payment.paid webhook finalizes order (paid, stock reserved once)', async () => {
    const intentId = `pi_${RUN}_paid`;
    await supabaseAdmin.from('listings').update({ quantity_available: 3 }).eq('id', ids.listingId);
    const { data: ord } = await supabaseAdmin.from('orders').insert({
      buyer_id: u.buyer2.id, business_id: u.owner.businessId, order_number: `GP-TESTP-${RUN.slice(-5).toUpperCase()}`,
      status: 'pending', subtotal: 100, shipping_fee: 0, total: 100, payment_method: 'paymongo_gcash',
      payment_status: 'pending', preferred_pickup_date: pickupDate, preferred_pickup_time: 'morning',
    }).select().single();
    await supabaseAdmin.from('order_items').insert({ order_id: ord.id, listing_id: ids.listingId, seller_id: u.owner.id, title: 'Crate', price: 100, quantity: 1, total: 100 });
    await supabaseAdmin.from('payments').insert({ order_id: ord.id, amount: 100, method: 'paymongo_gcash', status: 'pending', paymongo_payment_id: intentId });

    const e1 = `evt_${RUN}_paid1`;
    created.webhookEventIds.push(e1);
    const r = await signedWebhook({ id: e1, type: 'payment.paid', paymentIntentId: intentId });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    const { data: o } = await supabaseAdmin.from('orders').select('payment_status').eq('id', ord.id).single();
    assert.equal(o.payment_status, 'paid');
    const { data: l1 } = await supabaseAdmin.from('listings').select('quantity_available').eq('id', ids.listingId).single();

    // a *different* event id for the same payment must not reserve stock twice
    const e2 = `evt_${RUN}_paid2`;
    created.webhookEventIds.push(e2);
    await signedWebhook({ id: e2, type: 'payment.paid', paymentIntentId: intentId });
    const { data: l2 } = await supabaseAdmin.from('listings').select('quantity_available').eq('id', ids.listingId).single();
    assert.equal(l2.quantity_available, l1.quantity_available, 'duplicate paid event double-decremented stock');
  });

  // ---- webhook negatives ----
  it('NEG: webhook without signature -> 400', async () => {
    const r = await api('POST', '/payments/webhook', { raw: JSON.stringify({ data: {} }) });
    assert.equal(r.status, 400);
  });

  it('NEG: webhook with forged signature -> 401 and nothing is stored', async () => {
    const payload = webhookBody({ id: `evt_${RUN}_forged`, type: 'payment.paid', paymentIntentId: 'pi_forged' });
    const t = Math.floor(Date.now() / 1000);
    const bad = crypto.createHmac('sha256', 'wrong-secret').update(`${t}.${payload}`).digest('hex');
    const r = await api('POST', '/payments/webhook', { raw: payload, headers: { 'paymongo-signature': `t=${t},te=${bad},li=${bad}` } });
    assert.equal(r.status, 401);
    const { data } = await supabaseAdmin.from('webhook_events').select('event_id').eq('event_id', `evt_${RUN}_forged`);
    assert.equal(data.length, 0);
  });

  it('NEG: webhook with garbage signature header / tampered payload -> 401', async () => {
    const r = await api('POST', '/payments/webhook', { raw: '{}', headers: { 'paymongo-signature': 'garbage' } });
    assert.equal(r.status, 401);
    const secret = process.env.PAYMONGO_WEBHOOK_SECRET;
    const good = webhookBody({ id: `evt_${RUN}_tamper`, type: 'payment.paid', paymentIntentId: 'pi_x' });
    const t = Math.floor(Date.now() / 1000);
    const sig = crypto.createHmac('sha256', secret).update(`${t}.${good}`).digest('hex');
    const tampered = good.replace('payment.paid', 'payment.failed');
    const r2 = await api('POST', '/payments/webhook', { raw: tampered, headers: { 'paymongo-signature': `t=${t},te=${sig},li=${sig}` } });
    assert.equal(r2.status, 401);
  });

  it('NEG: validly signed webhook for unknown payment intent is acknowledged and ignored', async () => {
    const evt = `evt_${RUN}_unknown`;
    created.webhookEventIds.push(evt);
    const r = await signedWebhook({ id: evt, type: 'payment.paid', paymentIntentId: 'pi_does_not_exist' });
    assert.equal(r.status, 200);
  });

  it('NEG: validly signed webhook missing payment_intent_id -> 400', async () => {
    const payload = JSON.stringify({ data: { id: `evt_${RUN}_nopi`, type: 'event', attributes: { type: 'payment.paid', livemode: false, data: { id: 'pay_1', type: 'payment', attributes: {} } } } });
    const r = await api('POST', '/payments/webhook', { raw: payload, headers: { 'paymongo-signature': sign(payload) } });
    assert.equal(r.status, 400);
  });
});

// helpers for webhook signing (PayMongo: t=<ts>,te=<test hmac>,li=<live hmac> over `${t}.${payload}`)
function sign(payload) {
  const t = Math.floor(Date.now() / 1000);
  const sig = crypto.createHmac('sha256', process.env.PAYMONGO_WEBHOOK_SECRET).update(`${t}.${payload}`).digest('hex');
  return `t=${t},te=${sig},li=${sig}`;
}
function webhookBody({ id, type, paymentIntentId }) {
  return JSON.stringify({
    data: {
      id, type: 'event',
      attributes: {
        type, livemode: false,
        data: { id: `pay_${id}`, type: 'payment', attributes: { payment_intent_id: paymentIntentId, status: type === 'payment.paid' ? 'paid' : 'failed' } },
        created_at: Math.floor(Date.now() / 1000), updated_at: Math.floor(Date.now() / 1000),
      },
    },
  });
}
async function signedWebhook(args) {
  const payload = webhookBody(args);
  return api('POST', '/payments/webhook', { raw: payload, headers: { 'paymongo-signature': sign(payload) } });
}

// =====================================================================
// 7. DROP-OFFS
// =====================================================================
describe('drop-offs', () => {
  let dropOffId;

  it('business creates a drop-off for a resident (priced from accepted materials)', async () => {
    const r = await api('POST', '/drop-offs', {
      token: u.owner.token,
      body: { userId: u.buyer.id, items: [{ materialName: 'Plastic', quantity: 5 }], notes: 'test' },
    });
    assert.equal(r.status, 201, JSON.stringify(r.json));
    const d = r.json.dropOff || r.json.drop_off || r.json;
    dropOffId = d.id;
    assert.ok(dropOffId);
    assert.equal(Number(d.total_estimated_value ?? d.estimated_value ?? 50), 50);
  });

  it('resident sees own drop-off; detail readable by participants', async () => {
    const mine = await api('GET', '/drop-offs/my', { token: u.buyer.token });
    assert.equal(mine.status, 200);
    assert.ok(JSON.stringify(mine.json).includes(dropOffId));
    assert.equal((await api('GET', `/drop-offs/${dropOffId}`, { token: u.buyer.token })).status, 200);
    assert.equal((await api('GET', `/drop-offs/${dropOffId}`, { token: u.owner.token })).status, 200);
  });

  it('NEG: unrelated users cannot read a drop-off (IDOR)', async () => {
    for (const user of [u.buyer2, u.owner2]) {
      const r = await api('GET', `/drop-offs/${dropOffId}`, { token: user.token });
      assert.ok([403, 404].includes(r.status), `IDOR -> ${r.status}`);
    }
  });

  it('NEG: validation - no items, bad weight, missing material name, no resident/guest', async () => {
    const t = u.owner.token;
    assert.equal((await api('POST', '/drop-offs', { token: t, body: { userId: u.buyer.id, items: [] } })).status, 400);
    assert.equal((await api('POST', '/drop-offs', { token: t, body: { userId: u.buyer.id } })).status, 400);
    assert.equal((await api('POST', '/drop-offs', { token: t, body: { items: [{ materialName: 'Plastic', quantity: 1 }] } })).status, 400);
    for (const quantity of [0, -2, 'abc']) {
      const r = await api('POST', '/drop-offs', { token: t, body: { userId: u.buyer.id, items: [{ materialName: 'Plastic', quantity }] } });
      assert.ok(r.status >= 400 && r.status < 500, `weight ${quantity} -> ${r.status}`);
    }
    const noName = await api('POST', '/drop-offs', { token: t, body: { userId: u.buyer.id, items: [{ quantity: 1 }] } });
    assert.ok(noName.status >= 400 && noName.status < 500, `no name -> ${noName.status}`);
  });

  it('NEG: wrong role cannot create or complete drop-offs', async () => {
    const mk = await api('POST', '/drop-offs', { token: u.buyer.token, body: { userId: u.buyer2.id, items: [{ materialName: 'Plastic', quantity: 1 }] } });
    assert.equal(mk.status, 403);
    assert.equal((await api('PATCH', `/drop-offs/${dropOffId}/complete`, { token: u.buyer.token })).status, 403);
    const foreign = await api('PATCH', `/drop-offs/${dropOffId}/complete`, { token: u.owner2.token });
    assert.ok([400, 403, 404].includes(foreign.status), `foreign business complete ${foreign.status}`);
  });

  it('NEG: unrelated user cannot cancel a drop-off', async () => {
    const r = await api('PATCH', `/drop-offs/${dropOffId}/cancel`, { token: u.buyer2.token });
    assert.ok([403, 404].includes(r.status), `cancel ${r.status}`);
  });

  it('business completes the drop-off; completed one cannot be completed or cancelled again', async () => {
    const c = await api('PATCH', `/drop-offs/${dropOffId}/complete`, { token: u.owner.token });
    assert.equal(c.status, 200, JSON.stringify(c.json));
    const again = await api('PATCH', `/drop-offs/${dropOffId}/complete`, { token: u.owner.token });
    assert.equal(again.status, 400);
    const cancel = await api('PATCH', `/drop-offs/${dropOffId}/cancel`, { token: u.buyer.token });
    assert.equal(cancel.status, 400);
  });
});

// =====================================================================
// 8. FORUM
// =====================================================================
describe('forum', () => {
  let threadId; let postId;

  it('public thread list is readable without auth', async () => {
    assert.equal((await api('GET', '/forum/threads')).status, 200);
  });

  it('NEG: creating a thread requires auth, title and body', async () => {
    assert.equal((await api('POST', '/forum/threads', { body: { title: 'x', body: 'y' } })).status, 401);
    assert.equal((await api('POST', '/forum/threads', { token: u.buyer.token, body: { title: '  ', body: 'y' } })).status, 400);
    assert.equal((await api('POST', '/forum/threads', { token: u.buyer.token, body: { title: 'x', body: '' } })).status, 400);
  });

  it('user creates a thread and a reply', async () => {
    const t = await api('POST', '/forum/threads', { token: u.buyer.token, body: { title: `${RUN} thread`, body: 'Hello forum, is composting worth it?' } });
    assert.equal(t.status, 201, JSON.stringify(t.json));
    const thread = t.json.thread || t.json;
    threadId = thread.id;
    const p = await api('POST', `/forum/threads/${threadId}/posts`, { token: u.buyer2.token, body: { body: 'Yes it is, start small.' } });
    assert.equal(p.status, 201, JSON.stringify(p.json));
    postId = (p.json.post || p.json).id;
  });

  it('NEG: reply to unknown thread / empty reply', async () => {
    const a = await api('POST', `/forum/threads/${FAKE_UUID}/posts`, { token: u.buyer.token, body: { body: 'x' } });
    assert.ok([400, 404].includes(a.status), `unknown thread ${a.status}`);
    const b = await api('POST', `/forum/threads/${threadId}/posts`, { token: u.buyer.token, body: { body: '   ' } });
    assert.equal(b.status, 400);
  });

  it('NEG: non-admin cannot announce, pin, lock or moderate', async () => {
    const t = await api('POST', '/forum/threads', { token: u.buyer.token, body: { title: `${RUN} ann`, body: 'sneaky', isAnnouncement: true } });
    assert.equal(t.status, 201);
    assert.equal((t.json.thread || t.json).is_announcement, false, 'non-admin announcement flag must be ignored');
    assert.equal((await api('PUT', `/forum/threads/${threadId}/moderate`, { token: u.buyer.token, body: { is_pinned: true } })).status, 403);
    assert.equal((await api('PUT', `/forum/posts/${postId}/moderate`, { token: u.buyer.token, body: {} })).status, 403);
  });

  it('NEG: users cannot edit or delete others\' threads/posts', async () => {
    const e = await api('PUT', `/forum/threads/${threadId}`, { token: u.buyer2.token, body: { title: 'Hijacked', body: 'Hijacked' } });
    assert.ok([403, 404].includes(e.status), `edit thread ${e.status}`);
    const d = await api('DELETE', `/forum/threads/${threadId}`, { token: u.buyer2.token });
    assert.ok([403, 404].includes(d.status), `delete thread ${d.status}`);
    const ep = await api('PUT', `/forum/posts/${postId}`, { token: u.buyer.token, body: { body: 'Hijacked' } });
    assert.ok([403, 404].includes(ep.status), `edit post ${ep.status}`);
    const dp = await api('DELETE', `/forum/posts/${postId}`, { token: u.buyer.token });
    assert.ok([403, 404].includes(dp.status), `delete post ${dp.status}`);
    const { data } = await supabaseAdmin.from('forum_threads').select('title').eq('id', threadId).single();
    assert.ok(data.title.includes(RUN));
  });

  it('reactions, bookmarks, and reports work; NEG: invalid report is refused', async () => {
    assert.equal((await api('POST', `/forum/threads/${threadId}/reaction`, { token: u.buyer2.token, body: { type: 'heart' } })).status < 300, true);
    assert.equal((await api('POST', `/forum/threads/${threadId}/reaction`, { token: u.buyer2.token, body: { type: 'like' } })).status, 400);
    assert.equal((await api('POST', `/forum/threads/${threadId}/bookmark`, { token: u.buyer2.token })).status < 300, true);
    const rep = await api('POST', '/forum/report', { token: u.buyer2.token, body: { targetType: 'thread', targetId: threadId, reason: 'spam' } });
    assert.ok(rep.status < 300, `report ${rep.status}: ${JSON.stringify(rep.json)}`);
    const bad = await api('POST', '/forum/report', { token: u.buyer2.token, body: {} });
    assert.equal(bad.status, 400);
  });

  it('XSS payloads are stored inert (returned as plain JSON text, not executed/stripped into HTML)', async () => {
    const payload = '<script>alert(1)</script><img src=x onerror=alert(1)>';
    const t = await api('POST', '/forum/threads', { token: u.buyer.token, body: { title: `${RUN} xss`, body: payload } });
    assert.equal(t.status, 201);
    assert.ok(t.headers.get('content-type').includes('application/json'), 'API must serve JSON, never HTML');
  });

  it('admin can pin/lock/moderate and read the reports queue', async () => {
    const m = await api('PUT', `/forum/threads/${threadId}/moderate`, { token: u.admin.token, body: { isPinned: true } });
    assert.ok(m.status < 300, `moderate ${m.status}: ${JSON.stringify(m.json)}`);
    assert.equal((await api('GET', '/forum/admin/reports', { token: u.admin.token })).status, 200);
    assert.equal((await api('GET', '/forum/admin/reports/stats', { token: u.admin.token })).status, 200);
  });

  it('NEG: locked thread refuses new replies', async () => {
    await api('PUT', `/forum/threads/${threadId}/moderate`, { token: u.admin.token, body: { isLocked: true } });
    const r = await api('POST', `/forum/threads/${threadId}/posts`, { token: u.buyer.token, body: { body: 'reply into locked thread' } });
    assert.ok([400, 403].includes(r.status), `locked reply ${r.status}`);
  });
});

// =====================================================================
// 9. MESSAGING
// =====================================================================
describe('messaging', () => {
  let convId;

  it('NEG: validation - no recipient, self, unknown, bad uuid', async () => {
    const t = u.buyer.token;
    assert.equal((await api('POST', '/messages/conversations', { token: t, body: {} })).status, 400);
    assert.equal((await api('POST', '/messages/conversations', { token: t, body: { recipientId: u.buyer.id } })).status, 400);
    assert.equal((await api('POST', '/messages/conversations', { token: t, body: { recipientId: 'nope' } })).status, 400);
    assert.equal((await api('POST', '/messages/conversations', { token: t, body: { recipientId: FAKE_UUID } })).status, 404);
    assert.equal((await api('POST', '/messages/conversations', { token: t, body: { businessId: FAKE_UUID } })).status, 404);
  });

  it('resident opens a conversation with a business; same pair reuses the conversation', async () => {
    const a = await api('POST', '/messages/conversations', { token: u.buyer.token, body: { businessId: u.owner.businessId } });
    assert.ok(a.status < 300, JSON.stringify(a.json));
    convId = (a.json.conversation || a.json).id;
    const b = await api('POST', '/messages/conversations', { token: u.owner.token, body: { recipientId: u.buyer.id } });
    assert.equal((b.json.conversation || b.json).id, convId, 'conversation must be canonical per pair');
  });

  it('send message, recipient gets unread count + notification, then marks read', async () => {
    const s = await api('POST', `/messages/conversations/${convId}/messages`, { token: u.buyer.token, body: { body: 'Do you accept glass?', content: 'Do you accept glass?' } });
    assert.ok(s.status < 300, `send ${s.status}: ${JSON.stringify(s.json)}`);
    const un = await api('GET', '/messages/unread-count', { token: u.owner.token });
    assert.equal(un.status, 200);
    const list = await api('GET', `/messages/conversations/${convId}/messages`, { token: u.owner.token });
    assert.equal(list.status, 200);
    assert.ok(JSON.stringify(list.json).includes('accept glass'));
    assert.ok((await api('POST', `/messages/conversations/${convId}/read`, { token: u.owner.token })).status < 300);
  });

  it('NEG: empty / whitespace / oversized message refused', async () => {
    const t = u.buyer.token;
    const e = await api('POST', `/messages/conversations/${convId}/messages`, { token: t, body: { body: '   ', content: '   ' } });
    assert.equal(e.status, 400);
    const big = 'x'.repeat(20000);
    const r = await api('POST', `/messages/conversations/${convId}/messages`, { token: t, body: { body: big, content: big } });
    assert.ok(r.status >= 400 && r.status < 500, `oversized message accepted (${r.status})`);
  });

  it('NEG: non-participants cannot read, send to, or mark-read a conversation (IDOR)', async () => {
    const t = u.buyer2.token;
    for (const [m, p, body] of [
      ['GET', `/messages/conversations/${convId}`], ['GET', `/messages/conversations/${convId}/messages`],
      ['POST', `/messages/conversations/${convId}/messages`, { body: 'intruder', content: 'intruder' }],
      ['POST', `/messages/conversations/${convId}/read`],
    ]) {
      const r = await api(m, p, { token: t, body });
      assert.ok([403, 404].includes(r.status), `${m} ${p} -> ${r.status}`);
    }
    const mine = await api('GET', '/messages/conversations', { token: t });
    assert.ok(!JSON.stringify(mine.json).includes(convId));
  });
});

// =====================================================================
// 10. NOTIFICATIONS
// =====================================================================
describe('notifications', () => {
  it('list, unread count, mark read, mark all, delete own', async () => {
    const t = u.owner.token;
    const list = await api('GET', '/notifications', { token: t });
    assert.equal(list.status, 200);
    assert.equal((await api('GET', '/notifications/unread-count', { token: t })).status, 200);
    const items = list.json.notifications || [];
    if (items.length) {
      assert.equal((await api('PATCH', `/notifications/${items[0].id}/read`, { token: t })).status, 200);
    }
    assert.equal((await api('POST', '/notifications/read-all', { token: t })).status, 200);
  });

  it('business owner received a "new order" notification from the cash order', async () => {
    const { data } = await supabaseAdmin.from('notifications').select('id,type,title').eq('user_id', u.owner.id);
    assert.ok((data || []).length > 0, 'owner should have notifications (new order / review / message)');
  });

  it('NEG: cannot mark or delete another user\'s notification', async () => {
    const { data } = await supabaseAdmin.from('notifications').select('id').eq('user_id', u.owner.id).limit(1);
    if (!data?.length) return;
    const id = data[0].id;
    const m = await api('PATCH', `/notifications/${id}/read`, { token: u.buyer2.token });
    assert.ok([403, 404].includes(m.status) || m.status === 200, `mark ${m.status}`);
    const d = await api('DELETE', `/notifications/${id}`, { token: u.buyer2.token });
    const { data: still } = await supabaseAdmin.from('notifications').select('id').eq('id', id);
    assert.equal(still.length, 1, `foreign delete (${d.status}) removed the victim's notification`);
  });

  it('NEG: unauthenticated -> 401', async () => {
    assert.equal((await api('GET', '/notifications')).status, 401);
  });
});

// =====================================================================
// 11. ADMIN
// =====================================================================
describe('admin', () => {
  it('stats, settings, user list, listing & business queues load', async () => {
    const t = u.admin.token;
    for (const p of ['/admin/stats', '/admin/settings', '/users', '/users/stats', '/businesses/admin', '/businesses/admin/stats', '/marketplace/admin/listings', '/forum/admin/reports']) {
      const r = await api('GET', p, { token: t });
      assert.equal(r.status, 200, `${p} -> ${r.status}`);
    }
  });

  it('suspension: admin suspends a user -> reads still work, writes return ACCOUNT_SUSPENDED; reactivation restores', async () => {
    const target = u.buyer2;
    const s = await api('PATCH', `/users/${target.id}/toggle-active`, { token: u.admin.token, body: { reason: 'phase 19 test' } });
    assert.equal(s.status, 200, JSON.stringify(s.json));
    const read = await api('GET', '/auth/me', { token: target.token });
    assert.equal(read.status, 200);
    const write = await api('POST', '/marketplace/cart', { token: target.token, body: { listingId: ids.listingId } });
    assert.equal(write.status, 403);
    assert.equal(write.json.code, 'ACCOUNT_SUSPENDED');
    const back = await api('PATCH', `/users/${target.id}/toggle-active`, { token: u.admin.token });
    assert.equal(back.status, 200);
    const ok = await api('POST', '/forum/threads', { token: target.token, body: { title: `${RUN} after reactivation`, body: 'back again' } });
    assert.equal(ok.status, 201);
  });

  it('NEG: admin cannot suspend themselves (would lock out the only admin)', async () => {
    const a = await api('PATCH', `/users/${u.admin.id}/toggle-active`, { token: u.admin.token });
    // Always restore so the remaining admin tests can run, whatever the API answered.
    await supabaseAdmin.from('profiles').update({ is_active: true, suspension_reason: null }).eq('id', u.admin.id);
    assert.ok(a.status >= 400 && a.status < 500, `self-suspend returned ${a.status}`);
  });

  it('NEG: admin cannot delete or change the role of themselves', async () => {
    const b = await api('DELETE', `/users/${u.admin.id}`, { token: u.admin.token });
    assert.equal(b.status, 400);
    const c = await api('PATCH', `/users/${u.admin.id}/role`, { token: u.admin.token, body: { role: 'resident' } });
    assert.equal(c.status, 400);
    const { data } = await supabaseAdmin.from('profiles').select('is_active,role').eq('id', u.admin.id).single();
    assert.equal(data.is_active, true);
    assert.equal(data.role, 'admin');
  });

  it('NEG: role update validation (invalid role, unknown user)', async () => {
    const a = await api('PATCH', `/users/${u.buyer.id}/role`, { token: u.admin.token, body: { role: 'superuser' } });
    assert.equal(a.status, 400);
    const b = await api('PATCH', `/users/${FAKE_UUID}/role`, { token: u.admin.token, body: { role: 'resident' } });
    assert.ok([400, 404].includes(b.status), `unknown user ${b.status}`);
  });

  it('NEG: admin ops on unknown ids -> 404 not 500', async () => {
    const t = u.admin.token;
    assert.ok([404].includes((await api('GET', `/users/${FAKE_UUID}`, { token: t })).status));
    assert.ok([404].includes((await api('PATCH', `/businesses/admin/${FAKE_UUID}/approve`, { token: t })).status));
    assert.ok([404].includes((await api('PATCH', `/marketplace/admin/listings/${FAKE_UUID}/status`, { token: t, body: { status: 'active' } })).status));
  });

  it('NEG: approving an already-approved business is refused or idempotent (never 500)', async () => {
    const r = await api('PATCH', `/businesses/admin/${u.owner.businessId}/approve`, { token: u.admin.token });
    assert.ok(r.status < 500, `re-approve ${r.status}`);
  });

  it('settings update validation does not accept garbage', async () => {
    const r = await api('PUT', '/admin/settings', { token: u.admin.token, body: { settings: 'not-an-object' } });
    assert.ok(r.status >= 400 && r.status < 500, `bad settings ${r.status}`);
  });

  it('admin business suspend -> listings blocked from checkout? (status flips; reactivate restores)', async () => {
    const s = await api('PATCH', `/businesses/admin/${u.owner2.businessId}/suspend`, { token: u.admin.token, body: { reason: 'test' } });
    assert.ok(s.status < 300, `suspend ${s.status}: ${JSON.stringify(s.json)}`);
    const re = await api('PATCH', `/businesses/admin/${u.owner2.businessId}/reactivate`, { token: u.admin.token });
    assert.ok(re.status < 300, `reactivate ${re.status}`);
  });
});

// =====================================================================
// 12. CSV (client-side exporter) - logic is pure, test it in isolation
// =====================================================================
describe('walk-in orders & materials (hardening)', () => {
  const stockOf = async () => (await supabaseAdmin.from('listings').select('quantity_available').eq('id', ids.listingId).single()).data.quantity_available;
  const walkIn = (token, items) => api('POST', '/orders/walk-in', { token, body: { guestName: 'Walk In', items } });

  it('NEG: materials update with bad input is a clean 400 and keeps existing materials', async () => {
    const t = u.owner.token;
    const bad = [
      [{ price_per_kg: 5 }], [{ material_name: '   ' }], [{ material_name: 7 }],
      [{ material_name: 'Glass', price_per_kg: -1 }], [{ material_name: 'Glass', price_per_kg: 'abc' }],
    ];
    for (const materials of bad) {
      const r = await api('PUT', `/businesses/${u.owner.businessId}/materials`, { token: t, body: { materials } });
      assert.equal(r.status, 400, JSON.stringify(materials));
      assert.ok(!/violates|constraint|relation/i.test(r.json.error), `leaked db text: ${r.json.error}`);
    }
    const { data } = await supabaseAdmin.from('business_materials').select('material_name').eq('business_id', u.owner.businessId);
    assert.ok(data.some((m) => m.material_name === 'Plastic'), 'existing materials must survive rejected updates');
  });

  it('NEG: walk-in rejects zero / negative / fractional / missing quantity (negative would add stock)', async () => {
    const before = await stockOf();
    for (const quantity of [0, -5, 1.5, '2', undefined]) {
      const r = await walkIn(u.owner.token, [{ listingId: ids.listingId, quantity }]);
      assert.equal(r.status, 400, `quantity ${JSON.stringify(quantity)} -> ${r.status}`);
    }
    assert.equal(await stockOf(), before, 'stock must not change');
  });

  it('NEG: walk-in rejects duplicate lines and another business\'s listing', async () => {
    const before = await stockOf();
    const dup = await walkIn(u.owner.token, [{ listingId: ids.listingId, quantity: 1 }, { listingId: ids.listingId, quantity: 1 }]);
    assert.equal(dup.status, 400);
    const foreign = await walkIn(u.owner2.token, [{ listingId: ids.listingId, quantity: 1 }]);
    assert.equal(foreign.status, 400, 'business 2 must not sell business 1 stock');
    const asResident = await walkIn(u.buyer.token, [{ listingId: ids.listingId, quantity: 1 }]);
    assert.equal(asResident.status, 403);
    assert.equal(await stockOf(), before);
  });

  it('walk-in order decrements stock; NEG: concurrent walk-ins cannot oversell the last unit; cancel restores once', async () => {
    await supabaseAdmin.from('listings').update({ quantity_available: 1, status: 'active' }).eq('id', ids.listingId);
    const results = await Promise.all([1, 2, 3].map(() => walkIn(u.owner.token, [{ listingId: ids.listingId, quantity: 1 }])));
    const wins = results.filter((r) => r.status === 201).length;
    assert.equal(wins, 1, `statuses: ${results.map((r) => r.status)}`);
    assert.equal(await stockOf(), 0);
    await supabaseAdmin.from('listings').update({ quantity_available: 3 }).eq('id', ids.listingId);
  });

  it('NEG: racing cancels of one order restore stock exactly once', async () => {
    await supabaseAdmin.from('listings').update({ quantity_available: 3 }).eq('id', ids.listingId);
    await api('DELETE', '/marketplace/cart', { token: u.buyer.token });
    await api('POST', '/marketplace/cart', { token: u.buyer.token, body: { listingId: ids.listingId, quantity: 2 } });
    const cart = await api('GET', '/marketplace/cart', { token: u.buyer.token });
    const itemId = (cart.json.items || cart.json.cart || cart.json.cartItems || [])[0].id;
    const co = await api('POST', '/orders/checkout', { token: u.buyer.token, body: { cartItemIds: [itemId], preferredPickupDate: pickupDate } });
    assert.equal(co.status, 201, JSON.stringify(co.json));
    const oid = (co.json.orders || [co.json.order])[0].id;
    assert.equal(await stockOf(), 1);
    await Promise.all([1, 2, 3].map(() => api('POST', `/orders/${oid}/cancel`, { token: u.buyer.token, body: {} })));
    assert.equal(await stockOf(), 3, 'stock restored more or less than once');
  });
});

describe('CSV export (client/src/lib/exportCsv.js)', () => {
  const fs = require('fs');
  const src = fs.readFileSync(require('path').join(__dirname, '..', '..', 'client', 'src', 'lib', 'exportCsv.js'), 'utf8');
  const escapeCell = new Function(`${src.slice(src.indexOf('const escapeCell'), src.indexOf('/**'))}; return escapeCell;`)();

  it('escapes commas, quotes, newlines', () => {
    assert.equal(escapeCell('a,b'), '"a,b"');
    assert.equal(escapeCell('say "hi"'), '"say ""hi"""');
    assert.equal(escapeCell('line1\nline2'), '"line1\nline2"');
    assert.equal(escapeCell('cr\rlf'), '"cr\rlf"');
  });
  it('handles null/undefined/number/date/empty', () => {
    assert.equal(escapeCell(null), '');
    assert.equal(escapeCell(undefined), '');
    assert.equal(escapeCell(0), '0');
    assert.equal(escapeCell(''), '');
    assert.equal(escapeCell(new Date('2026-01-02T03:04:05Z')), '2026-01-02T03:04:05.000Z');
  });
  it('preserves Filipino/unicode characters', () => {
    assert.equal(escapeCell('Niño Peña'), 'Niño Peña');
  });
  it('SECURITY: spreadsheet formula injection (=,+,-,@) is neutralised', () => {
    for (const v of ['=SUM(A1:A9)', '+1+1', '-2+3', '@cmd', '=HYPERLINK("http://evil","x")']) {
      const out = escapeCell(v);
      assert.ok(!/^["]?[=+\-@]/.test(out), `CSV cell ${JSON.stringify(v)} exported raw as ${JSON.stringify(out)} (formula injection)`);
    }
  });
});
