import { NextResponse } from "next/server";

import { dbIntentStore } from "@/lib/payments/db-store";
import { processWebhook } from "@/lib/payments/settle";

const MAX_BODY = 16_384;

async function readLimited(request: Request, max: number) {
  if (Number(request.headers.get("content-length") ?? 0) > max) return null;
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const parts: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      return null;
    }
    parts.push(value);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.byteLength;
  }
  return out;
}

/**
 * Gateways tell us about payments here. The provider verifies the signature; an intent
 * is completed once per gateway transaction and only for its exact amount.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  // Read at most MAX_BODY bytes, whatever Content-Length says (or a chunked body).
  const body = await readLimited(request, MAX_BODY);
  if (body === null)
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  try {
    const copy = new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body,
    });
    const r = await processWebhook(provider, copy, dbIntentStore());
    return NextResponse.json(r.body, { status: r.status });
  } catch (error) {
    console.error("Payment webhook failed", error);
    // 500 so the gateway tries again later.
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
