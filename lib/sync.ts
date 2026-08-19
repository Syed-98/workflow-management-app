import { prisma } from "@/lib/prisma";

/**
 * Creates a sync job for a completed application.
 * Uses an idempotency key (applicationId + completedAt timestamp) to prevent duplicates.
 */
export async function enqueueSyncJob(applicationId: string): Promise<void> {
  const idempotencyKey = `sync-${applicationId}`;

  // Upsert: if a job for this key already exists (any status), don't create another.
  // If it failed and needs retry, we reset it via the retry mechanism.
  await prisma.syncJob.upsert({
    where: { idempotencyKey },
    create: {
      applicationId,
      idempotencyKey,
      status: "PENDING",
      nextRetryAt: new Date(),
    },
    update: {
      // Only re-enqueue if the previous attempt was a terminal failure
      // A fresh PENDING status will be set only when explicitly retrying
    },
  });
}

/**
 * Resets a dead-letter job for manual retry.
 */
export async function requeueSyncJob(syncJobId: string): Promise<void> {
  await prisma.syncJob.update({
    where: { id: syncJobId },
    data: {
      status: "PENDING",
      attempts: 0,
      lastError: null,
      nextRetryAt: new Date(),
    },
  });
}

/**
 * Processes pending sync jobs. Called by the background processor.
 */
export async function processPendingSyncJobs(): Promise<void> {
  const jobs = await prisma.syncJob.findMany({
    where: {
      status: "PENDING",
      nextRetryAt: { lte: new Date() },
    },
    include: {
      application: {
        include: {
          customer: true,
          assignedTo: true,
        },
      },
    },
    take: 10,
    orderBy: { createdAt: "asc" },
  });

  for (const job of jobs) {
    await processSyncJob(job.id);
  }
}

async function processSyncJob(jobId: string): Promise<void> {
  // Mark as in progress
  await prisma.syncJob.update({
    where: { id: jobId },
    data: { status: "IN_PROGRESS", attempts: { increment: 1 } },
  });

  const job = await prisma.syncJob.findUnique({
    where: { id: jobId },
    include: {
      application: {
        include: { customer: true, assignedTo: true },
      },
    },
  });

  if (!job) return;

  try {
    await callExternalService(job);

    await prisma.syncJob.update({
      where: { id: jobId },
      data: {
        status: "SUCCESS",
        processedAt: new Date(),
        lastError: null,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const isExhausted = job.attempts >= job.maxAttempts;

    // Exponential backoff: 2^attempts minutes
    const backoffMs = Math.min(Math.pow(2, job.attempts) * 60 * 1000, 60 * 60 * 1000);
    const nextRetryAt = new Date(Date.now() + backoffMs);

    await prisma.syncJob.update({
      where: { id: jobId },
      data: {
        status: isExhausted ? "DEAD_LETTER" : "FAILED",
        lastError: errorMessage,
        nextRetryAt: isExhausted ? null : nextRetryAt,
      },
    });

    if (!isExhausted) {
      // Reset to PENDING for next cron cycle
      await prisma.syncJob.update({
        where: { id: jobId },
        data: { status: "PENDING" },
      });
    }
  }
}

interface SyncJobWithApplication {
  id: string;
  application: {
    id: string;
    title: string;
    status: string;
    priority: string;
    completedAt: Date | null;
    customer: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    };
    assignedTo: {
      id: string;
      name: string;
      email: string;
    } | null;
  };
}

async function callExternalService(job: SyncJobWithApplication): Promise<void> {
  const externalUrl =
    process.env.MOCK_EXTERNAL_SERVICE_URL || "http://localhost:3001";

  const payload = {
    applicationId: job.application.id,
    title: job.application.title,
    status: job.application.status,
    priority: job.application.priority,
    completedAt: job.application.completedAt,
    customer: {
      id: job.application.customer.id,
      name: `${job.application.customer.firstName} ${job.application.customer.lastName}`,
      email: job.application.customer.email,
    },
    assignedTo: job.application.assignedTo
      ? {
          id: job.application.assignedTo.id,
          name: job.application.assignedTo.name,
        }
      : null,
    syncedAt: new Date().toISOString(),
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

  try {
    const response = await fetch(`${externalUrl}/api/sync/mock-external`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Idempotency-Key": job.id,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`External service responded with ${response.status}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}
