import "server-only";

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import WebSocket from "ws";
import type { WebSocketLikeConstructor } from "@supabase/realtime-js";

import type { Database } from "./database.types";

function getPublicConfiguration() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error("Konfigurasi publik Supabase belum tersedia.");
  }

  return { publishableKey, url };
}

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  const { publishableKey, url } = getPublicConfiguration();

  return createServerClient<Database, "public">(url, publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet: { name: string; value: string; options: CookieOptions }[]) => {
        try {
          for (const { name, options, value } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot write cookies; proxy.ts performs session refresh.
        }
      },
    },
    realtime: { transport: WebSocket as unknown as WebSocketLikeConstructor },
  });
}
