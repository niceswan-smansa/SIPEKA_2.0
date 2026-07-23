import { describe, expect, it } from "vitest";

import { classDisplayName } from "../domain/classes";

describe("class rules", () => {
  it("derives fixed display names", () => {
    expect(classDisplayName("XI", 3)).toBe("XI-3");
    expect(() => classDisplayName("X", 0)).toThrow("CLASS_NUMBER_INVALID");
    expect(() => classDisplayName("X", 11)).toThrow("CLASS_NUMBER_INVALID");
  });
});
