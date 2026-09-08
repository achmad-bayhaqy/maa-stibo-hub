"use client";
import { create } from "zustand";

export type ViewKey =
  | "assistant" | "dashboard" | "files"
  | "master" | "docs" | "users" | "audit" | "settings";

export interface HubUser {
  id: string; email: string; name: string; role: "ADMIN" | "EDITOR" | "VIEWER";
}

export interface PaletteState {
  open: boolean;
  show: () => void;
  hide: () => void;
}

interface HubState {
  user: HubUser | null;
  view: ViewKey;
  masterTab: "brands" | "attributes" | "lov" | "rules" | "naming" | "rna";
  sendMode: "MOCK" | "LIVE";
  sidebarOpen: boolean;
  paletteOpen: boolean;
  docsSlug: string;
  /** bumped by Topbar "New Transformation" — AssistantView resets its thread */
  newChatNonce: number;
  setUser: (u: HubUser | null) => void;
  setView: (v: ViewKey) => void;
  setMasterTab: (t: HubState["masterTab"]) => void;
  setSendMode: (m: "MOCK" | "LIVE") => void;
  toggleSidebar: () => void;
  setPaletteOpen: (o: boolean) => void;
  setDocsSlug: (s: string) => void;
  bumpNewChat: () => void;
}

export const useHub = create<HubState>((set) => ({
  user: null,
  view: "assistant",
  masterTab: "brands",
  sendMode: "MOCK",
  sidebarOpen: true,
  paletteOpen: false,
  docsSlug: "getting-started",
  newChatNonce: 0,
  setUser: (user) => set({ user }),
  setView: (view) => set({ view, sidebarOpen: true }),
  setMasterTab: (masterTab) => set({ masterTab }),
  setSendMode: (sendMode) => set({ sendMode }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
  setDocsSlug: (docsSlug) => set({ docsSlug }),
  bumpNewChat: () => set((s) => ({ newChatNonce: s.newChatNonce + 1 })),
}));

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: init?.body instanceof FormData
      ? undefined
      : { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  return data as T;
}

/** Download an array of rows as CSV (client-side, btool-style template/export generator). */
export function exportCsv(filename: string, columns: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = "\uFEFF" + [columns.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
