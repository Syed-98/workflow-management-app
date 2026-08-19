"use client";

import { useState, useEffect } from "react";
import { PageHeader, EmptyState, LoadingSpinner } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { Plus, Building2 } from "lucide-react";

interface Team {
  id: string;
  name: string;
  members: { id: string; name: string; role: string }[];
  _count: { applications: number };
}

export default function TeamsPage() {
  const { toast } = useToast();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function loadTeams() {
    const res = await fetch("/api/teams");
    const json = await res.json();
    setTeams(json.data || []);
    setLoading(false);
  }

  useEffect(() => { loadTeams(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast(json.error || "Failed to create team", "error");
        return;
      }
      toast("Team created", "success");
      setShowModal(false);
      setName("");
      loadTeams();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Teams"
        description="Organize users into teams for application management"
        actions={
          <Button size="sm" onClick={() => setShowModal(true)}>
            <Plus size={15} className="mr-1.5" />
            New Team
          </Button>
        }
      />

      {loading ? (
        <LoadingSpinner />
      ) : teams.length === 0 ? (
        <div className="glass-panel">
          <EmptyState icon={Building2} title="No teams yet" description="Create a team to group users together." />
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {teams.map((team) => (
            <div key={team.id} className="glass-panel p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-slate-900">{team.name}</h3>
                <span className="text-xs text-slate-500">{team._count.applications} apps</span>
              </div>
              <div className="space-y-1.5">
                {team.members.length === 0 ? (
                  <p className="text-xs text-slate-400">No members</p>
                ) : (
                  team.members.map((m) => (
                    <div key={m.id} className="flex items-center gap-2 text-xs text-slate-600">
                      <div className="h-5 w-5 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-medium shrink-0">
                        {m.name.charAt(0)}
                      </div>
                      {m.name}
                      <span className="text-slate-400 capitalize">{m.role.toLowerCase()}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showModal} onClose={() => setShowModal(false)} title="New Team">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input label="Team Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Operations" required />
          <div className="flex gap-2">
            <Button type="submit" loading={submitting} className="flex-1">Create Team</Button>
            <Button type="button" variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
