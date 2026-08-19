import { prisma } from "@/lib/prisma";

export type ActivityAction =
  | "APPLICATION_CREATED"
  | "APPLICATION_UPDATED"
  | "APPLICATION_ASSIGNED"
  | "APPLICATION_REASSIGNED"
  | "STATUS_CHANGED"
  | "WORK_ITEM_CREATED"
  | "WORK_ITEM_UPDATED"
  | "WORK_ITEM_COMPLETED"
  | "WORK_ITEM_ASSIGNED"
  | "SYNC_STARTED"
  | "SYNC_COMPLETED"
  | "SYNC_FAILED";

export async function logActivity({
  applicationId,
  userId,
  action,
  description,
  metadata,
}: {
  applicationId: string;
  userId: string;
  action: ActivityAction;
  description: string;
  metadata?: Record<string, unknown>;
}) {
  await prisma.activityLog.create({
    data: {
      applicationId,
      userId,
      action,
      description,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });
}
