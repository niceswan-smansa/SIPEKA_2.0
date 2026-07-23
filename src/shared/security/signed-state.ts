import { createHmac, timingSafeEqual } from "node:crypto";

const MAX_TTL_SECONDS = 600;

type SignedState = { exp: number; purpose: string; userId: string };

function signature(payload: string, purpose: string, secret: string) {
  return createHmac("sha256", secret)
    .update(`sipeka:signed-state:v1:${purpose}\0${payload}`)
    .digest();
}

export function createSignedState(
  userId: string,
  purpose: string,
  secret: string,
  ttlSeconds = MAX_TTL_SECONDS,
) {
  if (!secret || ttlSeconds < 1 || ttlSeconds > MAX_TTL_SECONDS) throw new Error("INVALID_STATE");
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + ttlSeconds, purpose, userId }),
  ).toString("base64url");
  return `${payload}.${signature(payload, purpose, secret).toString("base64url")}`;
}

export function verifySignedState(
  token: string,
  expected: { purpose: string; userId: string },
  secret: string,
): boolean {
  if (!secret) return false;
  const [payload, encodedSignature, extra] = token.split(".");
  if (!payload || !encodedSignature || extra) return false;
  let state: SignedState;
  try {
    state = JSON.parse(Buffer.from(payload, "base64url").toString()) as SignedState;
  } catch {
    return false;
  }
  if (
    state.userId !== expected.userId ||
    state.purpose !== expected.purpose ||
    state.exp < Math.floor(Date.now() / 1000)
  )
    return false;
  const supplied = Buffer.from(encodedSignature, "base64url");
  const expectedSignature = signature(payload, expected.purpose, secret);
  return (
    supplied.length === expectedSignature.length && timingSafeEqual(supplied, expectedSignature)
  );
}
