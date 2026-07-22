import { NextResponse } from "next/server";

import { authorizeRequest } from "@/modules/authorization";

export async function POST() {
  const { decision } = await authorizeRequest("ADMIN_MUTATION");

  if (decision.type !== "ALLOW") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  return new NextResponse(null, { status: 204 });
}
