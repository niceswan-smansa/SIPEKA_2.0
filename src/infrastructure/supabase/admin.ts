import "server-only";

import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import type { WebSocketLikeConstructor } from "@supabase/realtime-js";

import type { Database } from "./database.types";

export function createAdminSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Konfigurasi server Supabase belum tersedia.");
  }

  return createClient<Database, "public">(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    realtime: { transport: WebSocket as unknown as WebSocketLikeConstructor },
  });
}
