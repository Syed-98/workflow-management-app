import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="app-shell relative flex h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="ambient-orb ambient-orb-1" />
        <div className="ambient-orb ambient-orb-2" />
      </div>

      <Sidebar
        user={{
          name: session.user.name!,
          email: session.user.email!,
          role: session.user.role,
        }}
      />

      <main className="relative z-10 flex-1 overflow-y-auto">
        <div className="page-enter p-6 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
