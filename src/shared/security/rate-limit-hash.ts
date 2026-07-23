import { createHmac } from "node:crypto";

export function rateLimitHash(value: string, purpose: string, key: string) {
  return createHmac("sha256", key)
    .update(`sipeka:rate-limit:v1:${purpose}\0${value}`)
    .digest("hex");
}
