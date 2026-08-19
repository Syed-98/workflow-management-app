"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { PageHeader, EmptyState, LoadingSpinner } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { StatusBadge, PriorityBadge } from "@/components/ui/badge";
import { Plus, FolderKanban, Search } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Application {
  id: string;
  title: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  customer: { firstName: string; lastName: string; email: string };
  assignedTo: { name: string } | null;
  team: { name: string } | null;
  _count: { workItems: number };
}

const statusOptions = [
  { value: "", label: "All Statuses" },
  { value: "NEW", label: "New" },
  { value: "WAITING_FOR_INFORMATION", label: "Waiting for Info" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "UNDER_REVIEW", label: "Under Review" },
  { value: "COMPLETED", label: "Completed" },
  { value: "REOPENED", label: "Reopened" },
];

const priorityOptions = [
  { value: "", label: "All Priorities" },
  { value: "URGENT", label: "Urgent" },
  { value: "HIGH", label: "High" },
  { value: "MEDIUM", label: "Medium" },
  { value: "LOW", label: "Low" },
];

export default function ApplicationsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [applications, setApplications] = useState<Application[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [status, setStatus] = useState(searchParams.get("status") || "");
  const [priority, setPriority] = useState(searchParams.get("priority") || "");

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (status) params.set("status", status);
      if (priority) params.set("priority", priority);
      params.set("page", page.toString());

      const res = await fetch(`/api/applications?${params}`);
      const json = await res.json();
      if (json.data) {
        setApplications(json.data.applications);
        setTotal(json.data.pagination.total);
      }
    } finally {
      setLoading(false);
    }
  }, [search, status, priority, page]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  return (
    <div>
      <PageHeader
        title="Applications"
        description={`${total} total application${total !== 1 ? "s" : ""}`}
        actions={
          <Link href="/applications/new">
            <Button size="sm">
              <Plus size={15} className="mr-1.5" />
              New Application
            </Button>
          </Link>
        }
      />

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Search applications..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="h-9 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
        </div>
        <Select
          options={statusOptions}
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="w-44"
        />
        <Select
          options={priorityOptions}
          value={priority}
          onChange={(e) => { setPriority(e.target.value); setPage(1); }}
          className="w-36"
        />
      </div>

      {/* Table */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        {loading ? (
          <LoadingSpinner />
        ) : applications.length === 0 ? (
          <EmptyState
            icon={FolderKanban}
            title="No applications found"
            description="Try adjusting your filters or create a new application."
            action={
              <Link href="/applications/new">
                <Button size="sm">New Application</Button>
              </Link>
            }
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left">
                <th className="px-4 py-3 font-medium text-slate-500">Title</th>
                <th className="px-4 py-3 font-medium text-slate-500">Customer</th>
                <th className="px-4 py-3 font-medium text-slate-500">Status</th>
                <th className="px-4 py-3 font-medium text-slate-500">Priority</th>
                <th className="px-4 py-3 font-medium text-slate-500">Assigned To</th>
                <th className="px-4 py-3 font-medium text-slate-500">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {applications.map((app) => (
                <tr key={app.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      href={`/applications/${app.id}`}
                      className="font-medium text-slate-900 hover:text-slate-600"
                    >
                      {app.title}
                    </Link>
                    {app._count.workItems > 0 && (
                      <span className="ml-2 text-xs text-slate-400">
                        {app._count.workItems} task{app._count.workItems !== 1 ? "s" : ""}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {app.customer.firstName} {app.customer.lastName}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={app.status as never} />
                  </td>
                  <td className="px-4 py-3">
                    <PriorityBadge priority={app.priority as never} />
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {app.assignedTo?.name ?? <span className="text-slate-400">Unassigned</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {formatDistanceToNow(new Date(app.updatedAt), { addSuffix: true })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {total > 20 && (
        <div className="flex items-center justify-between mt-4 text-sm text-slate-500">
          <span>Showing {Math.min((page - 1) * 20 + 1, total)}–{Math.min(page * 20, total)} of {total}</span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page * 20 >= total}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
