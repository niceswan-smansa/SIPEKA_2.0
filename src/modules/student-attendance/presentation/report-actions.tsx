"use client";

import { Button } from "@/shared/ui";

export function PrintButton() {
  return (
    <Button type="button" onClick={() => window.print()}>
      Cetak / Simpan PDF
    </Button>
  );
}
