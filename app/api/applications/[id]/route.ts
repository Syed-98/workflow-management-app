import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, canAccessApplication } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { handleApiError, successResponse, errorResponse } from "@/lib/api-helpers";
import { Role } from "@prisma/client";

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  version: z.number().int().positive(), // required for optimistic locking
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const application = await prisma.application.findUnique({
      where: { id },
      include: {
        customer: true,
        assignedTo: { select: { id: true, name: true, email: true, role: true } },
        createdBy: { select: { id: true, name: true } },
        team: { select: { id: true, name: true } },
        workItems: {
          include: {
            assignedTo: { select: { id: true, name: true } },
            createdBy: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        activityLogs: {
          include: {
            user: { select: { id: true, name: true, role: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 50,
        },
        syncJobs: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
    });

    if (!application) return errorResponse("Application not found", 404);

    if (!canAccessApplication(user, application)) {
      return errorResponse("You do not have access to this application", 403);
    }

    return successResponse(application);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body = await req.json();
    const data = updateSchema.parse(body);

    const existing = await prisma.application.findUnique({ where: { id } });
    if (!existing) return errorResponse("Application not found", 404);

    if (!canAccessApplication(user, existing)) {
      return errorResponse("You do not have access to this application", 403);
    }

    // Optimistic locking: reject if version mismatch
    if (existing.version !== data.version) {
      return NextResponse.json(
        {
          error: "Conflict: this application was modified by another user. Please refresh and try again.",
          code: "VERSION_CONFLICT",
        },
        { status: 409 }
      );
    }

    const updated = await prisma.application.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description,
        priority: data.priority,
        version: { increment: 1 },
      },
      include: {
        customer: true,
        assignedTo: { select: { id: true, name: true, email: true } },
      },
    });

    await logActivity({
      applicationId: id,
      userId: user.id,
      action: "APPLICATION_UPDATED",
      description: `Application updated`,
      metadata: { changes: Object.keys(data).filter((k) => k !== "version") },
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

    if (user.role === Role.EXECUTIVE) {
      return errorResponse("Executives cannot delete applications", 403);
    }

    const existing = await prisma.application.findUnique({ where: { id } });
    if (!existing) return errorResponse("Application not found", 404);

    if (!canAccessApplication(user, existing)) {
      return errorResponse("You do not have access to this application", 403);
    }

    await prisma.application.delete({ where: { id } });

    return successResponse({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
