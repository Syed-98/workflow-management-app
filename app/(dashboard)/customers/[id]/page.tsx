"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader, LoadingSpinner, EmptyState } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { StatusBadge, PriorityBadge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { ArrowLeft, ChevronRight, Plus } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  company: string | null;
  address: string | null;
  notes: string | null;
  createdAt: string;
  applications: {
    id: string;
    title: string;
    status: string;
    priority: string;
    updatedAt: string;
    assignedTo: { name: string } | null;
    _count: { workItems: number };
  }[];
}

export default function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [customerId, setCustomerId] = useState("");

  useEffect(() => {
    params.then((p) => {
      setCustomerId(p.id);
    });
  }, [params]);

  useEffect(() => {
    if (!customerId) return;
    fetch(`/api/customers/${customerId}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.data) setCustomer(json.data);
      })
      .finally(() => setLoading(false));
  }, [customerId]);

  if (loading) return <LoadingSpinner />;
  if (!customer) return <EmptyState title="Customer not found" />;

  return (
    <div>
      <div className="flex items-center gap-2 mb-4 text-sm text-slate-500">
        <Link href="/customers" className="hover:text-slate-700 flex items-center gap-1">
          <ArrowLeft size={14} />
          Customers
        </Link>
        <ChevronRight size={14} />
        <span className="text-slate-900">{customer.firstName} {customer.lastName}</span>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{customer.firstName} {customer.lastName}</h1>
          {customer.company && <p className="text-sm text-slate-500 mt-1">{customer.company}</p>}
        </div>
        <Link href={`/applications/new?customerId=${customer.id}`}>
          <Button size="sm">
            <Plus size={14} className="mr-1.5" />
            New Application
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">Applications</h2>
          {customer.applications.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
              <p className="text-sm text-slate-500">No applications yet.</p>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left">
                    <th className="px-4 py-3 font-medium text-slate-500">Title</th>
                    <th className="px-4 py-3 font-medium text-slate-500">Status</th>
                    <th className="px-4 py-3 font-medium text-slate-500">Priority</th>
                    <th className="px-4 py-3 font-medium text-slate-500">Assigned To</th>
                    <th className="px-4 py-3 font-medium text-slate-500">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {customer.applications.map((app) => (
                    <tr key={app.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <Link href={`/applications/${app.id}`} className="font-medium text-slate-900 hover:text-slate-600">
                          {app.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={app.status as never} /></td>
                      <td className="px-4 py-3"><PriorityBadge priority={app.priority as never} /></td>
                      <td className="px-4 py-3 text-slate-600">{app.assignedTo?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs">
                        {formatDistanceToNow(new Date(app.updatedAt), { addSuffix: true })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 h-fit">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Contact Info</h3>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-slate-500">Email</dt>
              <dd className="text-slate-900 mt-0.5">{customer.email}</dd>
            </div>
            {customer.phone && (
              <div>
                <dt className="text-slate-500">Phone</dt>
                <dd className="text-slate-900 mt-0.5">{customer.phone}</dd>
              </div>
            )}
            {customer.address && (
              <div>
                <dt className="text-slate-500">Address</dt>
                <dd className="text-slate-900 mt-0.5">{customer.address}</dd>
              </div>
            )}
            {customer.notes && (
              <div>
                <dt className="text-slate-500">Notes</dt>
                <dd className="text-slate-900 mt-0.5 text-xs">{customer.notes}</dd>
              </div>
            )}
            <div>
              <dt className="text-slate-500">Customer Since</dt>
              <dd className="text-slate-900 mt-0.5">{format(new Date(customer.createdAt), "MMM d, yyyy")}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
