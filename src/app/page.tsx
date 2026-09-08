"use client";

import { useEffect, useState } from "react";
import { useHub } from "@/lib/store";
import { api } from "@/lib/store";
import { Sidebar } from "@/components/hub/Sidebar";
import { Topbar } from "@/components/hub/Topbar";
import { LoginScreen } from "@/components/hub/LoginScreen";
import { AssistantView } from "@/components/hub/views/AssistantView";
import { DashboardView } from "@/components/hub/views/DashboardView";
import { FilesView } from "@/components/hub/views/FilesView";
import { MasterDataView } from "@/components/hub/views/MasterDataView";
import { UsersView } from "@/components/hub/views/UsersView";
import { AuditView } from "@/components/hub/views/AuditView";
import { SettingsView } from "@/components/hub/views/SettingsView";
import { DocsView } from "@/components/hub/views/DocsView";
import { CommandPalette } from "@/components/hub/CommandPalette";
import { Loader2, Hexagon } from "lucide-react";

export default function Home() {
  const { user, setUser, view } = useHub();
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    api<{ user: import("@/lib/store").HubUser | null }>("/api/auth/me")
      .then((d) => setUser(d.user))
      .catch(() => setUser(null))
      .finally(() => setBooting(false));
  }, [setUser]);

  if (booting) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-[#0B1626] text-slate-200">
        <Hexagon className="h-10 w-10 text-orange-500 animate-pulse" />
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading STIBO Hub…
        </div>
      </div>
    );
  }

  if (!user) return <LoginScreen />;

  return (
    <div className="min-h-screen flex bg-[#F6F7F9]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 min-w-0">
          {view === "assistant" && <AssistantView />}
          {view === "dashboard" && <DashboardView />}
          {view === "files" && <FilesView />}
          {view === "master" && <MasterDataView />}
          {view === "docs" && <DocsView />}
          {view === "users" && <UsersView />}
          {view === "audit" && <AuditView />}
          {view === "settings" && <SettingsView />}
        </main>
        <footer className="mt-auto border-t bg-white px-6 py-3 text-[11px] text-slate-400 flex flex-wrap items-center justify-between gap-2">
          <span>STIBO Hub v2.0 · PT. MAP Aktif Adiperkasa Tbk (0888) — Master Data CoE</span>
          <span className="font-mono">resources tagged <span className="text-orange-600">stibo</span> · AWS us-east-1</span>
        </footer>
      </div>
      <CommandPalette />
    </div>
  );
}
