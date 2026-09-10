"use client";

import "@xyflow/react/dist/style.css";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  Edge,
  Node,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import { DetailPanel } from "./DetailPanel";
import { EmptyState } from "./EmptyState";
import { PhotoViewer } from "./PhotoViewer";
import { QuickAdd, Relation } from "./QuickAdd";
import { SearchPalette } from "./SearchPalette";
import { nodeTypes } from "./nodes";
import { loadGraph } from "@/app/actions";
import { signOut } from "@/app/login/actions";
import { GraphIndex, describeRelationship, renderChain } from "@/lib/kinship";
import { PERSON_H, PERSON_W, Positioned, layoutGraph } from "@/lib/layout";
import { FamilyGraph, displayName } from "@/lib/types";
import { useMediaQuery } from "@/lib/useMediaQuery";

const SHORTCUTS: Record<string, Relation> = { p: "parent", s: "spouse", c: "child", b: "sibling" };

function Key({ k }: { k: string }) {
  return <kbd className="rounded border border-stone-200 bg-white px-1 text-stone-600">{k}</kbd>;
}

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px] shrink-0 md:h-[15px] md:w-[15px]"
      aria-hidden
    >
      {children}
    </svg>
  );
}

/**
 * Icon-first so the controls still fit a phone; the label appears once there's
 * room for it. Sized to a 40px touch target on mobile.
 */
function ToolButton({
  label,
  onClick,
  disabled,
  title,
  type = "button",
  children,
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  type?: "button" | "submit";
  children: React.ReactNode;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title ?? label}
      aria-label={label}
      className="flex h-10 w-10 items-center justify-center gap-1.5 rounded-xl border border-stone-200 bg-white/90 text-stone-600 shadow-sm backdrop-blur transition-colors active:bg-stone-100 disabled:opacity-40 md:h-8 md:w-auto md:rounded-lg md:px-2.5 md:text-[12px] md:hover:border-stone-300"
    >
      {children}
      <span className="hidden md:inline">{label}</span>
    </button>
  );
}

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return Boolean(el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable));
}

function Inner({ initialGraph, showSignOut }: { initialGraph: FamilyGraph; showSignOut: boolean }) {
  const [graph, setGraph] = useState(initialGraph);
  const [positions, setPositions] = useState<Map<string, Positioned>>(new Map());
  const [selectedId, setSelectedId] = useState<string | null>(
    initialGraph.people.find((p) => p.isSelf)?.id ?? initialGraph.people[0]?.id ?? null,
  );
  const [quickAdd, setQuickAdd] = useState<Relation | null>(null);
  const [palette, setPalette] = useState<"search" | "relate" | null>(null);
  const [relateTargetId, setRelateTargetId] = useState<string | null>(null);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const { setCenter, fitView } = useReactFlow();
  const isMobile = useMediaQuery("(max-width: 767px)");

  /**
   * On mobile the header floats over the canvas and the detail sheet covers the
   * bottom, so frame the tree into what's actually visible rather than into the
   * whole viewport, where it would sit half-hidden behind them.
   */
  const framing = useMemo(() => {
    if (!isMobile) return { fit: 0.15 as const, path: 0.3 as const };
    // `as const` keeps these as the `${number}px` literals the padding type wants.
    const box = {
      top: "72px",
      right: "16px",
      bottom: selectedId ? "220px" : "32px",
      left: "16px",
    } as const;
    return { fit: box, path: box };
  }, [isMobile, selectedId]);

  const index = useMemo(() => new GraphIndex(graph), [graph]);
  const anchor = useMemo(
    () => graph.people.find((p) => p.isSelf) ?? null,
    [graph.people],
  );
  const selected = selectedId ? (index.get(selectedId) ?? null) : null;

  const refresh = useCallback(async () => setGraph(await loadGraph()), []);

  useEffect(() => {
    let live = true;
    layoutGraph(graph).then((pos) => live && setPositions(pos));
    return () => {
      live = false;
    };
  }, [graph]);

  const focusOn = useCallback(
    (id: string) => {
      const pos = positions.get(id);
      if (pos) setCenter(pos.x + PERSON_W / 2, pos.y + PERSON_H / 2, { zoom: 1, duration: 400 });
    },
    [positions, setCenter],
  );

  const relationship = useMemo(() => {
    if (!anchor || !relateTargetId || relateTargetId === anchor.id) return null;
    return describeRelationship(index, anchor.id, relateTargetId);
  }, [anchor, relateTargetId, index]);

  /** Nodes and unions lying on the highlighted path, used to dim everything else. */
  const litIds = useMemo(() => {
    if (!anchor || !relationship?.connected) return null;
    const ids = new Set<string>([anchor.id]);
    let prev = anchor.id;
    for (const step of relationship.path) {
      const cur = step.person.id;
      ids.add(cur);
      if (step.kind === "parent") {
        const u = index.get(prev)?.childOfUnionId;
        if (u) ids.add(u);
      } else if (step.kind === "child") {
        const u = index.get(cur)?.childOfUnionId;
        if (u) ids.add(u);
      } else if (step.kind === "sibling") {
        const u = index.get(cur)?.childOfUnionId;
        if (u) ids.add(u);
      } else {
        const shared = index.unionsOf(prev).find((u) => u.partnerIds.includes(cur));
        if (shared) ids.add(shared.id);
      }
      prev = cur;
    }
    return ids;
  }, [anchor, relationship, index]);

  // Frame the whole chain rather than zooming to the target, so the connection stays legible.
  useEffect(() => {
    if (!relateTargetId || !litIds || positions.size === 0) return;
    fitView({
      nodes: [...litIds].map((id) => ({ id })),
      duration: 600,
      padding: framing.path,
      maxZoom: 1,
    });
  }, [relateTargetId, litIds, positions, fitView, framing]);

  const nodes = useMemo<Node[]>(() => {
    const dim = (id: string) => Boolean(litIds && !litIds.has(id));
    return [
      ...graph.people.map((person) => ({
        id: person.id,
        type: "person",
        position: positions.get(person.id) ?? { x: 0, y: 0 },
        draggable: false,
        data: {
          person,
          selected: person.id === selectedId,
          onPath: Boolean(litIds?.has(person.id)),
          dimmed: dim(person.id),
          onViewPhoto: setViewerId,
        },
      })),
      ...graph.unions.map((union) => ({
        id: union.id,
        type: "union",
        position: positions.get(union.id) ?? { x: 0, y: 0 },
        draggable: false,
        selectable: false,
        data: { dimmed: dim(union.id) },
      })),
    ];
  }, [graph, positions, selectedId, litIds]);

  const edges = useMemo<Edge[]>(() => {
    const lit = (a: string, b: string) => Boolean(litIds && litIds.has(a) && litIds.has(b));
    const style = (a: string, b: string) =>
      litIds
        ? lit(a, b)
          ? { stroke: "#0ea5e9", strokeWidth: 2 }
          : { stroke: "#e7e5e4", strokeWidth: 1.5 }
        : { stroke: "#d6d3d1", strokeWidth: 1.5 };

    return [
      ...graph.unions.flatMap((u) =>
        u.partnerIds.map((pid) => ({
          id: `p-${u.id}-${pid}`,
          source: pid,
          target: u.id,
          type: "smoothstep",
          pathOptions: { borderRadius: 8 },
          style: style(pid, u.id),
        })),
      ),
      ...graph.unions.flatMap((u) =>
        u.childIds.map((cid) => ({
          id: `c-${u.id}-${cid}`,
          source: u.id,
          target: cid,
          type: "smoothstep",
          pathOptions: { borderRadius: 8 },
          style: style(u.id, cid),
        })),
      ),
    ];
  }, [graph, litIds]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // The photo viewer is modal and runs its own Escape handler.
      if (isTyping(e.target) || viewerId) return;
      const key = e.key.toLowerCase();

      if ((e.metaKey || e.ctrlKey) && key === "k") {
        e.preventDefault();
        setPalette("search");
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (key === "escape") {
        setQuickAdd(null);
        setPalette(null);
        setRelateTargetId(null);
        return;
      }
      if (key === "/" || key === "f") {
        e.preventDefault();
        setPalette("search");
        return;
      }
      if (key === "r" && anchor) {
        e.preventDefault();
        setPalette("relate");
        return;
      }
      if (SHORTCUTS[key] && selectedId) {
        e.preventDefault();
        setQuickAdd(SHORTCUTS[key]);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, anchor, viewerId]);

  if (graph.people.length === 0) {
    return <EmptyState onCreated={async (id) => { await refresh(); setSelectedId(id); }} />;
  }

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-[#faf9f7]">
      <div className="relative min-w-0 flex-1">
        {/* Mounted only once elk has real coordinates, otherwise fitView frames nodes still at the origin. */}
        {positions.size > 0 ? (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: framing.fit, maxZoom: 1 }}
            minZoom={0.05}
            maxZoom={2}
            proOptions={{ hideAttribution: true }}
            onNodeClick={(_, node) => node.type === "person" && setSelectedId(node.id)}
            onPaneClick={() => setRelateTargetId(null)}
          >
            <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#e7e5e4" />
            {/* Pinch-to-zoom covers this on touch, and it would sit under the sheet. */}
            <Controls
              showInteractive={false}
              position="bottom-right"
              className="!hidden !shadow-sm md:!flex"
            />
          </ReactFlow>
        ) : (
          <div className="flex h-full items-center justify-center text-[13px] text-stone-400">
            Arranging the family…
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] md:p-4">
          <div className="pointer-events-auto rounded-xl border border-stone-200 bg-white/90 px-3 py-2 shadow-sm backdrop-blur md:px-3.5 md:py-2.5">
            <div className="text-[13px] font-semibold leading-tight text-stone-900">Family</div>
            <div className="text-[11px] leading-tight text-stone-500">
              {graph.people.length} {graph.people.length === 1 ? "person" : "people"}
            </div>
            {selected && (
              <div className="mt-2 hidden border-t border-stone-100 pt-2 text-[11px] leading-relaxed text-stone-400 md:block">
                <div className="mb-1 text-stone-500">
                  Add to <span className="font-medium text-stone-700">{selected.firstName}</span>
                </div>
                <Key k="p" /> parent · <Key k="s" /> spouse
                <br />
                <Key k="c" /> child · <Key k="b" /> sibling
              </div>
            )}
          </div>

          <div className="flex-1" />

          <div className="pointer-events-auto flex gap-1.5 md:gap-2">
            <ToolButton label="Search" onClick={() => setPalette("search")}>
              <Icon>
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.6-3.6" />
              </Icon>
            </ToolButton>
            <ToolButton
              label="How am I related?"
              onClick={() => setPalette("relate")}
              disabled={!anchor}
              title={anchor ? "How am I related?" : "Mark yourself in the tree first"}
            >
              <Icon>
                <circle cx="12" cy="4.5" r="2.5" />
                <circle cx="5" cy="19.5" r="2.5" />
                <circle cx="19" cy="19.5" r="2.5" />
                <path d="M12 7v4m0 0-7 6m7-6 7 6" />
              </Icon>
            </ToolButton>
            {/* Mobile has no zoom controls, so this is the way back when you get lost. */}
            <ToolButton
              label="Recenter"
              onClick={() => fitView({ padding: framing.fit, maxZoom: 1, duration: 400 })}
            >
              <Icon>
                <path d="M4 9V6a2 2 0 0 1 2-2h3M15 4h3a2 2 0 0 1 2 2v3M20 15v3a2 2 0 0 1-2 2h-3M9 20H6a2 2 0 0 1-2-2v-3" />
              </Icon>
            </ToolButton>
            {showSignOut && (
              <form action={signOut}>
                <ToolButton label="Sign out" type="submit">
                  <Icon>
                    <path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3" />
                    <path d="m16 16 4-4-4-4M20 12H9" />
                  </Icon>
                </ToolButton>
              </form>
            )}
          </div>
        </div>

        {/* Hidden on mobile: the detail sheet already names the relationship and
            shows the same chain, and this would sit on top of it. */}
        {relationship && anchor && relateTargetId && (
          <div className="absolute bottom-6 left-1/2 hidden w-[560px] -translate-x-1/2 rounded-xl border border-sky-200 bg-white/95 p-4 shadow-lg backdrop-blur md:block">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-[13px] text-stone-500">
                  {displayName(index.get(relateTargetId)!)} is{" "}
                  {relationship.term ? (
                    <span className="font-semibold text-sky-700">your {relationship.term}</span>
                  ) : relationship.connected ? (
                    <span className="font-semibold text-sky-700">related to you by marriage</span>
                  ) : (
                    <span className="font-semibold text-stone-600">not connected to you yet</span>
                  )}
                </div>
                {relationship.path.length > 0 && (
                  <div className="mt-1.5 text-[12px] leading-relaxed text-stone-600">
                    {renderChain(anchor, relationship.path).join("  →  ")}
                  </div>
                )}
              </div>
              <button
                onClick={() => setRelateTargetId(null)}
                className="shrink-0 text-stone-300 hover:text-stone-600"
              >
                ✕
              </button>
            </div>
          </div>
        )}

      </div>

      {selected && (
        /* Keyed on the person so the sheet re-collapses and every field's local
           draft resets when you select someone else. */
        <DetailPanel
          key={selected.id}
          person={selected}
          index={index}
          anchor={anchor}
          onChanged={refresh}
          onAdd={setQuickAdd}
          onSelect={setSelectedId}
          onClose={() => setSelectedId(null)}
          onViewPhoto={() => setViewerId(selected.id)}
        />
      )}

      {viewerId && index.get(viewerId) && (
        <PhotoViewer
          person={index.get(viewerId)!}
          onClose={() => setViewerId(null)}
          onChanged={refresh}
        />
      )}

      {quickAdd && selected && (
        <QuickAdd
          anchor={selected}
          relation={quickAdd}
          onClose={() => setQuickAdd(null)}
          onSaved={refresh}
        />
      )}

      {palette && (
        <SearchPalette
          people={graph.people}
          title={palette === "relate" ? "How are you related to…" : "Jump to someone"}
          onClose={() => setPalette(null)}
          onPick={(id) => {
            setSelectedId(id);
            if (palette === "relate") setRelateTargetId(id);
            setPalette(null);
            focusOn(id);
          }}
        />
      )}
    </div>
  );
}

export function FamilyApp({
  initialGraph,
  showSignOut,
}: {
  initialGraph: FamilyGraph;
  showSignOut: boolean;
}) {
  return (
    <ReactFlowProvider>
      <Inner initialGraph={initialGraph} showSignOut={showSignOut} />
    </ReactFlowProvider>
  );
}
