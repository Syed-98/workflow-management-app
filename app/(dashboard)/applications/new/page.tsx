"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface User {
  id: string;
  name: string;
  role: string;
}

export default function NewApplicationPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    priority: "MEDIUM",
    customerId: "",
    assignedToId: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    Promise.all([
      fetch("/api/customers?pageSize=100").then((r) => r.json()),
      fetch("/api/users").then((r) => r.json()),
    ]).then(([custJson, userJson]) => {
      setCustomers(custJson.data?.customers || []);
      setUsers(userJson.data || []);
    });
  }, []);

  function validate() {
    const errs: Record<string, string> = {};
    if (!form.title.trim()) errs.title = "Title is required";
    if (!form.customerId) errs.customerId = "Customer is required";
    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          assignedToId: form.assignedToId || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        toast(json.error || "Failed to create application", "error");
        return;
      }

      toast("Application created successfully", "success");
      router.push(`/applications/${json.data.id}`);
    } catch {
      toast("Failed to create application", "error");
    } finally {
      setLoading(false);
    }
  }

  const customerOptions = customers.map((c) => ({
    value: c.id,
    label: `${c.firstName} ${c.lastName} (${c.email})`,
  }));

  const userOptions = [
    { value: "", label: "Unassigned" },
    ...users.map((u) => ({ value: u.id, label: `${u.name} (${u.role.toLowerCase()})` })),
  ];

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="New Application"
        description="Create a new customer application"
      />

      <div className="glass-panel p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Application title"
            error={errors.title}
            required
          />

          <Textarea
            label="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Describe what this application is about..."
            rows={4}
          />

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Priority"
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
              options={[
                { value: "LOW", label: "Low" },
                { value: "MEDIUM", label: "Medium" },
                { value: "HIGH", label: "High" },
                { value: "URGENT", label: "Urgent" },
              ]}
            />

            <Select
              label="Customer"
              value={form.customerId}
              onChange={(e) => setForm({ ...form, customerId: e.target.value })}
              options={customerOptions}
              placeholder="Select customer..."
              error={errors.customerId}
            />
          </div>

          <Select
            label="Assign To"
            value={form.assignedToId}
            onChange={(e) => setForm({ ...form, assignedToId: e.target.value })}
            options={userOptions}
          />

          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" loading={loading}>
              Create Application
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
