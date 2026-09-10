"use client";

import { useRef, useState } from "react";
import { Avatar } from "./Avatar";
import { Relation } from "./QuickAdd";
import { deletePerson, setSelf, updatePerson } from "@/app/actions";
import { GraphIndex, describeRelationship, renderChain } from "@/lib/kinship";
import { Person, Social, displayName } from "@/lib/types";

function Field({
  label,
  value,
  placeholder,
  multiline,
  onCommit,
}: {
  label: string;
  value: string;
  placeholder?: string;
  multiline?: boolean;
  onCommit: (next: string) => void;
}) {
  const [draft, setDraft] = useState(value);

  const shared = {
    value: draft,
    placeholder,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setDraft(e.target.value),
    onBlur: () => draft !== value && onCommit(draft),
    className:
      "w-full rounded-md border border-transparent bg-stone-50 px-2 py-1.5 text-[13px] text-stone-800 outline-none transition-colors placeholder:text-stone-300 hover:border-stone-200 focus:border-amber-400 focus:bg-white",
  };

  return (
    <label className="block">
      <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-stone-400">
        {label}
      </div>
      {multiline ? (
        <textarea {...shared} rows={4} className={`${shared.className} resize-y leading-relaxed`} />
      ) : (
        <input
          {...shared}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        />
      )}
    </label>
  );
}

export function DetailPanel({
  person,
  index,
  anchor,
  onChanged,
  onAdd,
  onSelect,
  onClose,
  onViewPhoto,
}: {
  person: Person;
  index: GraphIndex;
  anchor: Person | null;
  onChanged: () => void;
  onAdd: (relation: Relation) => void;
  onSelect: (id: string) => void;
  onClose: () => void;
  onViewPhoto: () => void;
}) {
  /**
   * Mobile only: the panel is a bottom sheet that opens as a peek — photo, name,
   * how you're related — and expands to the full form. On desktop it stays a
   * plain sidebar and this is ignored.
   */
  const [expanded, setExpanded] = useState(false);
  const drag = useRef<{ y: number; moved: boolean } | null>(null);

  function grabDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { y: e.clientY, moved: false };
  }

  function grabMove(e: React.PointerEvent<HTMLDivElement>) {
    if (drag.current && Math.abs(e.clientY - drag.current.y) > 5) drag.current.moved = true;
  }

  function grabUp(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    drag.current = null;
    const dy = e.clientY - d.y;
    if (!d.moved) {
      setExpanded((v) => !v);
    } else if (dy < -40) {
      setExpanded(true);
    } else if (dy > 60) {
      // Swiping down backs out one step at a time rather than always dismissing.
      if (expanded) setExpanded(false);
      else onClose();
    }
  }

  async function patch(data: Parameters<typeof updatePerson>[1]) {
    await updatePerson(person.id, data);
    onChanged();
  }

  const rel = anchor && anchor.id !== person.id ? describeRelationship(index, anchor.id, person.id) : null;
  const chain = anchor && rel ? renderChain(anchor, rel.path) : [];
  const socials: Social[] = person.socials;

  return (
    <aside
      className={`fixed inset-x-0 bottom-0 z-40 flex max-h-[88dvh] flex-col rounded-t-2xl border-t border-stone-200 bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_28px_rgba(28,25,23,0.14)] md:static md:h-full md:w-[340px] md:max-h-none md:shrink-0 md:rounded-none md:border-l md:border-t-0 md:pb-0 md:shadow-none ${
        expanded ? "h-[88dvh]" : ""
      }`}
    >
      <div
        onPointerDown={grabDown}
        onPointerMove={grabMove}
        onPointerUp={grabUp}
        onPointerCancel={grabUp}
        className="flex shrink-0 touch-none justify-center pb-1 pt-2.5 md:hidden"
      >
        <div className="h-1 w-10 rounded-full bg-stone-300" />
      </div>

      <div className="flex shrink-0 items-start gap-3 border-b border-stone-100 p-4 pt-2 md:pt-4">
        <button
          onClick={onViewPhoto}
          className="relative shrink-0"
          title={person.photoUrl ? "View and adjust photo" : "Add a photo"}
        >
          <Avatar person={person} size={56} />
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-[10px] font-medium text-white opacity-0 transition-opacity hover:opacity-100">
            {person.photoUrl ? "view" : "add"}
          </span>
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold text-stone-900">
            {displayName(person)}
          </div>
          {rel && (
            <div className="mt-0.5 text-[12px] text-stone-500">
              {rel.term ? (
                <>
                  your <span className="font-medium text-amber-700">{rel.term}</span>
                </>
              ) : rel.connected ? (
                "related by marriage"
              ) : (
                "not yet connected"
              )}
            </div>
          )}
          {person.isSelf && <div className="mt-0.5 text-[12px] text-amber-700">this is you</div>}
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? "Show less" : "Show all details"}
          className="flex h-9 w-9 shrink-0 items-center justify-center text-stone-400 active:text-stone-800 md:hidden"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`}
            aria-hidden
          >
            <path d="m6 15 6-6 6 6" />
          </svg>
        </button>
        <button
          onClick={onClose}
          aria-label="Close"
          title="Close"
          className="-mr-1 flex h-9 w-9 shrink-0 items-center justify-center text-stone-300 hover:text-stone-600 md:mr-0 md:h-auto md:w-auto"
        >
          ✕
        </button>
      </div>

      {chain.length > 1 && (
        <div className="max-h-[26dvh] shrink-0 overflow-y-auto border-b border-stone-100 bg-stone-50/60 px-4 py-3 md:max-h-none">
          <div className="mb-1.5 text-[11px] uppercase tracking-wide text-stone-400">How you connect</div>
          <div className="space-y-0.5 text-[12px] leading-relaxed text-stone-600">
            {chain.map((line, i) => (
              <div key={i}>
                <span className="mr-1 text-stone-300">{i === 0 ? "↳" : "↳"}</span>
                {line}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex shrink-0 flex-wrap gap-1.5 border-b border-stone-100 p-3">
        {(["parent", "spouse", "child", "sibling"] as const).map((r) => (
          <button
            key={r}
            onClick={() => onAdd(r)}
            className="rounded-md border border-stone-200 px-3 py-1.5 text-[13px] text-stone-600 transition-colors hover:border-amber-400 hover:bg-amber-50 hover:text-amber-900 md:px-2.5 md:py-1 md:text-[12px]"
          >
            + {r}
          </button>
        ))}
      </div>

      <div
        className={`flex-1 space-y-3.5 overflow-y-auto p-4 ${expanded ? "block" : "hidden"} md:block`}
      >
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="First name" value={person.firstName} onCommit={(v) => v.trim() && patch({ firstName: v })} />
          <Field label="Last name" value={person.lastName ?? ""} onCommit={(v) => patch({ lastName: v })} />
          <Field label="Nickname" value={person.nickname ?? ""} onCommit={(v) => patch({ nickname: v })} />
          <Field label="Maiden name" value={person.maidenName ?? ""} onCommit={(v) => patch({ maidenName: v })} />
        </div>

        <div>
          <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-stone-400">Gender</div>
          <div className="flex gap-1.5">
            {(["male", "female", "other"] as const).map((g) => (
              <button
                key={g}
                onClick={() => patch({ gender: person.gender === g ? null : g })}
                className={`rounded-md border px-3 py-1.5 text-[13px] capitalize md:px-2.5 md:py-1 md:text-[12px] ${
                  person.gender === g
                    ? "border-amber-400 bg-amber-50 text-amber-900"
                    : "border-stone-200 text-stone-500 hover:border-stone-300"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Born" value={person.birthDate ?? ""} placeholder="1954 or 1954-03-12" onCommit={(v) => patch({ birthDate: v })} />
          <Field label="Died" value={person.deathDate ?? ""} placeholder="2019" onCommit={(v) => patch({ deathDate: v })} />
        </div>

        <label className="flex items-center gap-2 py-1 text-[13px] text-stone-600">
          <input
            type="checkbox"
            checked={person.deceased}
            onChange={(e) => patch({ deceased: e.target.checked })}
            className="h-4 w-4 accent-amber-600"
          />
          Deceased
        </label>

        <Field label="Lives in" value={person.location ?? ""} placeholder="New York, USA" onCommit={(v) => patch({ location: v })} />
        <Field label="Email" value={person.email ?? ""} onCommit={(v) => patch({ email: v })} />
        <Field label="Phone" value={person.phone ?? ""} onCommit={(v) => patch({ phone: v })} />
        <Field label="About" value={person.bio ?? ""} multiline placeholder="What should the family know about them?" onCommit={(v) => patch({ bio: v })} />

        <div>
          <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-stone-400">Links</div>
          <div className="space-y-1.5">
            {socials.map((s, i) => (
              <div key={i} className="flex gap-1.5">
                <input
                  defaultValue={s.label}
                  placeholder="Instagram"
                  onBlur={(e) => {
                    const next = socials.map((x, j) => (j === i ? { ...x, label: e.target.value } : x));
                    patch({ socials: next });
                  }}
                  className="w-24 rounded-md bg-stone-50 px-2 py-1.5 text-[12px] outline-none focus:bg-white"
                />
                <input
                  defaultValue={s.url}
                  placeholder="https://…"
                  onBlur={(e) => {
                    const next = socials.map((x, j) => (j === i ? { ...x, url: e.target.value } : x));
                    patch({ socials: next });
                  }}
                  className="min-w-0 flex-1 rounded-md bg-stone-50 px-2 py-1.5 text-[12px] outline-none focus:bg-white"
                />
                <button
                  onClick={() => patch({ socials: socials.filter((_, j) => j !== i) })}
                  className="px-1 text-stone-300 hover:text-rose-600"
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              onClick={() => patch({ socials: [...socials, { label: "", url: "" }] })}
              className="text-[12px] text-stone-400 hover:text-stone-700"
            >
              + add link
            </button>
          </div>
        </div>
      </div>

      <div
        className={`shrink-0 items-center gap-2 border-t border-stone-100 p-3 ${
          expanded ? "flex" : "hidden"
        } md:flex`}
      >
        {!person.isSelf && (
          <button
            onClick={async () => {
              await setSelf(person.id);
              onChanged();
            }}
            className="rounded-md border border-stone-200 px-3 py-1.5 text-[13px] text-stone-600 hover:border-amber-400 hover:bg-amber-50 md:px-2.5 md:py-1 md:text-[12px]"
          >
            This is me
          </button>
        )}
        <div className="flex-1" />
        <button
          onClick={async () => {
            if (!confirm(`Delete ${displayName(person)}? This cannot be undone.`)) return;
            const fallback = index.parentIds(person.id)[0] ?? index.spouseIds(person.id)[0] ?? null;
            await deletePerson(person.id);
            onChanged();
            if (fallback) onSelect(fallback);
            else onClose();
          }}
          className="rounded-md px-3 py-1.5 text-[13px] text-stone-400 hover:bg-rose-50 hover:text-rose-600 md:px-2.5 md:py-1 md:text-[12px]"
        >
          Delete
        </button>
      </div>
    </aside>
  );
}
