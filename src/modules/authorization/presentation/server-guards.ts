import "server-only";

import { redirect } from "next/navigation";

import type { AccessKind } from "../domain/access";
import { decideAccess } from "../domain/access";
import {
  loadAccessContext,
  signOutCurrentSession,
} from "../infrastructure/supabase-authorization.repository";

export async function requirePageAccess(kind: AccessKind) {
  const context = await loadAccessContext();
  const decision = decideAccess(context, kind);

  if (decision.type === "LOGOUT") {
    await signOutCurrentSession();
    redirect(decision.redirectTo);
  }

  if (decision.type === "REDIRECT") redirect(decision.redirectTo);
  if (decision.type === "FORBIDDEN") redirect("/dashboard");

  return context.profile!;
}

export async function authorizeRequest(kind: AccessKind) {
  const context = await loadAccessContext();
  return { context, decision: decideAccess(context, kind) };
}
