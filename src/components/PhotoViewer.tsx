"use client";

import { useEffect, useRef, useState } from "react";
import { framingStyle } from "./Avatar";
import { updatePerson } from "@/app/actions";
import { Person, displayName } from "@/lib/types";

/** Widest the crop circle gets; it shrinks to fit narrow screens. */
const CROP_SIZE = 300;
const MIN_SCALE = 1;
const MAX_SCALE = 4;

export function PhotoViewer({
  person,
  onClose,
  onChanged,
}: {
  person: Person;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [adjusting, setAdjusting] = useState(false);
  const [x, setX] = useState(person.photoX);
  const [y, setY] = useState(person.photoY);
  const [scale, setScale] = useState(person.photoScale);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const cropRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<{ px: number; py: number; x: number; y: number } | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function commit(next?: { x?: number; y?: number; scale?: number }) {
    await updatePerson(person.id, {
      photoX: next?.x ?? x,
      photoY: next?.y ?? y,
      photoScale: next?.scale ?? scale,
    });
    onChanged();
  }

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    const body = new FormData();
    body.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body });
    const json = await res.json();
    setUploading(false);
    if (!res.ok) return setError(json.error ?? "Upload failed");
    // A new photo invalidates the old framing.
    setX(50);
    setY(50);
    setScale(1);
    await updatePerson(person.id, { photoUrl: json.url, photoX: 50, photoY: 50, photoScale: 1 });
    onChanged();
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragging.current = { px: e.clientX, py: e.clientY, x, y };
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = dragging.current;
    if (!d) return;
    // Measured, not assumed: the circle shrinks on narrow screens, and a stale
    // size here would make the photo drift faster or slower than your finger.
    const size = cropRef.current?.offsetWidth || CROP_SIZE;
    // Dragging right reveals more of the image's left edge, so the focal point moves left.
    const nx = d.x - ((e.clientX - d.px) / size) * 100;
    const ny = d.y - ((e.clientY - d.py) / size) * 100;
    setX(Math.min(100, Math.max(0, nx)));
    setY(Math.min(100, Math.max(0, ny)));
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging.current) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    dragging.current = null;
    commit();
  }

  const hasPhoto = Boolean(person.photoUrl);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-stone-900/70 backdrop-blur-sm sm:p-8"
      onPointerDown={onClose}
    >
      <div
        className="flex h-full w-full flex-col overflow-hidden bg-white pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] shadow-2xl sm:h-auto sm:max-h-full sm:w-auto sm:max-w-[min(90vw,900px)] sm:rounded-2xl sm:pb-0 sm:pt-0"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-stone-100 px-4 py-3 sm:px-5">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-semibold text-stone-900">
              {displayName(person)}
            </div>
            {adjusting && (
              <div className="text-[12px] text-stone-500">
                Drag the photo to reposition it, then zoom to taste
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 flex h-9 w-9 shrink-0 items-center justify-center text-stone-300 hover:text-stone-600 sm:mr-0 sm:h-auto sm:w-auto"
          >
            ✕
          </button>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto bg-stone-50 p-4 sm:p-6">
          {!hasPhoto ? (
            <div className="px-10 py-16 text-center">
              <div className="text-[13px] text-stone-400">No photo yet</div>
              <button
                onClick={() => fileRef.current?.click()}
                className="mt-3 rounded-md bg-stone-900 px-3.5 py-1.5 text-[12px] font-medium text-white"
              >
                {uploading ? "Uploading…" : "Upload a photo"}
              </button>
            </div>
          ) : adjusting ? (
            <div className="flex flex-col items-center gap-4">
              <div
                ref={cropRef}
                className="relative aspect-square w-[min(300px,72vw)] cursor-grab touch-none overflow-hidden rounded-full ring-4 ring-white active:cursor-grabbing"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={person.photoUrl!}
                  alt=""
                  draggable={false}
                  style={framingStyle(x, y, scale)}
                  className="select-none"
                />
              </div>

              <div className="flex w-[min(300px,72vw)] items-center gap-3">
                <span className="text-[11px] text-stone-400">Zoom</span>
                <input
                  type="range"
                  min={MIN_SCALE}
                  max={MAX_SCALE}
                  step={0.05}
                  value={scale}
                  onChange={(e) => setScale(Number(e.target.value))}
                  onPointerUp={() => commit()}
                  onKeyUp={() => commit()}
                  className="h-6 flex-1 accent-amber-600"
                />
                <button
                  onClick={() => {
                    setX(50);
                    setY(50);
                    setScale(1);
                    commit({ x: 50, y: 50, scale: 1 });
                  }}
                  className="text-[11px] text-stone-400 hover:text-stone-700"
                >
                  Reset
                </button>
              </div>

              <div className="flex items-center gap-2.5 text-[11px] text-stone-400">
                <span>Appears as</span>
                <div className="h-11 w-11 overflow-hidden rounded-full ring-1 ring-black/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={person.photoUrl!} alt="" style={framingStyle(x, y, scale)} />
                </div>
                <div className="h-7 w-7 overflow-hidden rounded-full ring-1 ring-black/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={person.photoUrl!} alt="" style={framingStyle(x, y, scale)} />
                </div>
              </div>
            </div>
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={person.photoUrl!}
              alt={displayName(person)}
              className="max-h-full max-w-full rounded-lg object-contain shadow-sm sm:max-h-[65dvh]"
            />
          )}
        </div>

        {error && <div className="px-5 pt-2 text-[12px] text-rose-600">{error}</div>}

        <div className="flex shrink-0 items-center gap-2 border-t border-stone-100 px-4 py-3 sm:px-5">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
          />
          {hasPhoto && (
            <>
              <button
                onClick={() => setAdjusting((a) => !a)}
                className={`rounded-md border px-3 py-2 text-[12px] transition-colors sm:py-1.5 ${
                  adjusting
                    ? "border-amber-400 bg-amber-50 text-amber-900"
                    : "border-stone-200 text-stone-600 hover:border-stone-300"
                }`}
              >
                {adjusting ? "Done" : "Adjust"}
                <span className="hidden sm:inline">{adjusting ? " adjusting" : " framing"}</span>
              </button>
              <button
                onClick={() => fileRef.current?.click()}
                className="rounded-md border border-stone-200 px-3 py-2 text-[12px] text-stone-600 hover:border-stone-300 sm:py-1.5"
              >
                {uploading ? "Uploading…" : "Replace"}
                <span className="hidden sm:inline"> photo</span>
              </button>
            </>
          )}
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="rounded-md bg-stone-900 px-3.5 py-2 text-[12px] font-medium text-white sm:py-1.5"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
