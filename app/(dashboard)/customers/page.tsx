"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { PageHeader, EmptyState, LoadingSpinner } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Plus, UserCircle, Search } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  company: string | null;
  createdAt: string;
  _count: { applications: number };
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      params.set("page", page.toString());
      const res = await fetch(`/api/customers?${params}`);
      const json = await res.json();
      if (json.data) {
        setCustomers(json.data.customers);
        setTotal(json.data.pagination.total);
      }
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => { fetch_(); }, [fetch_]);

  return (
    <div>
      <PageHeader
        title="Customers"
        description={`${total} total customer${total !== 1 ? "s" : ""}`}
        actions={
          <Link href="/customers/new">
            <Button size="sm">
              <Plus size={15} className="mr-1.5" />
              New Customer
            </Button>
          </Link>
        }
      />

      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Search customers..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="h-9 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        {loading ? (
          <LoadingSpinner />
        ) : customers.length === 0 ? (
          <EmptyState
            icon={UserCircle}
            title="No customers found"
            description={search ? "Try a different search." : "Create your first customer."}
            action={
              <Link href="/customers/new">
                <Button size="sm">New Customer</Button>
              </Link>
            }
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left">
                <th className="px-4 py-3 font-medium text-slate-500">Name</th>
                <th className="px-4 py-3 font-medium text-slate-500">Email</th>
                <th className="px-4 py-3 font-medium text-slate-500">Company</th>
                <th className="px-4 py-3 font-medium text-slate-500">Applications</th>
                <th className="px-4 py-3 font-medium text-slate-500">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {customers.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/customers/${c.id}`} className="font-medium text-slate-900 hover:text-slate-600">
                      {c.firstName} {c.lastName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.email}</td>
                  <td className="px-4 py-3 text-slate-600">{c.company || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{c._count.applications}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {total > 20 && (
        <div className="flex items-center justify-between mt-4 text-sm text-slate-500">
          <span>Showing {Math.min((page - 1) * 20 + 1, total)}–{Math.min(page * 20, total)} of {total}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page * 20 >= total} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
