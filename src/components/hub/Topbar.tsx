"use client";

import { useHub } from "@/lib/store";
import { api } from "@/lib/store";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { LogOut, User as UserIcon, ShieldCheck, CircleDot, Search, BookOpen } from "lucide-react";

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Administrator", EDITOR: "Editor (MD CoE)", VIEWER: "Viewer",
};

export function Topbar() {
  const { user, setUser, setView, sendMode, setPaletteOpen } = useHub();
  if (!user) return null;

  const initials = user.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/90 backdrop-blur border-b flex items-center justify-between px-4 md:px-6">
      <div className="flex items-center gap-3 min-w-0">
        <h1 className="text-sm md:text-[15px] font-semibold text-slate-800 truncate">Master Data Integration Portal</h1>
        <Badge
          variant="outline"
          className="hidden sm:inline-flex gap-1.5 border-orange-300 bg-orange-50 text-orange-700"
          title={sendMode === "MOCK" ? "Sends are simulated — no data reaches Stibo" : "Live mode — XML will be POSTed to Stibo IIEP"}
        >
          <CircleDot className="h-3 w-3" />
          {sendMode === "MOCK" ? "MOCK MODE" : "LIVE MODE"}
        </Badge>
      </div>

      <div className="flex items-center gap-2.5">
        <button
          onClick={() => setPaletteOpen(true)}
          className="hidden md:flex items-center gap-2 rounded-lg border bg-white px-3 py-1.5 text-xs text-slate-400 hover:border-orange-300 hover:text-slate-600 transition-colors"
          aria-label="Buka quick search (Ctrl+K)"
        >
          <Search className="h-3.5 w-3.5" />
          <span>Search…</span>
          <kbd className="rounded border bg-slate-50 px-1.5 py-0.5 text-[9px] font-mono text-slate-400">⌘K</kbd>
        </button>
        <Button variant="outline" size="sm" className="hidden sm:inline-flex border-violet-200 text-violet-700 hover:bg-violet-50" onClick={() => setView("docs")}>
          <BookOpen className="h-4 w-4 mr-1" /> Docs
        </Button>
        <Button variant="outline" size="sm" className="hidden lg:inline-flex border-slate-300 text-slate-700" onClick={() => setView("assistant")}>
          New Transformation
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2.5 rounded-full pl-1 pr-2 py-1 hover:bg-slate-100 transition-colors" aria-label="User menu">
              <span className="h-8 w-8 rounded-full bg-[#0B1626] text-orange-400 text-xs font-bold flex items-center justify-center">
                {initials}
              </span>
              <span className="hidden md:block text-left">
                <span className="block text-xs font-semibold text-slate-800 leading-tight">{user.name}</span>
                <span className="block text-[10px] text-slate-500 leading-tight">{ROLE_LABEL[user.role]}</span>
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="text-xs">
              <div className="font-semibold text-slate-800">{user.email}</div>
              <div className="flex items-center gap-1 text-slate-500 mt-0.5">
                <ShieldCheck className="h-3 w-3" /> {ROLE_LABEL[user.role]}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setView("settings")}>
              <UserIcon className="h-4 w-4 mr-2" /> Settings
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-red-600 focus:text-red-600"
              onClick={async () => {
                await api("/api/auth/logout", { method: "POST" }).catch(() => undefined);
                setUser(null);
              }}
            >
              <LogOut className="h-4 w-4 mr-2" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
