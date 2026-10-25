# Deploying GreenPlace (demo)

Stack: one Vercel project with two services (client + server, see root `vercel.json`) + Supabase (database/auth/storage) + PayMongo test mode. Client and API share one domain: `/api/*` goes to the Express server, everything else to the Vite client.

## 1. Supabase
1. Run `database/migrations/001`-`027` in order (both `027` files; there is no `007`).
2. Optional demo data: run `database/seeds/demo_data.sql` (needs at least one registered user).
3. **Change the seeded admin password** (`admin@greenplace.com`, seeded as `admin123456`) in Authentication > Users.
4. Copy Project URL, `anon` key and `service_role` key from Project Settings > API.

## 2. Vercel project
1. Import the GitHub repo at vercel.com > Add New > Project. Leave Root Directory as the repo root (`vercel.json` defines the services).
2. Environment variables (apply to all services; set before the first deploy):
   - `NODE_ENV=production`
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (the server refuses to start in production without the service key)
   - `PAYMONGO_SECRET_KEY` (`sk_test_...` only), `PAYMONGO_WEBHOOK_SECRET` (placeholder until step 4)
   - `CLIENT_URL` = placeholder `https://example.vercel.app` until step 4
   - `VITE_API_URL=/api`
   - `VITE_SUPABASE_URL` = Supabase project URL (shows the Google/Facebook buttons)
3. Deploy, then copy the project's production domain.

## 3. Wire it together
- Vercel: set `CLIENT_URL` to the production domain (exact origin, **no trailing slash**), then redeploy. It is used for CORS, the password-reset link and the PayMongo return URL.
- Supabase > Authentication > URL Configuration: Site URL = the Vercel domain; Redirect URLs include `<domain>/auth/callback` and `<domain>/reset-password`.

## 4. PayMongo webhook
PayMongo > Developers > Webhooks: `https://<domain>/api/payments/webhook`. Copy its signing secret into `PAYMONGO_WEBHOOK_SECRET` and redeploy.

## 5. Before presenting
- Open `https://<domain>/api/health`; it should return `status: ok`.
- Serverless request bodies are capped at about 4.5 MB on Vercel: use small images/documents when demoing uploads (the app allows up to 5 / 10 MB, which would fail).
- Smoke test: register, login, refresh on a deep link, browse marketplace, checkout in PayMongo test mode, admin approval.
- Password reset uses Supabase's built-in mailer, which is heavily rate-limited; avoid demoing it live.
- Auth routes allow 50 requests / 15 min per IP; a shared network may hit this.
