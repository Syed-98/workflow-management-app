"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  UserCircle,
  LogOut,
  Building2,
} from "lucide-react";
import { Role } from "@prisma/client";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  roles?: Role[];
}

const navItems: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/customers", label: "Customers", icon: UserCircle },
  { href: "/applications", label: "Applications", icon: FolderKanban },
  { href: "/users", label: "Users", icon: Users, roles: [Role.ADMIN] },
  { href: "/teams", label: "Teams", icon: Building2, roles: [Role.ADMIN, Role.MANAGER] },
];

interface SidebarProps {
  user: {
    name: string;
    email: string;
    role: Role;
  };
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();

  const visibleItems = navItems.filter(
    (item) => !item.roles || item.roles.includes(user.role)
  );

  return (
    <aside className="glass-sidebar relative z-20 flex h-screen w-56 flex-col">
      <div className="flex h-14 items-center border-b glass-divider px-4">
        <span className="text-base font-semibold tracking-tight text-slate-900">WorkFlow</span>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-2">
        <ul className="space-y-1">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    isActive
                      ? "nav-item-active text-slate-900"
                      : "text-slate-600 hover:bg-white/45 hover:text-slate-900"
                  )}
                >
                  <Icon size={16} />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t glass-divider p-3">
        <div className="flex items-center gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-white/40">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900/90 text-xs font-semibold text-white shadow-sm">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-900 truncate">{user.name}</p>
            <p className="text-xs text-slate-500 truncate capitalize">{user.role.toLowerCase()}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="rounded-md p-1 text-slate-400 transition-colors hover:bg-white/50 hover:text-slate-700"
            title="Sign out"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}
