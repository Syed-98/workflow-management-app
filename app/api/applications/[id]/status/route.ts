import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, canAccessApplication } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { canChangeStatus } from "@/lib/workflow";
import { handleApiError, successResponse, errorResponse } from "@/lib/api-helpers";
import { enqueueSyncJob } from "@/lib/sync";
import { ApplicationStatus } from "@prisma/client";

const statusSchema = z.object({
  status: z.nativeEnum(ApplicationStatus),
  version: z.number().int().positive(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body = await req.json();
    const { status: newStatus, version } = statusSchema.parse(body);

    const application = await prisma.application.findUnique({ where: { id } });
    if (!application) return errorResponse("Application not found", 404);

    if (!canAccessApplication(user, application)) {
      return errorResponse("You do not have access to this application", 403);
    }

    // Optimistic lock check
    if (application.version !== version) {
      return errorResponse(
        "Conflict: this application was modified by another user. Please refresh.",
        409
      );
    }

    const { allowed, reason } = canChangeStatus(
      application.status,
      newStatus,
      user.role
    );

    if (!allowed) {
      return errorResponse(reason || "Transition not allowed", 422);
    }

    const isCompleting = newStatus === ApplicationStatus.COMPLETED;

    const updated = await prisma.application.update({
      where: { id },
      data: {
        status: newStatus,
        version: { increment: 1 },
        completedAt: isCompleting ? new Date() : undefined,
      },
    });

    await logActivity({
      applicationId: id,
      userId: user.id,
      action: "STATUS_CHANGED",
      description: `Status changed from ${application.status} to ${newStatus}`,
      metadata: { from: application.status, to: newStatus },
    });

    // Trigger async sync when application is completed
    // This is fire-and-forget from the API perspective;
    // sync failures do NOT affect this response
    if (isCompleting) {
      enqueueSyncJob(id).catch((err) => {
        console.error("[Sync] Failed to enqueue sync job:", err);
      });
    }

    return successResponse(updated);
  } catch (err) {
    return handleApiError(err);
  }
}
