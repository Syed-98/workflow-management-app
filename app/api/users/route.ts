import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/permissions";
import { handleApiError, successResponse } from "@/lib/api-helpers";
import { Role } from "@prisma/client";
import { z } from "zod";
import bcrypt from "bcryptjs";

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.nativeEnum(Role),
  teamId: z.string().cuid().optional(),
});

export async function GET(req: Request) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(req.url);
    const teamId = searchParams.get("teamId");

    const where = {
      ...(teamId && { teamId }),
    };

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        teamId: true,
        team: { select: { id: true, name: true } },
        createdAt: true,
      },
      orderBy: { name: "asc" },
    });

    return successResponse(users);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireAuth();

    if (user.role !== Role.ADMIN) {
      return successResponse(null);
    }

    const body = await req.json();
    const data = createUserSchema.parse(body);

    const hashed = await bcrypt.hash(data.password, 12);

    const newUser = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashed,
        role: data.role,
        teamId: data.teamId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        teamId: true,
        createdAt: true,
      },
    });

    return successResponse(newUser, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
