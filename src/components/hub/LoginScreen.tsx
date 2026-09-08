"use client";

import { useState } from "react";
import { useHub } from "@/lib/store";
import { api } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Hexagon, Loader2, ArrowRight, Lock, Database, Send, BarChart3 } from "lucide-react";

const FEATURES = [
  { icon: Database, title: "Auto-mapping engine", desc: "5,925 mapping rules · 47 LOV tables · RNA master lookup extracted from the Brand mapping Template & MDD." },
  { icon: Send, title: "Stibo IIEP integration", desc: "STEPXML preview → explicit user confirmation → OIDC client-credentials POST to Article Planning / EAN Update / Article Maintenance." },
  { icon: BarChart3, title: "Governed & audited", desc: "Role-based access, full audit trail, bgId receipts, and a safe MOCK mode for demos." },
];

export function LoginScreen() {
  const { setUser } = useHub();
  const [email, setEmail] = useState("admin@map.co.id");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const d = await api<{ user: import("@/lib/store").HubUser }>("/api/auth/login", {
        method: "POST", body: JSON.stringify({ email, password }),
      });
      setUser(d.user);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#0B1626]">
      {/* Brand panel */}
      <div className="lg:flex-1 flex flex-col justify-between p-8 lg:p-14 text-slate-200">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-orange-500/15 border border-orange-500/40 flex items-center justify-center">
            <Hexagon className="h-6 w-6 text-orange-400" />
          </div>
          <div>
            <div className="text-lg font-semibold text-white">STIBO Hub</div>
            <div className="text-xs text-slate-400">PT. MAP Aktif Adiperkasa Tbk · 0888</div>
          </div>
        </div>

        <div className="my-10 max-w-lg">
          <h1 className="text-3xl lg:text-4xl font-bold text-white leading-tight">
            Upload brand files.<br />Get Stibo-ready <span className="text-orange-400">STEPXML</span> in minutes.
          </h1>
          <p className="mt-4 text-sm text-slate-400 leading-relaxed">
            Portal untuk transformasi master data ritel: naming-convention validation, auto-mapping
            berbasis rule &amp; LOV, wizard Country/SBU/Brand/Season, lalu kirim ke Stibo STEP
            setelah konfirmasi Anda.
          </p>
          <div className="mt-8 space-y-5">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex gap-3.5">
                <div className="h-9 w-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                  <f.icon className="h-4.5 w-4.5 h-5 w-5 text-orange-400" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">{f.title}</div>
                  <div className="text-xs text-slate-400 leading-relaxed mt-0.5">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-[11px] text-slate-500">
          Internal use only · All AWS resources are tagged <span className="text-orange-500 font-mono">stibo</span> · AWS us-east-1
        </div>
      </div>

      {/* Login panel */}
      <div className="lg:w-[440px] bg-white p-8 lg:p-12 flex flex-col justify-center">
        <h2 className="text-xl font-bold text-slate-900">Sign in</h2>
        <p className="text-sm text-slate-500 mt-1">Master Data CoE accounts only.</p>

        <form onSubmit={submit} className="mt-8 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Work email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@map.co.id" required autoComplete="username" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required autoComplete="current-password" />
          </div>

          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>
          )}

          <Button type="submit" disabled={busy} className="w-full bg-orange-500 hover:bg-orange-600 text-white h-10">
            {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
            Sign in
          </Button>
        </form>

        <div className="mt-8 rounded-lg border bg-slate-50 p-4 text-xs text-slate-600 space-y-1.5">
          <div className="font-semibold text-slate-700">Demo accounts (seeded)</div>
          <div className="flex justify-between gap-2"><span className="font-mono">admin@map.co.id</span><span className="text-slate-400">ADMIN · Stibo@2026</span></div>
          <div className="flex justify-between gap-2"><span className="font-mono">md.coe@map.co.id</span><span className="text-slate-400">EDITOR · Stibo@2026</span></div>
          <div className="flex justify-between gap-2"><span className="font-mono">viewer@map.co.id</span><span className="text-slate-400">VIEWER · Stibo@2026</span></div>
        </div>

        <Button variant="ghost" className="mt-6 text-slate-400 text-xs" onClick={() => { setEmail("admin@map.co.id"); setPassword("Stibo@2026"); }}>
          Fill demo admin credentials <ArrowRight className="h-3.5 w-3.5 ml-1" />
        </Button>
      </div>
    </div>
  );
}
