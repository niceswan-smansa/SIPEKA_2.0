import "server-only";

import { createAdminSupabaseClient } from "@/infrastructure/supabase/admin";
import { rateLimitHash } from "./rate-limit-hash";

function secret() {
  const configured = process.env.RATE_LIMIT_SECRET;
  if (configured) return configured;
  if (process.env.NODE_ENV !== "production") return "local-test-rate-limit-secret";
  return null;
}

export async function allowRateLimited(
  value: string,
  scope: "login-address" | "login-account",
  limit = 8,
  windowSeconds = 60,
) {
  const key = secret();
  if (!key) return false;
  const client = createAdminSupabaseClient();
  const { data, error } = await client.rpc("consume_auth_rate_limit", {
    p_key_hash: rateLimitHash(value, scope, key),
    p_scope: scope,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  return !error && data === true;
}
