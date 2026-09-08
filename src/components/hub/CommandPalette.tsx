"use client";

import { useEffect, useMemo, useState } from "react";
import { api, useHub, type ViewKey } from "@/lib/store";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import {
  Hexagon, LayoutDashboard, MessagesSquare, FolderOpen, Database, Users, ScrollText,
  Settings, BookOpen, Send, Sparkles, UploadCloud, Building2, ListTree, Route, Boxes,
} from "lucide-react";

interface MasterItem { id: string; label: string; sub: string }

/**
 * Global ⌘K command palette (btool pattern): navigation, quick actions,
 * cross-entity search (brands / attributes / LOV / users).
 */
export function CommandPalette() {
  const { paletteOpen, setPaletteOpen, setView, setMasterTab, setDocsSlug, user, sendMode, setSendMode } = useHub();
  const [brands, setBrands] = useState<MasterItem[]>([]);
  const [attrs, setAttrs] = useState<MasterItem[]>([]);
  const [docs, setDocs] = useState<MasterItem[]>([]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setPaletteOpen(!paletteOpen);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [paletteOpen, setPaletteOpen]);

  useEffect(() => {
    if (!paletteOpen) return;
    api<Array<{ code: string; name: string }>>("/api/brands").then((bs) =>
      setBrands(bs.slice(0, 12).map((b) => ({ id: b.code, label: `${b.code} — ${b.name}`, sub: "Brand" })))).catch(() => undefined);
    api<{ items: Array<{ id: string; code: string; name: string }> }>("/api/attributes?pageSize=12").then((d) =>
      setAttrs(d.items.map((a) => ({ id: a.id, label: `${a.code} — ${a.name}`, sub: "Attribute" })))).catch(() => undefined);
    api<{ pages: Array<{ id: string; slug: string; title: string; category: string }> }>("/api/docs").then((d) =>
      setDocs(d.pages.map((p) => ({ id: p.slug, label: p.title, sub: p.category })))).catch(() => undefined);
  }, [paletteOpen]);

  const go = (v: ViewKey) => { setPaletteOpen(false); setView(v); };

  const navItems = useMemo(() => {
    const items: Array<{ key: ViewKey; label: string; icon: React.ElementType }> = [
      { key: "assistant", label: "Assistant", icon: MessagesSquare },
      { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { key: "files", label: "Uploads", icon: FolderOpen },
      { key: "master", label: "Data Master", icon: Database },
      { key: "docs", label: "Documentation", icon: BookOpen },
      { key: "audit", label: "Audit Log", icon: ScrollText },
      { key: "settings", label: "Settings", icon: Settings },
    ];
    if (user?.role === "ADMIN" || user?.role === "EDITOR") items.splice(5, 0, { key: "users", label: "User Management", icon: Users });
    return items;
  }, [user]);

  return (
    <CommandDialog open={paletteOpen} onOpenChange={setPaletteOpen}>
      <CommandInput placeholder="Ketik perintah atau cari brand / atribut / dokumentasi…" />
      <CommandList>
        <CommandEmpty>Tidak ada hasil.</CommandEmpty>

        <CommandGroup heading="Navigasi">
          {navItems.map((n) => (
            <CommandItem key={n.key} onSelect={() => go(n.key)}>
              <n.icon className="h-4 w-4 mr-2 text-slate-400" /> {n.label}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Data Master">
          <CommandItem onSelect={() => { setMasterTab("brands"); go("master"); }}>
            <Building2 className="h-4 w-4 mr-2 text-slate-400" /> Brands
          </CommandItem>
          <CommandItem onSelect={() => { setMasterTab("attributes"); go("master"); }}>
            <Boxes className="h-4 w-4 mr-2 text-slate-400" /> Attributes
          </CommandItem>
          <CommandItem onSelect={() => { setMasterTab("lov"); go("master"); }}>
            <ListTree className="h-4 w-4 mr-2 text-slate-400" /> LOV Tables
          </CommandItem>
          <CommandItem onSelect={() => { setMasterTab("rules"); go("master"); }}>
            <Route className="h-4 w-4 mr-2 text-slate-400" /> Mapping Rules
          </CommandItem>
          <CommandItem onSelect={() => { setMasterTab("naming"); go("master"); }}>
            <Route className="h-4 w-4 mr-2 text-slate-400" /> Naming Routes
          </CommandItem>
          <CommandItem onSelect={() => { setMasterTab("rna"); go("master"); }}>
            <ListTree className="h-4 w-4 mr-2 text-slate-400" /> RNA
          </CommandItem>
        </CommandGroup>

        {brands.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Brands (pilih untuk lihat di Data Master)">
              {brands.map((b) => (
                <CommandItem key={b.id} value={`brand ${b.label}`} onSelect={() => { setMasterTab("brands"); go("master"); }}>
                  <Hexagon className="h-4 w-4 mr-2 text-red-400" /> {b.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {attrs.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Atribut teratas">
              {attrs.map((a) => (
                <CommandItem key={a.id} value={`attr ${a.label}`} onSelect={() => { setMasterTab("attributes"); go("master"); }}>
                  <Boxes className="h-4 w-4 mr-2 text-sky-400" /> {a.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {docs.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Dokumentasi">
              {docs.map((d) => (
                <CommandItem key={d.id} value={`doc ${d.label} ${d.sub}`} onSelect={() => { setDocsSlug(d.id); go("docs"); }}>
                  <BookOpen className="h-4 w-4 mr-2 text-neutral-400" /> {d.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {user && user.role !== "VIEWER" && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Quick actions">
              <CommandItem onSelect={() => go("assistant")}>
                <UploadCloud className="h-4 w-4 mr-2 text-red-500" /> Assistant — upload file atau tanya apa saja
              </CommandItem>
              {(user.role === "ADMIN" || user.role === "EDITOR") && (
                <CommandItem onSelect={() => { setSendMode(sendMode === "MOCK" ? "LIVE" : "MOCK"); setPaletteOpen(false); }}>
                  <Send className="h-4 w-4 mr-2 text-slate-400" /> Ganti mode kirim → {sendMode === "MOCK" ? "LIVE" : "MOCK"}
                </CommandItem>
              )}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
