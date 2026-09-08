"use client";

import { useCallback, useEffect, useState } from "react";
import { api, useHub } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Loader2, ShieldCheck, Trash2, Search } from "lucide-react";

interface HubUserRow { id: string; email: string; name: string; role: "ADMIN" | "EDITOR" | "VIEWER"; active: boolean; lastLoginAt: string | null; createdAt: string }

const ROLE_META: Record<string, { label: string; cls: string; desc: string }> = {
  ADMIN: { label: "Admin", cls: "border-neutral-200 bg-neutral-50 text-neutral-700", desc: "Full access incl. user management" },
  EDITOR: { label: "Editor", cls: "border-red-200 bg-red-50 text-red-700", desc: "Upload, transform & send to Stibo" },
  VIEWER: { label: "Viewer", cls: "border-slate-200 bg-slate-50 text-slate-600", desc: "Read-only dashboards & masters" },
};

export function UsersView() {
  const { user: me, setView } = useHub();
  const { toast } = useToast();
  const [users, setUsers] = useState<HubUserRow[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ email: "", name: "", role: "VIEWER", password: "" });
  const [busy, setBusy] = useState(false);

  const isAdmin = me?.role === "ADMIN";

  const load = useCallback(async () => {
    setLoading(true);
    try { setUsers(await api<HubUserRow[]>(`/api/users?q=${encodeURIComponent(q)}`)); }
    catch { setView("assistant"); }
    finally { setLoading(false); }
  }, [q, setView]);
  useEffect(() => { load(); }, [load]);

  const patch = async (id: string, data: Record<string, unknown>) => {
    try { await api(`/api/users/${id}`, { method: "PATCH", body: JSON.stringify(data) }); load(); }
    catch (e) { toast({ title: "Update failed", description: (e as Error).message, variant: "destructive" }); }
  };

  const create = async () => {
    setBusy(true);
    try {
      await api("/api/users", { method: "POST", body: JSON.stringify(form) });
      toast({ title: "User created", description: form.email });
      setCreateOpen(false); setForm({ email: "", name: "", role: "VIEWER", password: "" }); load();
    } catch (e) { toast({ title: "Create failed", description: (e as Error).message, variant: "destructive" }); }
    finally { setBusy(false); }
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800">User management</h2>
          <p className="text-xs text-slate-500 mt-0.5">Akun CoE/Brand/IT dengan role-based access.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari user…" className="pl-8 h-9 w-52 text-xs" />
          </div>
          {isAdmin && (
            <Button size="sm" className="bg-[#DD1C24] hover:bg-[#b9151c] text-white" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add user
            </Button>
          )}
        </div>
      </div>

      <div className="mt-5 rounded-xl border bg-white overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 border-b"><tr>{["User", "Role", "Active", "Last login", ""].map((h) => <th key={h} className="text-left px-4 py-2.5 font-semibold text-slate-500">{h}</th>)}</tr></thead>
          <tbody>
            {loading && <tr><td colSpan={5} className="px-4 py-10 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-slate-300" /></td></tr>}
            {!loading && users.map((u) => (
              <tr key={u.id} className="border-b last:border-0 hover:bg-slate-50/60">
                <td className="px-4 py-3">
                  <div className="font-semibold text-slate-700">{u.name} {u.id === me?.id && <span className="text-[10px] text-slate-400">(you)</span>}</div>
                  <div className="text-[11px] text-slate-400">{u.email}</div>
                </td>
                <td className="px-4 py-3">
                  {isAdmin && u.id !== me.id ? (
                    <select value={u.role} onChange={(e) => patch(u.id, { role: e.target.value })} className="h-8 rounded-md border bg-white px-2 text-xs">
                      <option value="ADMIN">Admin</option><option value="EDITOR">Editor</option><option value="VIEWER">Viewer</option>
                    </select>
                  ) : (
                    <Badge variant="outline" className={ROLE_META[u.role].cls}><ShieldCheck className="h-3 w-3 mr-1" />{ROLE_META[u.role].label}</Badge>
                  )}
                </td>
                <td className="px-4 py-3">
                  {isAdmin && u.id !== me.id ? (
                    <Switch checked={u.active} onCheckedChange={(v) => patch(u.id, { active: v })} />
                  ) : (
                    <Badge variant="outline" className={u.active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200"}>{u.active ? "active" : "disabled"}</Badge>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-400">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" }) : "never"}</td>
                <td className="px-4 py-3 text-right">
                  {isAdmin && u.id !== me.id && (
                    <Button variant="ghost" size="sm" className="h-7 text-red-500" onClick={async () => { if (confirm(`Delete ${u.email}?`)) { try { await api(`/api/users/${u.id}`, { method: "DELETE" }); load(); } catch (e) { toast({ title: "Delete failed", description: (e as Error).message, variant: "destructive" }); } } }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 grid sm:grid-cols-3 gap-3">
        {Object.entries(ROLE_META).map(([k, v]) => (
          <div key={k} className="rounded-xl border bg-white p-4">
            <Badge variant="outline" className={v.cls}><ShieldCheck className="h-3 w-3 mr-1" />{v.label}</Badge>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">{v.desc}</p>
          </div>
        ))}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle className="text-sm">Add user</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label className="text-xs">Email</Label><Input value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} placeholder="name@map.co.id" className="h-9" /></div>
            <div className="space-y-1"><Label className="text-xs">Full name</Label><Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className="h-9" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">Role</Label>
                <select value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))} className="h-9 w-full rounded-md border bg-white px-2 text-sm">
                  <option value="ADMIN">Admin</option><option value="EDITOR">Editor</option><option value="VIEWER">Viewer</option>
                </select></div>
              <div className="space-y-1"><Label className="text-xs">Temp password</Label><Input type="password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} className="h-9" /></div>
            </div>
          </div>
          <DialogFooter><Button onClick={create} disabled={busy || !form.email || !form.name || !form.password} className="bg-[#DD1C24] hover:bg-[#b9151c] text-white">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create user"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
