import {
  GENERIC_LOGIN_ERROR,
  type AuthenticationGateway,
  type AuthenticationResult,
  type LoginInput,
} from "../domain/authentication";

export async function authenticateUser(
  gateway: AuthenticationGateway,
  input: LoginInput,
): Promise<AuthenticationResult> {
  const identifier = input.identifier.trim().toLowerCase();

  if (!identifier || !input.password || identifier.length > 254 || input.password.length > 256) {
    return { message: GENERIC_LOGIN_ERROR, ok: false };
  }

  try {
    const authIdentity = await gateway.resolveAuthIdentity(identifier);
    if (!authIdentity) return { message: GENERIC_LOGIN_ERROR, ok: false };

    const userId = await gateway.signInWithPassword(authIdentity, input.password);
    if (!userId) return { message: GENERIC_LOGIN_ERROR, ok: false };

    const profile = await gateway.getProfile(userId);
    if (!profile?.isActive) {
      await gateway.signOut();
      return { message: GENERIC_LOGIN_ERROR, ok: false };
    }

    await gateway.recordLogin(userId).catch(() => undefined);

    return { ok: true, profile };
  } catch {
    await gateway.signOut().catch(() => undefined);
    return { message: GENERIC_LOGIN_ERROR, ok: false };
  }
}
