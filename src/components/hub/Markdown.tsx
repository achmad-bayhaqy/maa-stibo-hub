"use client";

import React from "react";
import { cn } from "@/lib/utils";

/**
 * Lightweight markdown renderer for Documentation Center bodies.
 * Supports: #/##/### headings, paragraphs, bullet & numbered lists,
 * pipe tables, ``` fenced code blocks, > quotes, **bold**, `inline code`, [links](target).
 * Internal doc links (/doc/<slug>) are converted to buttons via onNavigate.
 */
export function Markdown({ text, onNavigate }: { text: string; onNavigate?: (slug: string) => void }) {
  const blocks = React.useMemo(() => parseBlocks(text), [text]);
  return (
    <div className="space-y-3 text-sm leading-relaxed text-slate-700">
      {blocks.map((b, i) => (
        <MarkdownBlock key={i} block={b} onNavigate={onNavigate} />
      ))}
    </div>
  );
}

type Block =
  | { kind: "h"; level: 1 | 2 | 3; text: string }
  | { kind: "p"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "table"; header: string[]; rows: string[][] }
  | { kind: "code"; text: string }
  | { kind: "quote"; text: string };

function parseBlocks(md: string): Block[] {
  const lines = md.split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("```")) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) buf.push(lines[i++]);
      i++; // closing fence
      blocks.push({ kind: "code", text: buf.join("\n") });
      continue;
    }
    const h = line.match(/^(#{1,3})\s+(.*)/);
    if (h) {
      blocks.push({ kind: "h", level: h[1].length as 1 | 2 | 3, text: h[2] });
      i++;
      continue;
    }
    if (/^\|.*\|/.test(line)) {
      const tbl: string[][] = [];
      while (i < lines.length && /^\|/.test(lines[i])) {
        const cells = lines[i].split("|").slice(1, -1).map((c) => c.trim());
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) tbl.push(cells);
        i++;
      }
      if (tbl.length) blocks.push({ kind: "table", header: tbl[0], rows: tbl.slice(1) });
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) items.push(lines[i++].replace(/^[-*]\s+/, ""));
      blocks.push({ kind: "ul", items });
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) items.push(lines[i++].replace(/^\d+\.\s+/, ""));
      blocks.push({ kind: "ol", items });
      continue;
    }
    if (line.startsWith("> ")) {
      const buf: string[] = [];
      while (i < lines.length && lines[i].startsWith("> ")) buf.push(lines[i++].slice(2));
      blocks.push({ kind: "quote", text: buf.join(" ") });
      continue;
    }
    if (line.trim() === "") { i++; continue; }
    const buf: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !/^(#{1,3}\s|\||```|[-*]\s|\d+\.\s|>\s)/.test(lines[i])) buf.push(lines[i++]);
    blocks.push({ kind: "p", text: buf.join(" ") });
  }
  return blocks;
}

function MarkdownBlock({ block, onNavigate }: { block: Block; onNavigate?: (slug: string) => void }) {
  switch (block.kind) {
    case "h": {
      const Tag = ({ 1: "h1", 2: "h2", 3: "h3" } as const)[block.level];
      const cls = {
        1: "text-lg font-bold text-slate-900 pt-2 border-b pb-1.5",
        2: "text-[15px] font-bold text-slate-800 pt-1.5",
        3: "text-sm font-semibold text-slate-700",
      }[block.level];
      return React.createElement(Tag, { className: cls }, <Inline text={block.text} onNavigate={onNavigate} />);
    }
    case "p":
      return <p><Inline text={block.text} onNavigate={onNavigate} /></p>;
    case "ul":
      return (
        <ul className="list-disc pl-5 space-y-1">
          {block.items.map((it, i) => <li key={i}><Inline text={it} onNavigate={onNavigate} /></li>)}
        </ul>
      );
    case "ol":
      return (
        <ol className="list-decimal pl-5 space-y-1">
          {block.items.map((it, i) => <li key={i}><Inline text={it} onNavigate={onNavigate} /></li>)}
        </ol>
      );
    case "quote":
      return (
        <blockquote className="border-l-4 border-orange-400 bg-orange-50/60 rounded-r-lg px-4 py-2.5 text-slate-700">
          <Inline text={block.text} onNavigate={onNavigate} />
        </blockquote>
      );
    case "code":
      return (
        <pre className="bg-[#0B1626] text-slate-200 rounded-lg p-3.5 overflow-x-auto text-xs font-mono leading-relaxed">
          {block.text}
        </pre>
      );
    case "table":
      return (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b">
              <tr>{block.header.map((h, i) => <th key={i} className="text-left px-3 py-2 font-semibold text-slate-600 whitespace-nowrap">{h}</th>)}</tr>
            </thead>
            <tbody>
              {block.rows.map((r, ri) => (
                <tr key={ri} className="border-b last:border-0 hover:bg-slate-50/60">
                  {r.map((c, ci) => <td key={ci} className="px-3 py-2 align-top"><Inline text={c} onNavigate={onNavigate} /></td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    default:
      return null;
  }
}

/** Inline formatting: **bold**, `code`, [label](/doc/slug) */
export function Inline({ text, onNavigate, className }: { text: string; onNavigate?: (slug: string) => void; className?: string }) {
  const parts = React.useMemo(() => {
    const out: React.ReactNode[] = [];
    const re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
    let last = 0;
    let m: RegExpExecArray | null;
    let key = 0;
    while ((m = re.exec(text))) {
      if (m.index > last) out.push(text.slice(last, m.index));
      const tok = m[0];
      if (tok.startsWith("**")) out.push(<strong key={key++} className="font-semibold text-slate-900">{tok.slice(2, -2)}</strong>);
      else if (tok.startsWith("`")) out.push(<code key={key++} className="px-1.5 py-0.5 rounded bg-slate-100 border text-[12px] font-mono text-slate-700">{tok.slice(1, -1)}</code>);
      else {
        const lm = tok.match(/\[([^\]]+)\]\(([^)]+)\)/);
        if (lm) {
          const [, label, href] = lm;
          const slugMatch = href.match(/^\/doc\/(.+)$/);
          if (slugMatch && onNavigate) {
            out.push(
              <button key={key++} onClick={() => onNavigate(slugMatch[1])}
                className="text-orange-600 font-medium hover:underline">
                {label}
              </button>
            );
          } else {
            out.push(<a key={key++} href={href} target="_blank" rel="noreferrer" className="text-sky-600 hover:underline">{label}</a>);
          }
        } else out.push(tok);
      }
      last = m.index + tok.length;
    }
    if (last < text.length) out.push(text.slice(last));
    return out;
  }, [text, onNavigate]);
  return <span className={cn(className)}>{parts}</span>;
}
