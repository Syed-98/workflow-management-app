import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ApplicationStatus } from "@prisma/client";
import { buildApplicationFilter } from "@/lib/permissions";
import type { SessionUser } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import Link from "next/link";
import { FolderKanban, Users, UserCircle, CheckCircle2, Clock, AlertCircle } from "lucide-react";

async function getDashboardStats(user: SessionUser) {
  const filter = buildApplicationFilter(user);

  const [
    totalApplications,
    newApplications,
    inProgressApplications,
    completedApplications,
    pendingSyncJobs,
    recentActivity,
  ] = await Promise.all([
    prisma.application.count({ where: filter }),
    prisma.application.count({ where: { ...filter, status: "NEW" } }),
    prisma.application.count({ where: { ...filter, status: "IN_PROGRESS" } }),
    prisma.application.count({ where: { ...filter, status: "COMPLETED" } }),
    prisma.syncJob.count({ where: { status: { in: ["PENDING", "FAILED"] } } }),
    prisma.activityLog.findMany({
      where: {
        application: filter,
      },
      include: {
        user: { select: { name: true } },
        application: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  return {
    totalApplications,
    newApplications,
    inProgressApplications,
    completedApplications,
    pendingSyncJobs,
    recentActivity,
  };
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = session.user as SessionUser;
  const stats = await getDashboardStats(user);

  const statCards = [
    {
      label: "Total Applications",
      value: stats.totalApplications,
      icon: FolderKanban,
      href: "/applications",
      color: "text-slate-600",
    },
    {
      label: "New",
      value: stats.newApplications,
      icon: AlertCircle,
      href: "/applications?status=NEW",
      color: "text-amber-600",
    },
    {
      label: "In Progress",
      value: stats.inProgressApplications,
      icon: Clock,
      href: "/applications?status=IN_PROGRESS",
      color: "text-blue-600",
    },
    {
      label: "Completed",
      value: stats.completedApplications,
      icon: CheckCircle2,
      href: "/applications?status=COMPLETED",
      color: "text-green-600",
    },
  ];

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${user.name}`}
        description="Here's what's happening with your applications."
      />

      <div className="grid grid-cols-4 gap-4 mb-8">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.label}
              href={card.href}
              className="rounded-lg border border-slate-200 bg-white p-5 hover:border-slate-300 transition-colors"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-slate-500">{card.label}</span>
                <Icon size={18} className={card.color} />
              </div>
              <p className="text-2xl font-semibold text-slate-900">{card.value}</p>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 rounded-lg border border-slate-200 bg-white">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-900">Recent Activity</h2>
          </div>
          {stats.recentActivity.length === 0 ? (
            <p className="px-5 py-8 text-sm text-slate-500 text-center">No recent activity.</p>
          ) : (
            <ul className="divide-y divide-slate-50">
              {stats.recentActivity.map((log) => (
                <li key={log.id} className="px-5 py-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 h-6 w-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-medium text-slate-600 shrink-0">
                      {log.user.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-700">{log.description}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        <Link href={`/applications/${log.application.id}`} className="hover:underline text-slate-500">
                          {log.application.title}
                        </Link>
                        {" · "}
                        {log.user.name}
                        {" · "}
                        {new Date(log.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-900">Quick Actions</h2>
          </div>
          <div className="p-4 space-y-2">
            <Link
              href="/applications/new"
              className="flex items-center gap-2 rounded-md px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <FolderKanban size={15} className="text-slate-400" />
              New Application
            </Link>
            <Link
              href="/customers/new"
              className="flex items-center gap-2 rounded-md px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <UserCircle size={15} className="text-slate-400" />
              New Customer
            </Link>
            <Link
              href="/applications"
              className="flex items-center gap-2 rounded-md px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Clock size={15} className="text-slate-400" />
              View All Applications
            </Link>
          </div>

          {stats.pendingSyncJobs > 0 && (
            <div className="mx-4 mb-4 rounded-md bg-amber-50 border border-amber-200 p-3">
              <p className="text-xs font-medium text-amber-800">
                {stats.pendingSyncJobs} sync {stats.pendingSyncJobs === 1 ? "job" : "jobs"} pending
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                External system synchronization is queued.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
