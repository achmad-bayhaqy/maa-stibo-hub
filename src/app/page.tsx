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
import { Loader2 } from "lucide-react";

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
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-white text-neutral-800">
        <img src="/map-active-logo.svg" alt="MAP Active" className="h-12 w-auto animate-pulse" />
        <div className="flex items-center gap-2 text-sm text-neutral-500">
          <Loader2 className="h-4 w-4 animate-spin text-[#DD1C24]" /> Loading Map Portal…
        </div>
      </div>
    );
  }

  if (!user) return <LoginScreen />;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-neutral-50">
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Topbar />
          <main className="flex-1 min-h-0">
            {view === "assistant" && <AssistantView />}
            {view !== "assistant" && (
              <div className="h-full overflow-y-auto">
                {view === "dashboard" && <DashboardView />}
                {view === "files" && <FilesView />}
                {view === "master" && <MasterDataView />}
                {view === "docs" && <DocsView />}
                {view === "users" && <UsersView />}
                {view === "audit" && <AuditView />}
                {view === "settings" && <SettingsView />}
              </div>
            )}
          </main>
          <footer className="shrink-0 border-t-2 border-black bg-white px-6 py-2.5 text-[11px] text-neutral-500 flex flex-wrap items-center justify-between gap-2">
            <span>Map Portal v2.3 · PT. MAP Aktif Adiperkasa Tbk (0888) — Master Data CoE</span>
            <span className="font-mono">resources tagged <span className="text-[#DD1C24] font-semibold">stibo</span> · AWS us-east-1</span>
          </footer>
        </div>
      </div>
      <CommandPalette />
    </div>
  );
}
