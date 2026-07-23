"use client";

import { Alert, Button } from "@/shared/ui";

export default function OperationalError({ reset }: { reset: () => void }) {
  return (
    <Alert tone="error">
      <p>Data operasional tidak dapat dimuat.</p>
      <Button type="button" className="mt-3" onClick={reset}>
        Coba lagi
      </Button>
    </Alert>
  );
}
