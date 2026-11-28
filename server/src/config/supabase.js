const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables');
}

if (process.env.NODE_ENV === 'production' && !supabaseServiceKey) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
}

// Shared by every request, so it must never hold a user session of its own:
// pass tokens explicitly (getUser(token)) and use supabaseAdmin for per-user changes.
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const supabaseAdmin = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : supabase;

module.exports = { supabase, supabaseAdmin };
