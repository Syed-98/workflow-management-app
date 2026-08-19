import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, buildApplicationFilter } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { handleApiError, successResponse, errorResponse } from "@/lib/api-helpers";
import { Role } from "@prisma/client";
import { buildCustomerRelationSearchWhere } from "@/lib/search";

const createSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  customerId: z.string().cuid(),
  assignedToId: z.string().cuid().optional(),
  teamId: z.string().cuid().optional(),
});

export async function GET(req: Request) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(req.url);

    const status = searchParams.get("status");
    const priority = searchParams.get("priority");
    const assignedToId = searchParams.get("assignedToId");
    const customerId = searchParams.get("customerId");
    const search = searchParams.get("search");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const pageSize = Math.min(50, parseInt(searchParams.get("pageSize") || "20"));

    const accessFilter = buildApplicationFilter(user);

    const where = {
      ...accessFilter,
      ...(status && { status: status as never }),
      ...(priority && { priority: priority as never }),
      ...(assignedToId && { assignedToId }),
      ...(customerId && { customerId }),
      ...(search && {
        OR: [
          { title: { contains: search } },
          { description: { contains: search } },
          {
            customer: buildCustomerRelationSearchWhere(search),
          },
        ],
      }),
    };

    const [applications, total] = await Promise.all([
      prisma.application.findMany({
        where,
        include: {
          customer: { select: { id: true, firstName: true, lastName: true, email: true } },
          assignedTo: { select: { id: true, name: true, email: true, role: true } },
          createdBy: { select: { id: true, name: true } },
          team: { select: { id: true, name: true } },
          _count: { select: { workItems: true, activityLogs: true } },
        },
        orderBy: [
          { priority: "desc" },
          { updatedAt: "desc" },
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.application.count({ where }),
    ]);

    return successResponse({
      applications,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireAuth();
    const body = await req.json();
    const data = createSchema.parse(body);

    // Validate customer exists
    const customer = await prisma.customer.findUnique({ where: { id: data.customerId } });
    if (!customer) return errorResponse("Customer not found", 404);

    // If assignedToId provided, validate the user exists and determine team
    let teamId = data.teamId;
    if (data.assignedToId) {
      const assignee = await prisma.user.findUnique({ where: { id: data.assignedToId } });
      if (!assignee) return errorResponse("Assignee not found", 404);
      if (!teamId && assignee.teamId) teamId = assignee.teamId;
    }

    // Executives can only create applications within their team
    if (user.role === Role.EXECUTIVE && teamId && teamId !== user.teamId) {
      return errorResponse("You can only create applications for your team.", 403);
    }

    const application = await prisma.application.create({
      data: {
        title: data.title,
        description: data.description,
        priority: data.priority,
        customerId: data.customerId,
        assignedToId: data.assignedToId,
        createdById: user.id,
        teamId: teamId ?? user.teamId,
      },
      include: {
        customer: true,
        assignedTo: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    await logActivity({
      applicationId: application.id,
      userId: user.id,
      action: "APPLICATION_CREATED",
      description: `Application "${application.title}" created`,
      metadata: { priority: application.priority, customerId: application.customerId },
    });

    if (application.assignedToId) {
      await logActivity({
        applicationId: application.id,
        userId: user.id,
        action: "APPLICATION_ASSIGNED",
        description: `Application assigned to ${application.assignedTo?.name}`,
        metadata: { assignedToId: application.assignedToId },
      });
    }

    return successResponse(application, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
