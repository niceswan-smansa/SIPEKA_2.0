import { describe, expect, it } from "vitest";

import { passwordPolicyReasons } from "./password-policy";

const vectors = [
  ["ValidPassword!1", true],
  ["short!A1", false],
  ["NOLOWERCASE!1", false],
  ["nouppercase!1", false],
  ["NoNumberHere!", false],
  ["NoSymbolHere1", false],
  ["            ", false],
  [`Aa1!${"x".repeat(125)}`, false],
] as const;

describe("password policy", () => {
  it.each(vectors)("validates %s consistently", (password, valid) => {
    expect(passwordPolicyReasons(password).length === 0).toBe(valid);
  });
});
