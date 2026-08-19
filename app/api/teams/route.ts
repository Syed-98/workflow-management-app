import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { handleApiError, successResponse } from "@/lib/api-helpers";
import { Role } from "@prisma/client";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1).max(100),
  managerId: z.string().cuid().optional(),
});

export async function GET(_req: Request) {
  try {
    await requireRole([Role.ADMIN, Role.MANAGER]);

    const teams = await prisma.team.findMany({
      include: {
        members: { select: { id: true, name: true, role: true } },
        _count: { select: { applications: true } },
      },
      orderBy: { name: "asc" },
    });

    return successResponse(teams);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    await requireRole([Role.ADMIN]);
    const body = await req.json();
    const data = createSchema.parse(body);

    const team = await prisma.team.create({
      data,
      include: { members: true },
    });

    return successResponse(team, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
