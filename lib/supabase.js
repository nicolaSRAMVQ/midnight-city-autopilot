// Calls the public RPCs defined in the Supabase project (schema `midnight`,
// wrappers `public.midnight_*`). Uses the publishable key: those functions
// validate their inputs and are the only thing the key can reach.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;

export async function rpc(name, args = {}) {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("missing SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY");
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    signal: AbortSignal.timeout(8_000),
    headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`supabase ${name} failed: HTTP ${response.status} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}
