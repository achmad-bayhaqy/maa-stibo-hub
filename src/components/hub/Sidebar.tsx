"use client";

import { useHub, type ViewKey } from "@/lib/store";
import { cn } from "@/lib/utils";
import {
  Hexagon, LayoutDashboard, MessagesSquare, FolderOpen, Database,
  Users, ScrollText, Settings, ChevronLeft, BookOpen,
} from "lucide-react";

type Section = "main" | "data" | "governance";

const NAV: Array<{ key: ViewKey; label: string; sub: string; icon: React.ElementType; roles?: string[]; section: Section }> = [
  { key: "assistant", label: "Assistant", sub: "Upload → Map → Send", icon: MessagesSquare, section: "main" },
  { key: "dashboard", label: "Dashboard", sub: "Pipeline KPIs", icon: LayoutDashboard, section: "main" },
  { key: "files", label: "Uploads", sub: "Transform history", icon: FolderOpen, section: "main" },
  { key: "master", label: "Data Master", sub: "Brands · Rules · LOV · RNA", icon: Database, section: "data" },
  { key: "docs", label: "Documentation", sub: "Guides & reference", icon: BookOpen, section: "data" },
  { key: "users", label: "User Management", sub: "Accounts & roles", icon: Users, roles: ["ADMIN", "EDITOR"], section: "governance" },
  { key: "audit", label: "Audit Log", sub: "Who did what", icon: ScrollText, section: "governance" },
  { key: "settings", label: "Settings", sub: "Endpoints & mode", icon: Settings, section: "governance" },
];

const SECTION_LABEL: Record<Section, string> = {
  main: "Workspace",
  data: "Data & Knowledge",
  governance: "Governance",
};

export function Sidebar() {
  const { view, setView, user, sidebarOpen, toggleSidebar, setPaletteOpen } = useHub();
  const allowed = NAV.filter((n) => !n.roles || (user && n.roles.includes(user.role)));
  const sections: Section[] = ["main", "data", "governance"];

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col bg-[#0B1626] text-slate-300 transition-all duration-200 shrink-0",
        sidebarOpen ? "w-[248px]" : "w-[68px]"
      )}
    >
      <button
        className="flex items-center gap-2.5 px-4 h-16 border-b border-white/10 text-left w-full hover:bg-white/5 transition-colors"
        onClick={() => { setView("assistant"); }}
        aria-label="STIBO Hub home"
      >
        <div className="h-9 w-9 rounded-lg bg-orange-500/15 border border-orange-500/40 flex items-center justify-center shrink-0">
          <Hexagon className="h-5 w-5 text-orange-400" />
        </div>
        {sidebarOpen && (
          <div className="min-w-0">
            <div className="text-[15px] font-semibold text-white leading-tight">STIBO Hub</div>
            <div className="text-[10px] text-slate-400 truncate">MAP Aktif Adiperkasa · 0888</div>
          </div>
        )}
      </button>

      <nav className="flex-1 py-3 px-2 space-y-3 overflow-y-auto" aria-label="Main navigation">
        {sections.map((section) => {
          const items = allowed.filter((n) => n.section === section);
          if (items.length === 0) return null;
          return (
            <div key={section}>
              {sidebarOpen && (
                <div className="px-3 pb-1 text-[9px] font-bold uppercase tracking-widest text-slate-600">{SECTION_LABEL[section]}</div>
              )}
              <div className="space-y-0.5">
                {items.map((item) => {
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
                      title={item.label}
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
              </div>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-2 space-y-0.5">
        <button
          onClick={() => setPaletteOpen(true)}
          className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-slate-400 hover:text-white hover:bg-white/5 text-xs"
          aria-label="Buka command palette"
        >
          <SearchIcon className="h-4 w-4 shrink-0" />
          {sidebarOpen && (
            <span className="flex-1 flex items-center justify-between">
              <span>Quick search</span>
              <kbd className="rounded border border-white/20 bg-white/5 px-1.5 py-0.5 text-[9px] font-mono">⌘K</kbd>
            </span>
          )}
        </button>
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
            v2.0 · env <span className="text-slate-500">stibo-hub-dev</span>
          </div>
        )}
      </div>
    </aside>
  );
}

function SearchIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
    </svg>
  );
}
