import { NextResponse } from "next/server";

/**
 * Mock external service endpoint.
 * Simulates real-world conditions: occasional failures, delays, and duplicate handling.
 */
export async function POST(req: Request) {
  const idempotencyKey = req.headers.get("x-idempotency-key");

  // Simulate occasional unavailability (10% chance)
  if (Math.random() < 0.1) {
    return NextResponse.json(
      { error: "Service temporarily unavailable" },
      { status: 503 }
    );
  }

  // Simulate slow responses (20% chance of 2-4s delay)
  if (Math.random() < 0.2) {
    await new Promise((r) => setTimeout(r, 2000 + Math.random() * 2000));
  }

  const body = await req.json();

  console.log("[Mock External Service] Received sync:", {
    idempotencyKey,
    applicationId: body.applicationId,
    syncedAt: new Date().toISOString(),
  });

  return NextResponse.json({
    success: true,
    externalId: `EXT-${Date.now()}`,
    receivedAt: new Date().toISOString(),
  });
}
