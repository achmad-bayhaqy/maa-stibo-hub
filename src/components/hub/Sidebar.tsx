"use client";

import { useHub, type ViewKey } from "@/lib/store";
import { cn } from "@/lib/utils";
import {
  Hexagon, LayoutDashboard, MessagesSquare, FolderOpen, Database,
  Users, ScrollText, Settings, ChevronLeft,
} from "lucide-react";

const NAV: Array<{ key: ViewKey; label: string; sub: string; icon: React.ElementType; roles?: string[] }> = [
  { key: "assistant", label: "Assistant", sub: "Upload → Map → Send", icon: MessagesSquare },
  { key: "dashboard", label: "Dashboard", sub: "Pipeline KPIs", icon: LayoutDashboard },
  { key: "files", label: "Uploads", sub: "Transform history", icon: FolderOpen },
  { key: "master", label: "Data Master", sub: "Brands · Rules · LOV", icon: Database },
  { key: "users", label: "User Management", sub: "Accounts & roles", icon: Users, roles: ["ADMIN", "EDITOR"] },
  { key: "audit", label: "Audit Log", sub: "Who did what", icon: ScrollText },
  { key: "settings", label: "Settings", sub: "Endpoints & mode", icon: Settings },
];

export function Sidebar() {
  const { view, setView, user, sidebarOpen, toggleSidebar } = useHub();
  const nav = NAV.filter((n) => !n.roles || (user && n.roles.includes(user.role)));

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col bg-[#0B1626] text-slate-300 transition-all duration-200 shrink-0",
        sidebarOpen ? "w-[248px]" : "w-[68px]"
      )}
    >
      <div className="flex items-center gap-2.5 px-4 h-16 border-b border-white/10">
        <div className="h-9 w-9 rounded-lg bg-orange-500/15 border border-orange-500/40 flex items-center justify-center shrink-0">
          <Hexagon className="h-5 w-5 text-orange-400" />
        </div>
        {sidebarOpen && (
          <div className="min-w-0">
            <div className="text-[15px] font-semibold text-white leading-tight">STIBO Hub</div>
            <div className="text-[10px] text-slate-400 truncate">MAP Aktif Adiperkasa · 0888</div>
          </div>
        )}
      </div>

      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {nav.map((item) => {
          const Icon = item.icon;
          const active = view === item.key;
          return (
            <button
              key={item.key}
              onClick={() => setView(item.key)}
              className={cn(
                "w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors group",
                active ? "bg-orange-500/15 text-white" : "hover:bg-white/5 hover:text-white text-slate-400"
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon className={cn("h-[18px] w-[18px] shrink-0", active && "text-orange-400")} />
              {sidebarOpen && (
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium leading-tight">{item.label}</span>
                  <span className="block text-[10px] text-slate-500 group-hover:text-slate-400 truncate">{item.sub}</span>
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-2">
        <button
          onClick={toggleSidebar}
          className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-slate-500 hover:text-white hover:bg-white/5 text-xs"
          aria-label="Toggle sidebar"
        >
          <ChevronLeft className={cn("h-4 w-4 transition-transform", !sidebarOpen && "rotate-180")} />
          {sidebarOpen && <span>Collapse</span>}
        </button>
        {sidebarOpen && (
          <div className="px-3 pt-1 pb-2 text-[10px] leading-relaxed text-slate-600">
            v1.0 · env <span className="text-slate-500">stibo-hub-dev</span>
          </div>
        )}
      </div>
    </aside>
  );
}
