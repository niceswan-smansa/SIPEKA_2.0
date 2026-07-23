import { strict as assert } from "node:assert";

import { passwordPolicyReasons } from "./lib/password-policy.mjs";

const vectors = [
  ["ValidPassword!1", true],
  ["short!A1", false],
  ["NOLOWERCASE!1", false],
  ["nouppercase!1", false],
  ["NoNumberHere!", false],
  ["NoSymbolHere1", false],
  ["            ", false],
  [`Aa1!${"x".repeat(125)}`, false],
];

for (const [password, valid] of vectors)
  assert.equal(passwordPolicyReasons(password).length === 0, valid);
console.log("Tooling password policy vectors passed.");
