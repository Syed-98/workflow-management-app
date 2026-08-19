"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { LoadingSpinner, EmptyState } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { StatusBadge, PriorityBadge, RoleBadge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Input, Textarea, Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { WORKFLOW_TRANSITIONS, STATUS_LABELS, canChangeStatus } from "@/lib/workflow";
import { ApplicationStatus } from "@prisma/client";
import { formatDistanceToNow, format } from "date-fns";
import {
  ArrowLeft,
  UserCheck,
  RefreshCw,
  ClipboardList,
  Clock,
  ChevronRight,
  Plus,
  Edit2,
} from "lucide-react";

interface Application {
  id: string;
  title: string;
  description: string | null;
  status: ApplicationStatus;
  priority: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  customer: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    company: string | null;
  };
  assignedTo: { id: string; name: string; email: string; role: string } | null;
  createdBy: { id: string; name: string };
  team: { id: string; name: string } | null;
  workItems: WorkItem[];
  activityLogs: ActivityLog[];
  syncJobs: SyncJob[];
}

interface WorkItem {
  id: string;
  title: string;
  description: string | null;
  status: string;
  dueDate: string | null;
  completedAt: string | null;
  assignedTo: { id: string; name: string } | null;
  createdBy: { id: string; name: string };
  createdAt: string;
}

interface ActivityLog {
  id: string;
  action: string;
  description: string;
  createdAt: string;
  user: { id: string; name: string; role: string };
}

interface SyncJob {
  id: string;
  status: string;
  attempts: number;
  lastError: string | null;
  createdAt: string;
  processedAt: string | null;
}

interface User {
  id: string;
  name: string;
  role: string;
}

interface CurrentUser {
  id: string;
  role: string;
  teamId: string | null;
}

export default function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { toast } = useToast();

  const [appId, setAppId] = useState<string>("");
  const [application, setApplication] = useState<Application | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"details" | "workitems" | "activity" | "sync">("details");

  // Modal states
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showWorkItemModal, setShowWorkItemModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const [assignToId, setAssignToId] = useState("");
  const [targetStatus, setTargetStatus] = useState<ApplicationStatus | "">("");
  const [workItemForm, setWorkItemForm] = useState({ title: "", description: "", assignedToId: "" });
  const [editForm, setEditForm] = useState({ title: "", description: "", priority: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    params.then((p) => setAppId(p.id));
  }, [params]);

  const loadData = useCallback(async () => {
    if (!appId) return;
    setLoading(true);
    try {
      const [appRes, userRes, sessionRes] = await Promise.all([
        fetch(`/api/applications/${appId}`),
        fetch("/api/users"),
        fetch("/api/auth/session"),
      ]);

      const [appJson, userJson, sessionJson] = await Promise.all([
        appRes.json(),
        userRes.json(),
        sessionRes.json(),
      ]);

      if (appRes.ok) setApplication(appJson.data);
      if (userRes.ok) setUsers(userJson.data || []);
      if (sessionJson?.user) setCurrentUser(sessionJson.user);
    } finally {
      setLoading(false);
    }
  }, [appId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleStatusChange() {
    if (!application || !targetStatus) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/applications/${appId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: targetStatus, version: application.version }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast(json.error || "Failed to update status", "error");
        return;
      }
      toast("Status updated", "success");
      setShowStatusModal(false);
      loadData();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAssign() {
    if (!application) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/applications/${appId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignedToId: assignToId || null,
          version: application.version,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast(json.error || "Failed to assign", "error");
        return;
      }
      toast("Application assigned", "success");
      setShowAssignModal(false);
      loadData();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateWorkItem() {
    if (!workItemForm.title) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/applications/${appId}/work-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...workItemForm,
          assignedToId: workItemForm.assignedToId || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast(json.error || "Failed to create work item", "error");
        return;
      }
      toast("Work item created", "success");
      setShowWorkItemModal(false);
      setWorkItemForm({ title: "", description: "", assignedToId: "" });
      loadData();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdateWorkItemStatus(workItemId: string, status: string) {
    const res = await fetch(`/api/work-items/${workItemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      toast("Work item updated", "success");
      loadData();
    }
  }

  async function handleEdit() {
    if (!application) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/applications/${appId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...editForm, version: application.version }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast(json.error || "Failed to update", "error");
        return;
      }
      toast("Application updated", "success");
      setShowEditModal(false);
      loadData();
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <LoadingSpinner />;
  if (!application) return <EmptyState title="Application not found" />;

  const validNextStatuses = WORKFLOW_TRANSITIONS[application.status] || [];
  const isAdmin = currentUser?.role === "ADMIN";
  const isManager = currentUser?.role === "MANAGER";
  const canAssign = isAdmin || isManager;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4 text-sm text-slate-500">
        <Link href="/applications" className="hover:text-slate-700 flex items-center gap-1">
          <ArrowLeft size={14} />
          Applications
        </Link>
        <ChevronRight size={14} />
        <span className="text-slate-900 font-medium">{application.title}</span>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{application.title}</h1>
          <div className="flex items-center gap-2 mt-2">
            <StatusBadge status={application.status} />
            <PriorityBadge priority={application.priority as never} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canAssign && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setAssignToId(application.assignedTo?.id || "");
                setShowAssignModal(true);
              }}
            >
              <UserCheck size={14} className="mr-1.5" />
              {application.assignedTo ? "Reassign" : "Assign"}
            </Button>
          )}
          {validNextStatuses.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowStatusModal(true)}
            >
              <RefreshCw size={14} className="mr-1.5" />
              Change Status
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setEditForm({
                title: application.title,
                description: application.description || "",
                priority: application.priority,
              });
              setShowEditModal(true);
            }}
          >
            <Edit2 size={14} />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main content */}
        <div className="col-span-2 space-y-4">
          {/* Tabs */}
          <div className="border-b glass-divider flex gap-4">
            {(["details", "workitems", "activity", "sync"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? "border-slate-900 text-slate-900"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                {tab === "workitems" ? "Work Items" : tab.charAt(0).toUpperCase() + tab.slice(1)}
                {tab === "workitems" && (
                  <span className="ml-1.5 text-xs text-slate-400">({application.workItems.length})</span>
                )}
              </button>
            ))}
          </div>

          {activeTab === "details" && (
            <div className="glass-panel p-5">
              {application.description ? (
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{application.description}</p>
              ) : (
                <p className="text-sm text-slate-400 italic">No description provided.</p>
              )}
            </div>
          )}

          {activeTab === "workitems" && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-slate-900">Work Items</h3>
                {application.status !== "COMPLETED" && (
                  <Button size="sm" variant="outline" onClick={() => setShowWorkItemModal(true)}>
                    <Plus size={14} className="mr-1" />
                    Add Item
                  </Button>
                )}
              </div>

              {application.workItems.length === 0 ? (
                <EmptyState
                  icon={ClipboardList}
                  title="No work items"
                  description="Add work items to track progress on this application."
                />
              ) : (
                <div className="space-y-2">
                  {application.workItems.map((item) => (
                    <div
                      key={item.id}
                      className="glass-panel p-4"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <button
                            onClick={() =>
                              item.status !== "COMPLETED" &&
                              handleUpdateWorkItemStatus(item.id, "COMPLETED")
                            }
                            className={`mt-0.5 h-4 w-4 rounded border shrink-0 flex items-center justify-center transition-colors ${
                              item.status === "COMPLETED"
                                ? "bg-green-500 border-green-500 text-white"
                                : "border-slate-300 hover:border-slate-400"
                            }`}
                          >
                            {item.status === "COMPLETED" && (
                              <svg viewBox="0 0 12 12" className="w-3 h-3 fill-current">
                                <path d="M10 3L5 8.5L2 5.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </button>
                          <div>
                            <p className={`text-sm font-medium ${item.status === "COMPLETED" ? "line-through text-slate-400" : "text-slate-900"}`}>
                              {item.title}
                            </p>
                            {item.description && (
                              <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>
                            )}
                            <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                              {item.assignedTo && <span>→ {item.assignedTo.name}</span>}
                              {item.dueDate && (
                                <span className="flex items-center gap-1">
                                  <Clock size={11} />
                                  {format(new Date(item.dueDate), "MMM d")}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {item.status !== "COMPLETED" && (
                            <Select
                              options={[
                                { value: "PENDING", label: "Pending" },
                                { value: "IN_PROGRESS", label: "In Progress" },
                                { value: "COMPLETED", label: "Completed" },
                                { value: "CANCELLED", label: "Cancelled" },
                              ]}
                              value={item.status}
                              onChange={(e) => handleUpdateWorkItemStatus(item.id, e.target.value)}
                              className="w-32 h-7 text-xs"
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "activity" && (
            <div className="glass-panel divide-y divide-slate-50">
              {application.activityLogs.length === 0 ? (
                <EmptyState icon={Clock} title="No activity yet" />
              ) : (
                application.activityLogs.map((log) => (
                  <div key={log.id} className="px-4 py-3 flex items-start gap-3">
                    <div className="mt-0.5 h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center text-xs font-medium text-slate-600 shrink-0">
                      {log.user.name.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-slate-700">{log.description}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {log.user.name} · <RoleBadge role={log.user.role} />{" · "}
                        {format(new Date(log.createdAt), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === "sync" && (
            <div className="glass-panel divide-y divide-slate-50">
              {application.syncJobs.length === 0 ? (
                <EmptyState title="No sync jobs" description="Sync jobs are created when an application is completed." />
              ) : (
                application.syncJobs.map((job) => (
                  <div key={job.id} className="px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span
                          className={`text-xs font-medium ${
                            job.status === "SUCCESS"
                              ? "text-green-700"
                              : job.status === "DEAD_LETTER"
                              ? "text-red-700"
                              : job.status === "FAILED"
                              ? "text-amber-700"
                              : "text-slate-700"
                          }`}
                        >
                          {job.status}
                        </span>
                        <span className="ml-2 text-xs text-slate-400">
                          {job.attempts} attempt{job.attempts !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400">
                        {format(new Date(job.createdAt), "MMM d, h:mm a")}
                      </span>
                    </div>
                    {job.lastError && (
                      <p className="text-xs text-red-600 mt-1">{job.lastError}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="glass-panel p-4">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Details</h3>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-slate-500">Customer</dt>
                <dd className="font-medium text-slate-900 mt-0.5">
                  <Link href={`/customers/${application.customer.id}`} className="hover:underline">
                    {application.customer.firstName} {application.customer.lastName}
                  </Link>
                  <p className="text-xs text-slate-400 font-normal">{application.customer.email}</p>
                  {application.customer.company && (
                    <p className="text-xs text-slate-400 font-normal">{application.customer.company}</p>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Assigned To</dt>
                <dd className="font-medium text-slate-900 mt-0.5">
                  {application.assignedTo ? (
                    <>
                      {application.assignedTo.name}
                      <p className="text-xs text-slate-400 font-normal">{application.assignedTo.email}</p>
                    </>
                  ) : (
                    <span className="text-slate-400 font-normal">Unassigned</span>
                  )}
                </dd>
              </div>
              {application.team && (
                <div>
                  <dt className="text-slate-500">Team</dt>
                  <dd className="font-medium text-slate-900 mt-0.5">{application.team.name}</dd>
                </div>
              )}
              <div>
                <dt className="text-slate-500">Created By</dt>
                <dd className="text-slate-900 mt-0.5">{application.createdBy.name}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Created</dt>
                <dd className="text-slate-900 mt-0.5">{format(new Date(application.createdAt), "MMM d, yyyy")}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Last Updated</dt>
                <dd className="text-slate-900 mt-0.5">
                  {formatDistanceToNow(new Date(application.updatedAt), { addSuffix: true })}
                </dd>
              </div>
              {application.completedAt && (
                <div>
                  <dt className="text-slate-500">Completed</dt>
                  <dd className="text-slate-900 mt-0.5">{format(new Date(application.completedAt), "MMM d, yyyy")}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Work items progress */}
          {application.workItems.length > 0 && (
            <div className="glass-panel p-4">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Progress</h3>
              {(() => {
                const completed = application.workItems.filter((w) => w.status === "COMPLETED").length;
                const total = application.workItems.length;
                const pct = Math.round((completed / total) * 100);
                return (
                  <>
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-slate-500">{completed}/{total} tasks</span>
                      <span className="font-medium text-slate-900">{pct}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-slate-900 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>
      </div>

      {/* Status Modal */}
      <Dialog
        open={showStatusModal}
        onClose={() => setShowStatusModal(false)}
        title="Change Status"
        description="Select the new status for this application."
      >
        <div className="space-y-2 mb-4">
          {validNextStatuses.map((s) => {
            const check = currentUser
              ? canChangeStatus(application.status, s, currentUser.role as never)
              : { allowed: false };
            return (
              <button
                key={s}
                disabled={!check.allowed}
                onClick={() => setTargetStatus(s)}
                className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                  targetStatus === s
                    ? "border-slate-900 bg-slate-50"
                    : check.allowed
                    ? "border-slate-200 hover:border-slate-300"
                    : "border-slate-100 opacity-40 cursor-not-allowed"
                }`}
              >
                <div className="text-sm font-medium">{STATUS_LABELS[s]}</div>
                {!check.allowed && check.reason && (
                  <div className="text-xs text-red-500 mt-0.5">{check.reason}</div>
                )}
              </button>
            );
          })}
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleStatusChange}
            disabled={!targetStatus}
            loading={submitting}
            className="flex-1"
          >
            Update Status
          </Button>
          <Button variant="ghost" onClick={() => setShowStatusModal(false)}>
            Cancel
          </Button>
        </div>
      </Dialog>

      {/* Assign Modal */}
      <Dialog
        open={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        title="Assign Application"
      >
        <div className="space-y-4">
          <Select
            label="Assign To"
            value={assignToId}
            onChange={(e) => setAssignToId(e.target.value)}
            options={[
              { value: "", label: "Unassigned" },
              ...users.map((u) => ({ value: u.id, label: `${u.name} (${u.role.toLowerCase()})` })),
            ]}
          />
          <div className="flex gap-2">
            <Button onClick={handleAssign} loading={submitting} className="flex-1">
              Assign
            </Button>
            <Button variant="ghost" onClick={() => setShowAssignModal(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Work Item Modal */}
      <Dialog
        open={showWorkItemModal}
        onClose={() => setShowWorkItemModal(false)}
        title="Add Work Item"
      >
        <div className="space-y-4">
          <Input
            label="Title"
            value={workItemForm.title}
            onChange={(e) => setWorkItemForm({ ...workItemForm, title: e.target.value })}
            placeholder="Work item title"
            required
          />
          <Textarea
            label="Description"
            value={workItemForm.description}
            onChange={(e) => setWorkItemForm({ ...workItemForm, description: e.target.value })}
            placeholder="Optional description..."
          />
          <Select
            label="Assign To"
            value={workItemForm.assignedToId}
            onChange={(e) => setWorkItemForm({ ...workItemForm, assignedToId: e.target.value })}
            options={[
              { value: "", label: "Unassigned" },
              ...users.map((u) => ({ value: u.id, label: u.name })),
            ]}
          />
          <div className="flex gap-2">
            <Button
              onClick={handleCreateWorkItem}
              loading={submitting}
              disabled={!workItemForm.title}
              className="flex-1"
            >
              Add Work Item
            </Button>
            <Button variant="ghost" onClick={() => setShowWorkItemModal(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Edit Modal */}
      <Dialog
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Application"
      >
        <div className="space-y-4">
          <Input
            label="Title"
            value={editForm.title}
            onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
          />
          <Textarea
            label="Description"
            value={editForm.description}
            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
            rows={4}
          />
          <Select
            label="Priority"
            value={editForm.priority}
            onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
            options={[
              { value: "LOW", label: "Low" },
              { value: "MEDIUM", label: "Medium" },
              { value: "HIGH", label: "High" },
              { value: "URGENT", label: "Urgent" },
            ]}
          />
          <div className="flex gap-2">
            <Button onClick={handleEdit} loading={submitting} className="flex-1">
              Save Changes
            </Button>
            <Button variant="ghost" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
