import { NextResponse } from "next/server";

import { dbIntentStore } from "@/lib/payments/db-store";
import { processWebhook } from "@/lib/payments/settle";

const MAX_BODY = 16_384;

/**
 * Gateways tell us about payments here. The provider verifies the signature; an intent
 * is completed once per gateway transaction and only for its exact amount.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY)
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  try {
    const r = await processWebhook(provider, request, dbIntentStore());
    return NextResponse.json(r.body, { status: r.status });
  } catch (error) {
    console.error("Payment webhook failed", error);
    // 500 so the gateway tries again later.
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
