"use client";

import { Handle, Position, NodeProps } from "@xyflow/react";
import { Avatar } from "./Avatar";
import { Person, displayName, lifespan } from "@/lib/types";

export type PersonNodeData = {
  person: Person;
  selected: boolean;
  onPath: boolean;
  dimmed: boolean;
  onViewPhoto: (id: string) => void;
};

const hidden = { opacity: 0, width: 1, height: 1, border: "none", background: "transparent" };

export function PersonNode({ data }: NodeProps) {
  const { person, selected, onPath, dimmed, onViewPhoto } = data as unknown as PersonNodeData;
  const years = lifespan(person);

  const ring = selected
    ? "ring-2 ring-amber-500 border-amber-300"
    : onPath
      ? "ring-2 ring-sky-400 border-sky-200"
      : person.isSelf
        ? "border-amber-300"
        : "border-stone-200";

  return (
    <div
      className={`group flex h-[78px] w-[196px] items-center gap-3 rounded-xl border bg-white px-3 shadow-sm transition-all hover:shadow-md ${ring} ${
        dimmed ? "opacity-25" : "opacity-100"
      } ${person.deceased ? "bg-stone-50" : ""}`}
    >
      <Handle type="target" position={Position.Top} style={hidden} />
      {/* Click bubbles up to select the person as well as opening the photo. */}
      <button
        onClick={() => person.photoUrl && onViewPhoto(person.id)}
        className={person.photoUrl ? "shrink-0 rounded-full hover:ring-2 hover:ring-amber-400" : "shrink-0"}
        title={person.photoUrl ? "See this photo bigger" : undefined}
      >
        <Avatar person={person} />
      </button>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold leading-tight text-stone-900">
          {displayName(person)}
        </div>
        {person.nickname && (
          <div className="truncate text-[11px] leading-tight text-stone-500">
            &ldquo;{person.nickname}&rdquo;
          </div>
        )}
        {years && <div className="mt-0.5 text-[11px] tabular-nums text-stone-400">{years}</div>}
        {person.isSelf && (
          <div className="mt-0.5 inline-block rounded bg-amber-100 px-1.5 text-[10px] font-medium text-amber-800">
            you
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} style={hidden} />
    </div>
  );
}

export function UnionNode({ data }: NodeProps) {
  const { dimmed } = data as { dimmed: boolean };
  return (
    <div
      className={`h-[14px] w-[14px] rounded-full border-2 border-white bg-stone-300 shadow-sm transition-opacity ${
        dimmed ? "opacity-25" : "opacity-100"
      }`}
    >
      <Handle type="target" position={Position.Top} style={hidden} />
      <Handle type="source" position={Position.Bottom} style={hidden} />
    </div>
  );
}

export const nodeTypes = { person: PersonNode, union: UnionNode };
