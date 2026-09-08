"use client";

import { useHub, type ViewKey } from "@/lib/store";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, MessagesSquare, FolderOpen, Database,
  Users, ScrollText, Settings, ChevronLeft, BookOpen,
} from "lucide-react";

type Section = "main" | "data" | "governance";

const NAV: Array<{ key: ViewKey; label: string; sub: string; icon: React.ElementType; roles?: string[]; section: Section }> = [
  { key: "assistant", label: "Assistant", sub: "Upload · Ask · Send", icon: MessagesSquare, section: "main" },
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
        "hidden md:flex flex-col bg-white text-neutral-800 border-r-2 border-black transition-all duration-200 shrink-0",
        sidebarOpen ? "w-[248px]" : "w-[68px]"
      )}
    >
      <button
        className="flex items-center gap-3 px-4 h-16 border-b-2 border-black text-left w-full hover:bg-neutral-50 transition-colors"
        onClick={() => { setView("assistant"); }}
        aria-label="Map Portal home"
      >
        <img src="/map-active-logo.svg" alt="MAP Active" className="h-8 w-auto shrink-0" />
        {sidebarOpen && (
          <div className="min-w-0">
            <div className="text-[14px] font-bold text-black leading-tight tracking-tight">Map Portal</div>
            <div className="text-[10px] text-neutral-500 truncate">Principal file upload center</div>
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
                <div className="px-3 pb-1 text-[9px] font-bold uppercase tracking-widest text-neutral-400">{SECTION_LABEL[section]}</div>
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
                        "w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors group relative",
                        active
                          ? "bg-[#DD1C24] text-white shadow-sm"
                          : "hover:bg-neutral-100 hover:text-black text-neutral-600"
                      )}
                      aria-current={active ? "page" : undefined}
                      title={item.label}
                    >
                      <Icon className={cn("h-[18px] w-[18px] shrink-0", active ? "text-white" : "text-neutral-500 group-hover:text-[#DD1C24]")} />
                      {sidebarOpen && (
                        <span className="min-w-0">
                          <span className="block text-[13px] font-medium leading-tight">{item.label}</span>
                          <span className={cn("block text-[10px] truncate", active ? "text-white/75" : "text-neutral-400 group-hover:text-neutral-600")}>{item.sub}</span>
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

      <div className="border-t-2 border-black p-2 space-y-0.5">
        <button
          onClick={() => setPaletteOpen(true)}
          className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-neutral-600 hover:text-black hover:bg-neutral-100 text-xs"
          aria-label="Buka command palette"
        >
          <SearchIcon className="h-4 w-4 shrink-0" />
          {sidebarOpen && (
            <span className="flex-1 flex items-center justify-between">
              <span>Quick search</span>
              <kbd className="rounded border-2 border-black bg-white px-1.5 py-0.5 text-[9px] font-mono">⌘K</kbd>
            </span>
          )}
        </button>
        <button
          onClick={toggleSidebar}
          className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-neutral-500 hover:text-black hover:bg-neutral-100 text-xs"
          aria-label="Toggle sidebar"
        >
          <ChevronLeft className={cn("h-4 w-4 transition-transform", !sidebarOpen && "rotate-180")} />
          {sidebarOpen && <span>Collapse</span>}
        </button>
        {sidebarOpen && (
          <div className="px-3 pt-1 pb-2 text-[10px] leading-relaxed text-neutral-400">
            v2.1 · env <span className="text-neutral-500 font-mono">stibo-hub-dev</span>
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
