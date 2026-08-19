"use client";

import { useState, useEffect } from "react";
import { PageHeader, EmptyState, LoadingSpinner } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Select } from "@/components/ui/input";
import { RoleBadge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { Plus, Users } from "lucide-react";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  teamId: string | null;
  team: { id: string; name: string } | null;
  createdAt: string;
}

interface Team {
  id: string;
  name: string;
}

export default function UsersPage() {
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "EXECUTIVE", teamId: "" });
  const [submitting, setSubmitting] = useState(false);

  async function loadData() {
    const [usersRes, teamsRes] = await Promise.all([
      fetch("/api/users"),
      fetch("/api/teams"),
    ]);
    const [usersJson, teamsJson] = await Promise.all([usersRes.json(), teamsRes.json()]);
    setUsers(usersJson.data || []);
    setTeams(teamsJson.data || []);
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, teamId: form.teamId || undefined }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast(json.error || "Failed to create user", "error");
        return;
      }
      toast("User created", "success");
      setShowModal(false);
      setForm({ name: "", email: "", password: "", role: "EXECUTIVE", teamId: "" });
      loadData();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Users"
        description="Manage system users and their roles"
        actions={
          <Button size="sm" onClick={() => setShowModal(true)}>
            <Plus size={15} className="mr-1.5" />
            New User
          </Button>
        }
      />

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        {loading ? (
          <LoadingSpinner />
        ) : users.length === 0 ? (
          <EmptyState icon={Users} title="No users yet" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left">
                <th className="px-4 py-3 font-medium text-slate-500">Name</th>
                <th className="px-4 py-3 font-medium text-slate-500">Email</th>
                <th className="px-4 py-3 font-medium text-slate-500">Role</th>
                <th className="px-4 py-3 font-medium text-slate-500">Team</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{u.name}</td>
                  <td className="px-4 py-3 text-slate-600">{u.email}</td>
                  <td className="px-4 py-3"><RoleBadge role={u.role} /></td>
                  <td className="px-4 py-3 text-slate-600">{u.team?.name ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={showModal} onClose={() => setShowModal(false)} title="New User">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <Input label="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} hint="Minimum 8 characters" required />
          <Select
            label="Role"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            options={[
              { value: "ADMIN", label: "Admin" },
              { value: "MANAGER", label: "Manager" },
              { value: "EXECUTIVE", label: "Executive" },
            ]}
          />
          <Select
            label="Team"
            value={form.teamId}
            onChange={(e) => setForm({ ...form, teamId: e.target.value })}
            options={teams.map((t) => ({ value: t.id, label: t.name }))}
            placeholder="No team"
          />
          <div className="flex gap-2">
            <Button type="submit" loading={submitting} className="flex-1">Create User</Button>
            <Button type="button" variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
