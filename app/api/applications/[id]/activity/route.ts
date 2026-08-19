import { prisma } from "@/lib/prisma";
import { requireAuth, canAccessApplication } from "@/lib/permissions";
import { handleApiError, successResponse, errorResponse } from "@/lib/api-helpers";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: applicationId } = await params;

    const application = await prisma.application.findUnique({ where: { id: applicationId } });
    if (!application) return errorResponse("Application not found", 404);

    if (!canAccessApplication(user, application)) {
      return errorResponse("Access denied", 403);
    }

    const logs = await prisma.activityLog.findMany({
      where: { applicationId },
      include: {
        user: { select: { id: true, name: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return successResponse(logs);
  } catch (err) {
    return handleApiError(err);
  }
}
