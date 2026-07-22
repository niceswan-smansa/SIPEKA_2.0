import type { AccountProfile } from "@/shared/permissions";

export const GENERIC_LOGIN_ERROR = "Username/email atau password tidak valid.";

export type LoginInput = {
  identifier: string;
  password: string;
};

export type AuthenticationResult =
  { ok: true; profile: AccountProfile } | { ok: false; message: typeof GENERIC_LOGIN_ERROR };

export interface AuthenticationGateway {
  resolveEmail(username: string): Promise<string | null>;
  signInWithPassword(email: string, password: string): Promise<string | null>;
  getProfile(userId: string): Promise<AccountProfile | null>;
  signOut(): Promise<void>;
  updatePassword(password: string): Promise<boolean>;
  completePasswordChange(profile: AccountProfile): Promise<boolean>;
}
