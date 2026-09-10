"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "./Avatar";
import { Person, displayName, lifespan } from "@/lib/types";

export function SearchPalette({
  people,
  title,
  onPick,
  onClose,
}: {
  people: Person[];
  title: string;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const scored = people
      .map((p) => {
        const hay = [displayName(p), p.nickname, p.maidenName, p.location]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!q) return { p, score: 0 };
        const at = hay.indexOf(q);
        return { p, score: at < 0 ? -1 : 100 - at };
      })
      .filter((r) => r.score >= 0);
    scored.sort((a, b) => b.score - a.score || displayName(a.p).localeCompare(displayName(b.p)));
    return scored.slice(0, 40).map((r) => r.p);
  }, [people, query]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-stone-900/20 p-3 pt-[9vh] backdrop-blur-[2px] md:p-0 md:pt-[14vh]"
      onPointerDown={onClose}
    >
      <div
        className="w-full max-w-[520px] overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="border-b border-stone-100 px-4 pb-2 pt-3">
          <div className="mb-1.5 text-[11px] uppercase tracking-wide text-stone-400">{title}</div>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCursor(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setCursor((c) => Math.min(c + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setCursor((c) => Math.max(c - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                if (results[cursor]) onPick(results[cursor].id);
              } else if (e.key === "Escape") {
                onClose();
              }
            }}
            placeholder="Search by name, nickname, place…"
            className="w-full pb-2 text-[15px] outline-none placeholder:text-stone-300"
          />
        </div>
        <div className="max-h-[52dvh] overflow-y-auto overscroll-contain p-1.5">
          {results.length === 0 && (
            <div className="px-3 py-6 text-center text-[13px] text-stone-400">No one found</div>
          )}
          {results.map((p, i) => (
            <button
              key={p.id}
              onMouseEnter={() => setCursor(i)}
              onClick={() => onPick(p.id)}
              className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left md:py-2 ${
                i === cursor ? "bg-amber-50" : ""
              }`}
            >
              <Avatar person={p} size={30} />
              <span className="flex-1 truncate text-[14px] text-stone-800 md:text-[13px]">
                {displayName(p)}
              </span>
              <span className="text-[11px] tabular-nums text-stone-400">{lifespan(p)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
