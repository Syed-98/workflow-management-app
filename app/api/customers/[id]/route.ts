import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/permissions";
import { handleApiError, successResponse, errorResponse } from "@/lib/api-helpers";
import { Role } from "@prisma/client";

const updateSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        applications: {
          include: {
            assignedTo: { select: { id: true, name: true } },
            _count: { select: { workItems: true } },
          },
          orderBy: { updatedAt: "desc" },
        },
      },
    });

    if (!customer) return errorResponse("Customer not found", 404);
    return successResponse(customer);
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

    if (user.role === Role.EXECUTIVE) {
      return errorResponse("Executives cannot edit customer details", 403);
    }

    const body = await req.json();
    const data = updateSchema.parse(body);

    const customer = await prisma.customer.update({ where: { id }, data });
    return successResponse(customer);
  } catch (err) {
    return handleApiError(err);
  }
}
