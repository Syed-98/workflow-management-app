import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, canAccessApplication } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { handleApiError, successResponse, errorResponse } from "@/lib/api-helpers";

const createWorkItemSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  assignedToId: z.string().cuid().optional(),
  dueDate: z.string().datetime().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: applicationId } = await params;
    const body = await req.json();
    const data = createWorkItemSchema.parse(body);

    const application = await prisma.application.findUnique({ where: { id: applicationId } });
    if (!application) return errorResponse("Application not found", 404);

    if (!canAccessApplication(user, application)) {
      return errorResponse("You do not have access to this application", 403);
    }

    if (application.status === "COMPLETED") {
      return errorResponse("Cannot add work items to a completed application", 422);
    }

    if (data.assignedToId) {
      const assignee = await prisma.user.findUnique({ where: { id: data.assignedToId } });
      if (!assignee) return errorResponse("Assignee not found", 404);
    }

    const workItem = await prisma.workItem.create({
      data: {
        title: data.title,
        description: data.description,
        applicationId,
        assignedToId: data.assignedToId,
        createdById: user.id,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      },
      include: {
        assignedTo: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    await logActivity({
      applicationId,
      userId: user.id,
      action: "WORK_ITEM_CREATED",
      description: `Work item "${workItem.title}" created`,
      metadata: { workItemId: workItem.id },
    });

    return successResponse(workItem, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
