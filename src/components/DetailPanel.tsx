"use client";

import { useState } from "react";
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
  async function patch(data: Parameters<typeof updatePerson>[1]) {
    await updatePerson(person.id, data);
    onChanged();
  }

  const rel = anchor && anchor.id !== person.id ? describeRelationship(index, anchor.id, person.id) : null;
  const chain = anchor && rel ? renderChain(anchor, rel.path) : [];
  const socials: Social[] = person.socials;

  return (
    <aside className="flex h-full w-[340px] shrink-0 flex-col border-l border-stone-200 bg-white">
      <div className="flex items-start gap-3 border-b border-stone-100 p-4">
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
        <button onClick={onClose} className="text-stone-300 hover:text-stone-600" title="Close">
          ✕
        </button>
      </div>

      {chain.length > 1 && (
        <div className="border-b border-stone-100 bg-stone-50/60 px-4 py-3">
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

      <div className="flex flex-wrap gap-1.5 border-b border-stone-100 p-3">
        {(["parent", "spouse", "child", "sibling"] as const).map((r) => (
          <button
            key={r}
            onClick={() => onAdd(r)}
            className="rounded-md border border-stone-200 px-2.5 py-1 text-[12px] text-stone-600 transition-colors hover:border-amber-400 hover:bg-amber-50 hover:text-amber-900"
          >
            + {r}
          </button>
        ))}
      </div>

      {/* Keyed on the person so every field's local draft resets when you select someone else. */}
      <div key={person.id} className="flex-1 space-y-3.5 overflow-y-auto p-4">
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
                className={`rounded-md border px-2.5 py-1 text-[12px] capitalize ${
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

        <label className="flex items-center gap-2 text-[13px] text-stone-600">
          <input
            type="checkbox"
            checked={person.deceased}
            onChange={(e) => patch({ deceased: e.target.checked })}
            className="accent-amber-600"
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

      <div className="flex items-center gap-2 border-t border-stone-100 p-3">
        {!person.isSelf && (
          <button
            onClick={async () => {
              await setSelf(person.id);
              onChanged();
            }}
            className="rounded-md border border-stone-200 px-2.5 py-1 text-[12px] text-stone-600 hover:border-amber-400 hover:bg-amber-50"
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
          className="rounded-md px-2.5 py-1 text-[12px] text-stone-400 hover:bg-rose-50 hover:text-rose-600"
        >
          Delete
        </button>
      </div>
    </aside>
  );
}
