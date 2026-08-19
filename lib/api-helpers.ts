import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function successResponse<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

export function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function handleApiError(error: unknown): NextResponse {
  console.error("[API Error]", error);

  if (error instanceof ZodError) {
    return errorResponse(
      error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; "),
      422
    );
  }

  if (error instanceof Error) {
    // Prisma unique constraint
    if (error.message.includes("Unique constraint")) {
      return errorResponse("A record with this value already exists.", 409);
    }
    if (error.message.includes("Record to update not found")) {
      return errorResponse("Record not found.", 404);
    }
    return errorResponse(error.message, 500);
  }

  return errorResponse("An unexpected error occurred.", 500);
}
