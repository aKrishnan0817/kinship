import { Person, displayName } from "@/lib/types";

const PALETTE = [
  "bg-rose-200 text-rose-800",
  "bg-amber-200 text-amber-900",
  "bg-emerald-200 text-emerald-900",
  "bg-sky-200 text-sky-900",
  "bg-violet-200 text-violet-900",
  "bg-teal-200 text-teal-900",
  "bg-orange-200 text-orange-900",
];

function hueFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

function initials(p: Person): string {
  return [p.firstName?.[0], p.lastName?.[0]].filter(Boolean).join("").toUpperCase() || "?";
}

/** Framing shared by the avatar and the crop editor's preview, so they always agree. */
export function framingStyle(x: number, y: number, scale: number): React.CSSProperties {
  return {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    objectPosition: `${x}% ${y}%`,
    transform: `scale(${scale})`,
  };
}

export function Avatar({ person, size = 44 }: { person: Person; size?: number }) {
  const dim = { width: size, height: size };
  if (person.photoUrl) {
    return (
      <div
        style={dim}
        className="shrink-0 overflow-hidden rounded-full ring-1 ring-black/10"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={person.photoUrl}
          alt={displayName(person)}
          style={framingStyle(person.photoX, person.photoY, person.photoScale)}
        />
      </div>
    );
  }
  return (
    <div
      style={{ ...dim, fontSize: size * 0.36 }}
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold ring-1 ring-black/5 ${hueFor(person.id)}`}
    >
      {initials(person)}
    </div>
  );
}
