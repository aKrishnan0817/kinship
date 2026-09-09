"use client";

import { useEffect, useRef, useState } from "react";
import { addRelative } from "@/app/actions";
import { Person, displayName } from "@/lib/types";

export type Relation = "parent" | "spouse" | "child" | "sibling";

const LABELS: Record<Relation, string> = {
  parent: "parent",
  spouse: "spouse / partner",
  child: "child",
  sibling: "sibling",
};

type Gender = "male" | "female" | "other" | null;

export function QuickAdd({
  anchor,
  relation,
  onClose,
  onSaved,
}: {
  anchor: Person;
  relation: Relation;
  onClose: () => void;
  onSaved: (newId: string) => void;
}) {
  const [name, setName] = useState("");
  const [gender, setGender] = useState<Gender>(null);
  const [added, setAdded] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    const [firstName, ...rest] = trimmed.split(/\s+/);
    const res = await addRelative({
      anchorId: anchor.id,
      relation,
      firstName,
      lastName: rest.join(" ") || undefined,
      gender,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setAdded((prev) => [...prev, trimmed]);
    setName("");
    setGender(null);
    onSaved(res.personId);
    inputRef.current?.focus();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-stone-900/20 pt-[18vh] backdrop-blur-[2px]"
      onMouseDown={onClose}
    >
      <div
        className="w-[460px] rounded-2xl border border-stone-200 bg-white p-5 shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-3 text-[13px] text-stone-500">
          Add a <span className="font-semibold text-stone-800">{LABELS[relation]}</span> for{" "}
          <span className="font-semibold text-stone-800">{displayName(anchor)}</span>
        </div>

        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
            if (e.key === "Escape") onClose();
          }}
          placeholder="Full name"
          className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-[15px] outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
        />

        <div className="mt-3 flex gap-1.5">
          {(["male", "female", "other"] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGender((cur) => (cur === g ? null : g))}
              className={`rounded-md border px-3 py-1 text-[12px] capitalize transition-colors ${
                gender === g
                  ? "border-amber-400 bg-amber-50 text-amber-900"
                  : "border-stone-200 text-stone-500 hover:border-stone-300"
              }`}
            >
              {g}
            </button>
          ))}
          <div className="flex-1" />
          <button
            type="button"
            onClick={submit}
            disabled={!name.trim() || busy}
            className="rounded-md bg-stone-900 px-3.5 py-1.5 text-[12px] font-medium text-white disabled:opacity-30"
          >
            Add
          </button>
        </div>

        {error && <div className="mt-3 text-[12px] text-rose-600">{error}</div>}

        {added.length > 0 && (
          <div className="mt-4 border-t border-stone-100 pt-3">
            <div className="mb-1.5 text-[11px] uppercase tracking-wide text-stone-400">
              Added {added.length}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {added.map((n, i) => (
                <span key={i} className="rounded bg-stone-100 px-2 py-0.5 text-[12px] text-stone-700">
                  {n}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 text-[11px] text-stone-400">
          <kbd className="rounded border border-stone-200 px-1">Enter</kbd> adds and stays open ·{" "}
          <kbd className="rounded border border-stone-200 px-1">Esc</kbd> to finish
        </div>
      </div>
    </div>
  );
}
