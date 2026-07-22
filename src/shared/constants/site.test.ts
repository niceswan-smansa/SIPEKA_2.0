import { describe, expect, it } from "vitest";

import { SITE_DESCRIPTION, SITE_NAME } from ".";

describe("site identity", () => {
  it("keeps the agreed product name and Indonesian description", () => {
    expect(SITE_NAME).toBe("SIPEKA");
    expect(SITE_DESCRIPTION).toBe("Sistem Presensi SMANSA Pamekasan");
  });
});
