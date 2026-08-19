import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, canAccessApplication } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { handleApiError, successResponse, errorResponse } from "@/lib/api-helpers";

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
  assignedToId: z.string().cuid().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body = await req.json();
    const data = updateSchema.parse(body);

    const workItem = await prisma.workItem.findUnique({
      where: { id },
      include: { application: true },
    });

    if (!workItem) return errorResponse("Work item not found", 404);

    if (!canAccessApplication(user, workItem.application)) {
      return errorResponse("You do not have access to this application", 403);
    }

    const isCompleting =
      data.status === "COMPLETED" && workItem.status !== "COMPLETED";

    const updated = await prisma.workItem.update({
      where: { id },
      data: {
        ...data,
        dueDate: data.dueDate ? new Date(data.dueDate) : data.dueDate,
        completedAt: isCompleting ? new Date() : undefined,
      },
      include: {
        assignedTo: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    const action = isCompleting ? "WORK_ITEM_COMPLETED" : "WORK_ITEM_UPDATED";
    await logActivity({
      applicationId: workItem.applicationId,
      userId: user.id,
      action,
      description: isCompleting
        ? `Work item "${updated.title}" completed`
        : `Work item "${updated.title}" updated`,
      metadata: { workItemId: id },
    });

    return successResponse(updated);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const workItem = await prisma.workItem.findUnique({
      where: { id },
      include: { application: true },
    });
    if (!workItem) return errorResponse("Work item not found", 404);

    if (!canAccessApplication(user, workItem.application)) {
      return errorResponse("You do not have access to this application", 403);
    }

    await prisma.workItem.delete({ where: { id } });

    await logActivity({
      applicationId: workItem.applicationId,
      userId: user.id,
      action: "WORK_ITEM_UPDATED",
      description: `Work item "${workItem.title}" deleted`,
      metadata: { workItemId: id },
    });

    return successResponse({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
