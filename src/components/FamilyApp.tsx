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

const SHORTCUTS: Record<string, Relation> = { p: "parent", s: "spouse", c: "child", b: "sibling" };

function Key({ k }: { k: string }) {
  return <kbd className="rounded border border-stone-200 bg-white px-1 text-stone-600">{k}</kbd>;
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
      padding: 0.3,
      maxZoom: 1,
    });
  }, [relateTargetId, litIds, positions, fitView]);

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
    <div className="flex h-screen w-screen overflow-hidden bg-[#faf9f7]">
      <div className="relative min-w-0 flex-1">
        {/* Mounted only once elk has real coordinates, otherwise fitView frames nodes still at the origin. */}
        {positions.size > 0 ? (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
            minZoom={0.05}
            maxZoom={2}
            proOptions={{ hideAttribution: true }}
            onNodeClick={(_, node) => node.type === "person" && setSelectedId(node.id)}
            onPaneClick={() => setRelateTargetId(null)}
          >
            <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#e7e5e4" />
            <Controls showInteractive={false} position="bottom-right" className="!shadow-sm" />
          </ReactFlow>
        ) : (
          <div className="flex h-full items-center justify-center text-[13px] text-stone-400">
            Arranging the family…
          </div>
        )}

        <div className="absolute left-4 top-4 rounded-xl border border-stone-200 bg-white/90 px-3.5 py-2.5 shadow-sm backdrop-blur">
          <div className="text-[13px] font-semibold text-stone-900">Family</div>
          <div className="text-[11px] text-stone-500">
            {graph.people.length} {graph.people.length === 1 ? "person" : "people"}
          </div>
          {selected && (
            <div className="mt-2 border-t border-stone-100 pt-2 text-[11px] leading-relaxed text-stone-400">
              <div className="mb-1 text-stone-500">
                Add to <span className="font-medium text-stone-700">{selected.firstName}</span>
              </div>
              <Key k="p" /> parent · <Key k="s" /> spouse
              <br />
              <Key k="c" /> child · <Key k="b" /> sibling
            </div>
          )}
        </div>

        <div className="absolute right-4 top-4 flex gap-2">
          <button
            onClick={() => setPalette("search")}
            className="rounded-lg border border-stone-200 bg-white/90 px-3 py-1.5 text-[12px] text-stone-600 shadow-sm backdrop-blur hover:border-stone-300"
          >
            Search <kbd className="ml-1 text-stone-400">/</kbd>
          </button>
          <button
            onClick={() => setPalette("relate")}
            disabled={!anchor}
            className="rounded-lg border border-stone-200 bg-white/90 px-3 py-1.5 text-[12px] text-stone-600 shadow-sm backdrop-blur hover:border-stone-300 disabled:opacity-40"
            title={anchor ? undefined : "Mark yourself in the tree first"}
          >
            How am I related? <kbd className="ml-1 text-stone-400">r</kbd>
          </button>
          {showSignOut && (
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-lg border border-stone-200 bg-white/90 px-3 py-1.5 text-[12px] text-stone-500 shadow-sm backdrop-blur hover:border-stone-300 hover:text-stone-700"
              >
                Sign out
              </button>
            </form>
          )}
        </div>

        {relationship && anchor && relateTargetId && (
          <div className="absolute bottom-6 left-1/2 w-[560px] -translate-x-1/2 rounded-xl border border-sky-200 bg-white/95 p-4 shadow-lg backdrop-blur">
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
        <DetailPanel
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
