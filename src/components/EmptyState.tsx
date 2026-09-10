"use client";

import { useState } from "react";
import { createFirstPerson } from "@/app/actions";

export function EmptyState({ onCreated }: { onCreated: (id: string) => void }) {
  const [name, setName] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "other" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!name.trim()) return;
    const [firstName, ...rest] = name.trim().split(/\s+/);
    const res = await createFirstPerson({ firstName, lastName: rest.join(" ") || undefined, gender });
    if (!res.ok) return setError(res.error);
    onCreated(res.personId);
  }

  return (
    <div className="flex h-[100dvh] w-full items-center justify-center bg-[#faf9f7] px-6">
      <div className="w-full max-w-[420px]">
        <h1 className="text-[22px] font-semibold text-stone-900">Start with yourself</h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-stone-500">
          Add your own name first. Everyone else hangs off you, and every relationship gets
          described from your point of view.
        </p>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Your full name"
          className="mt-5 w-full rounded-lg border border-stone-300 px-3 py-2.5 text-[15px] outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
        />
        <div className="mt-3 flex items-center gap-1.5">
          {(["male", "female", "other"] as const).map((g) => (
            <button
              key={g}
              onClick={() => setGender((cur) => (cur === g ? null : g))}
              className={`rounded-md border px-3 py-2 text-[13px] capitalize md:py-1 md:text-[12px] ${
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
            onClick={submit}
            disabled={!name.trim()}
            className="rounded-md bg-stone-900 px-4 py-2 text-[13px] font-medium text-white disabled:opacity-30 md:py-1.5 md:text-[12px]"
          >
            Begin
          </button>
        </div>
        {error && <div className="mt-3 text-[12px] text-rose-600">{error}</div>}
      </div>
    </div>
  );
}
