import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, canAccessApplication } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { handleApiError, successResponse, errorResponse } from "@/lib/api-helpers";
import { Role } from "@prisma/client";

const assignSchema = z.object({
  assignedToId: z.string().cuid().nullable(),
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
    const { assignedToId, version } = assignSchema.parse(body);

    const application = await prisma.application.findUnique({ where: { id } });
    if (!application) return errorResponse("Application not found", 404);

    if (!canAccessApplication(user, application)) {
      return errorResponse("You do not have access to this application", 403);
    }

    // Executives cannot reassign applications
    if (user.role === Role.EXECUTIVE) {
      return errorResponse("Executives cannot assign or reassign applications", 403);
    }

    // Optimistic lock
    if (application.version !== version) {
      return errorResponse(
        "Conflict: this application was modified. Please refresh.",
        409
      );
    }

    if (assignedToId) {
      const assignee = await prisma.user.findUnique({ where: { id: assignedToId } });
      if (!assignee) return errorResponse("Assignee not found", 404);

      // Manager can only assign to team members
      if (user.role === Role.MANAGER && assignee.teamId !== user.teamId) {
        return errorResponse("You can only assign to members of your team", 403);
      }
    }

    const isReassign = !!application.assignedToId;

    const updated = await prisma.application.update({
      where: { id },
      data: {
        assignedToId,
        version: { increment: 1 },
      },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
      },
    });

    const assigneeName = updated.assignedTo?.name ?? "nobody";

    await logActivity({
      applicationId: id,
      userId: user.id,
      action: isReassign ? "APPLICATION_REASSIGNED" : "APPLICATION_ASSIGNED",
      description: isReassign
        ? `Application reassigned to ${assigneeName}`
        : `Application assigned to ${assigneeName}`,
      metadata: {
        previousAssignee: application.assignedToId,
        newAssignee: assignedToId,
      },
    });

    return successResponse(updated);
  } catch (err) {
    return handleApiError(err);
  }
}
