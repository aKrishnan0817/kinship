import ELK, { ElkNode } from "elkjs/lib/elk.bundled.js";
import { FamilyGraph } from "./types";

export const PERSON_W = 196;
export const PERSON_H = 78;
export const UNION_SIZE = 14;

export type Positioned = { x: number; y: number };

const elk = new ELK();

const OPTIONS = {
  "elk.algorithm": "layered",
  "elk.direction": "DOWN",
  "elk.layered.spacing.nodeNodeBetweenLayers": "56",
  "elk.spacing.nodeNode": "36",
  "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
  "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
  "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
  "elk.edgeRouting": "ORTHOGONAL",
};

/**
 * Lays the graph out with unions as first-class nodes. Because partner edges point
 * down into the union and child edges point down out of it, spouses land side by
 * side one layer above their children, which is the shape people expect.
 */
export async function layoutGraph(graph: FamilyGraph): Promise<Map<string, Positioned>> {
  const children: ElkNode[] = [
    ...graph.people.map((p) => ({ id: p.id, width: PERSON_W, height: PERSON_H })),
    ...graph.unions.map((u) => ({ id: u.id, width: UNION_SIZE, height: UNION_SIZE })),
  ];

  const edges = [
    ...graph.unions.flatMap((u) =>
      u.partnerIds.map((pid) => ({ id: `p-${u.id}-${pid}`, sources: [pid], targets: [u.id] })),
    ),
    ...graph.unions.flatMap((u) =>
      u.childIds.map((cid) => ({ id: `c-${u.id}-${cid}`, sources: [u.id], targets: [cid] })),
    ),
  ];

  const result = await elk.layout({
    id: "root",
    layoutOptions: OPTIONS,
    children,
    edges,
  });

  const positions = new Map<string, Positioned>();
  for (const node of result.children ?? []) {
    positions.set(node.id, { x: node.x ?? 0, y: node.y ?? 0 });
  }
  return positions;
}
