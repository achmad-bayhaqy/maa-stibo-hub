"use client";
import { create } from "zustand";

export type ViewKey =
  | "assistant" | "dashboard" | "files"
  | "master" | "users" | "audit" | "settings";

export interface HubUser {
  id: string; email: string; name: string; role: "ADMIN" | "EDITOR" | "VIEWER";
}

interface HubState {
  user: HubUser | null;
  view: ViewKey;
  masterTab: "brands" | "attributes" | "lov" | "rules";
  sendMode: "MOCK" | "LIVE";
  sidebarOpen: boolean;
  setUser: (u: HubUser | null) => void;
  setView: (v: ViewKey) => void;
  setMasterTab: (t: HubState["masterTab"]) => void;
  setSendMode: (m: "MOCK" | "LIVE") => void;
  toggleSidebar: () => void;
}

export const useHub = create<HubState>((set) => ({
  user: null,
  view: "assistant",
  masterTab: "brands",
  sendMode: "MOCK",
  sidebarOpen: true,
  setUser: (user) => set({ user }),
  setView: (view) => set({ view, sidebarOpen: true }),
  setMasterTab: (masterTab) => set({ masterTab }),
  setSendMode: (sendMode) => set({ sendMode }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
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
