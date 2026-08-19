import { NextResponse } from "next/server";
import { processPendingSyncJobs } from "@/lib/sync";

// This endpoint is called by a cron job / scheduler
// Protected by a shared secret
export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET || "dev-cron-secret";

  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await processPendingSyncJobs();
    return NextResponse.json({ success: true, processedAt: new Date().toISOString() });
  } catch (error) {
    console.error("[Sync Processor]", error);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
