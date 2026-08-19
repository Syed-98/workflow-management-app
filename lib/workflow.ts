import { ApplicationStatus, Role } from "@prisma/client";

/**
 * Defines valid workflow transitions.
 * Key = current status, Value = allowed next statuses.
 */
export const WORKFLOW_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  NEW: [ApplicationStatus.WAITING_FOR_INFORMATION, ApplicationStatus.IN_PROGRESS],
  WAITING_FOR_INFORMATION: [ApplicationStatus.IN_PROGRESS, ApplicationStatus.NEW],
  IN_PROGRESS: [ApplicationStatus.UNDER_REVIEW, ApplicationStatus.WAITING_FOR_INFORMATION],
  UNDER_REVIEW: [ApplicationStatus.COMPLETED, ApplicationStatus.IN_PROGRESS],
  COMPLETED: [ApplicationStatus.REOPENED],
  REOPENED: [ApplicationStatus.IN_PROGRESS, ApplicationStatus.WAITING_FOR_INFORMATION],
};

/**
 * Roles allowed to change application status.
 * ADMIN and MANAGER can always change status.
 * EXECUTIVE can only move forward (not complete or reopen).
 */
export const STATUS_CHANGE_PERMISSIONS: Record<ApplicationStatus, Role[]> = {
  NEW: [Role.ADMIN, Role.MANAGER, Role.EXECUTIVE],
  WAITING_FOR_INFORMATION: [Role.ADMIN, Role.MANAGER, Role.EXECUTIVE],
  IN_PROGRESS: [Role.ADMIN, Role.MANAGER, Role.EXECUTIVE],
  UNDER_REVIEW: [Role.ADMIN, Role.MANAGER, Role.EXECUTIVE],
  COMPLETED: [Role.ADMIN, Role.MANAGER], // only admin/manager can complete
  REOPENED: [Role.ADMIN, Role.MANAGER], // only admin/manager can reopen
};

export function canTransition(
  from: ApplicationStatus,
  to: ApplicationStatus
): boolean {
  return WORKFLOW_TRANSITIONS[from]?.includes(to) ?? false;
}

export function canChangeStatus(
  currentStatus: ApplicationStatus,
  newStatus: ApplicationStatus,
  userRole: Role
): { allowed: boolean; reason?: string } {
  if (!canTransition(currentStatus, newStatus)) {
    return {
      allowed: false,
      reason: `Cannot transition from ${currentStatus} to ${newStatus}. Valid transitions: ${WORKFLOW_TRANSITIONS[currentStatus].join(", ")}`,
    };
  }

  const allowedRoles = STATUS_CHANGE_PERMISSIONS[newStatus];
  if (!allowedRoles.includes(userRole)) {
    return {
      allowed: false,
      reason: `Your role (${userRole}) is not permitted to set status to ${newStatus}.`,
    };
  }

  return { allowed: true };
}

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  NEW: "New",
  WAITING_FOR_INFORMATION: "Waiting for Info",
  IN_PROGRESS: "In Progress",
  UNDER_REVIEW: "Under Review",
  COMPLETED: "Completed",
  REOPENED: "Reopened",
};

export const STATUS_COLORS: Record<ApplicationStatus, string> = {
  NEW: "bg-slate-100 text-slate-700",
  WAITING_FOR_INFORMATION: "bg-amber-100 text-amber-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  UNDER_REVIEW: "bg-purple-100 text-purple-700",
  COMPLETED: "bg-green-100 text-green-700",
  REOPENED: "bg-orange-100 text-orange-700",
};
