import { Role } from "@prisma/client";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  teamId: string | null;
}

export async function requireAuth(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new AuthError("Unauthorized", 401);
  }
  return session.user as SessionUser;
}

export async function requireRole(
  allowedRoles: Role[]
): Promise<SessionUser> {
  const user = await requireAuth();
  if (!allowedRoles.includes(user.role)) {
    throw new AuthError("Forbidden: insufficient permissions", 403);
  }
  return user;
}

export class AuthError extends Error {
  constructor(
    message: string,
    public statusCode: number = 401
  ) {
    super(message);
  }
}

export function withAuth<T>(
  handler: (req: Request, context: T, user: SessionUser) => Promise<Response>,
  options?: { roles?: Role[] }
) {
  return async (req: Request, context: T): Promise<Response> => {
    try {
      const user = options?.roles
        ? await requireRole(options.roles)
        : await requireAuth();
      return handler(req, context, user);
    } catch (err) {
      if (err instanceof AuthError) {
        return NextResponse.json({ error: err.message }, { status: err.statusCode });
      }
      throw err;
    }
  };
}

/**
 * Can a user access a given application?
 * - ADMIN: all applications
 * - MANAGER: applications belonging to their team OR assigned to them
 * - EXECUTIVE: only applications assigned to them
 */
export function canAccessApplication(
  user: SessionUser,
  application: { assignedToId: string | null; teamId: string | null }
): boolean {
  if (user.role === Role.ADMIN) return true;
  if (user.role === Role.MANAGER) {
    return (
      application.teamId === user.teamId ||
      application.assignedToId === user.id
    );
  }
  // EXECUTIVE
  return application.assignedToId === user.id;
}

export function buildApplicationFilter(user: SessionUser) {
  if (user.role === Role.ADMIN) return {};
  if (user.role === Role.MANAGER) {
    return {
      OR: [
        { teamId: user.teamId },
        { assignedToId: user.id },
      ],
    };
  }
  // EXECUTIVE sees only their own
  return { assignedToId: user.id };
}
