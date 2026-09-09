import { FamilyGraph, Gender, Person, Union, displayName } from "./types";

export type RelationKind = "parent" | "child" | "sibling" | "spouse";

export type PathStep = {
  person: Person;
  /** How this person relates to the previous person in the chain. */
  kind: RelationKind;
};

export type Relationship = {
  /** Formal kinship term, e.g. "first cousin once removed". Null when unnameable. */
  term: string | null;
  /** Hop-by-hop chain, always present when the two are connected at all. */
  path: PathStep[];
  connected: boolean;
};

export class GraphIndex {
  people = new Map<string, Person>();
  unions = new Map<string, Union>();
  /** Unions in which this person is a partner. */
  private unionsByPartner = new Map<string, string[]>();

  constructor(graph: FamilyGraph) {
    for (const p of graph.people) this.people.set(p.id, p);
    for (const u of graph.unions) {
      this.unions.set(u.id, u);
      for (const pid of u.partnerIds) {
        const list = this.unionsByPartner.get(pid);
        if (list) list.push(u.id);
        else this.unionsByPartner.set(pid, [u.id]);
      }
    }
  }

  get(id: string): Person | undefined {
    return this.people.get(id);
  }

  unionsOf(id: string): Union[] {
    return (this.unionsByPartner.get(id) ?? []).map((uid) => this.unions.get(uid)!).filter(Boolean);
  }

  parentIds(id: string): string[] {
    const person = this.people.get(id);
    if (!person?.childOfUnionId) return [];
    return this.unions.get(person.childOfUnionId)?.partnerIds ?? [];
  }

  childIds(id: string): string[] {
    return this.unionsOf(id).flatMap((u) => u.childIds);
  }

  spouseIds(id: string): string[] {
    return this.unionsOf(id).flatMap((u) => u.partnerIds.filter((pid) => pid !== id));
  }

  siblingIds(id: string): string[] {
    const seen = new Set<string>();
    for (const parentId of this.parentIds(id)) {
      for (const sib of this.childIds(parentId)) if (sib !== id) seen.add(sib);
    }
    return [...seen];
  }

  /** True when both people descend from the same union, i.e. share both parents. */
  areFullSiblings(a: string, b: string): boolean {
    const ua = this.people.get(a)?.childOfUnionId;
    const ub = this.people.get(b)?.childOfUnionId;
    return Boolean(ua && ua === ub);
  }

  /** Every ancestor of `id` (including `id` at distance 0) mapped to generation distance. */
  ancestorDistances(id: string): Map<string, number> {
    const dist = new Map<string, number>([[id, 0]]);
    let frontier = [id];
    let depth = 0;
    while (frontier.length) {
      depth += 1;
      const next: string[] = [];
      for (const cur of frontier) {
        for (const parent of this.parentIds(cur)) {
          if (dist.has(parent)) continue;
          dist.set(parent, depth);
          next.push(parent);
        }
      }
      frontier = next;
    }
    return dist;
  }

  /**
   * Shortest chain of relatives from `fromId` to `toId`. Neighbours are expanded
   * parent → sibling → child → spouse so that among equally short paths we surface
   * the one that reads most naturally ("your father's brother", not "your father's
   * father's son").
   */
  shortestPath(fromId: string, toId: string): PathStep[] | null {
    if (fromId === toId) return [];
    const prev = new Map<string, { id: string; kind: RelationKind }>();
    const visited = new Set<string>([fromId]);
    let frontier = [fromId];

    while (frontier.length) {
      const next: string[] = [];
      for (const cur of frontier) {
        const neighbours: Array<[string, RelationKind]> = [
          ...this.parentIds(cur).map((n) => [n, "parent"] as [string, RelationKind]),
          ...this.siblingIds(cur).map((n) => [n, "sibling"] as [string, RelationKind]),
          ...this.childIds(cur).map((n) => [n, "child"] as [string, RelationKind]),
          ...this.spouseIds(cur).map((n) => [n, "spouse"] as [string, RelationKind]),
        ];
        for (const [nid, kind] of neighbours) {
          if (visited.has(nid)) continue;
          visited.add(nid);
          prev.set(nid, { id: cur, kind });
          if (nid === toId) return this.reconstruct(prev, fromId, toId);
          next.push(nid);
        }
      }
      frontier = next;
    }
    return null;
  }

  private reconstruct(
    prev: Map<string, { id: string; kind: RelationKind }>,
    fromId: string,
    toId: string,
  ): PathStep[] {
    const steps: PathStep[] = [];
    let cur = toId;
    while (cur !== fromId) {
      const back = prev.get(cur)!;
      steps.push({ person: this.people.get(cur)!, kind: back.kind });
      cur = back.id;
    }
    return steps.reverse();
  }
}

function byGender(g: Gender, male: string, female: string, neutral: string): string {
  if (g === "male") return male;
  if (g === "female") return female;
  return neutral;
}

function possessive(g: Gender): string {
  return byGender(g, "his", "her", "their");
}

const ORDINALS = [
  "first",
  "second",
  "third",
  "fourth",
  "fifth",
  "sixth",
  "seventh",
  "eighth",
  "ninth",
  "tenth",
];

function ordinal(n: number): string {
  return ORDINALS[n - 1] ?? `${n}th`;
}

function removalSuffix(n: number): string {
  if (n === 0) return "";
  if (n === 1) return " once removed";
  if (n === 2) return " twice removed";
  return ` ${n} times removed`;
}

/** "great-great-" prefix for a relation that is `extra` generations further out. */
function greats(extra: number): string {
  return extra > 0 ? "great-".repeat(extra) : "";
}

function ancestorTerm(distance: number, g: Gender): string {
  if (distance === 1) return byGender(g, "father", "mother", "parent");
  return greats(distance - 2) + byGender(g, "grandfather", "grandmother", "grandparent");
}

function descendantTerm(distance: number, g: Gender): string {
  if (distance === 1) return byGender(g, "son", "daughter", "child");
  return greats(distance - 2) + byGender(g, "grandson", "granddaughter", "grandchild");
}

function stepTerm(kind: RelationKind, g: Gender): string {
  switch (kind) {
    case "parent":
      return byGender(g, "father", "mother", "parent");
    case "child":
      return byGender(g, "son", "daughter", "child");
    case "sibling":
      return byGender(g, "brother", "sister", "sibling");
    case "spouse":
      return byGender(g, "husband", "wife", "spouse");
  }
}

/**
 * Consanguineous relationship only. Returns null when the two share no common
 * ancestor, which is the signal to fall back to marriage-based naming.
 */
function bloodTerm(idx: GraphIndex, aId: string, bId: string): string | null {
  const a = idx.get(aId);
  const b = idx.get(bId);
  if (!a || !b) return null;
  if (aId === bId) return "yourself";

  const ancA = idx.ancestorDistances(aId);
  const ancB = idx.ancestorDistances(bId);

  let best: { da: number; db: number } | null = null;
  for (const [ancestorId, da] of ancA) {
    const db = ancB.get(ancestorId);
    if (db === undefined) continue;
    if (
      !best ||
      da + db < best.da + best.db ||
      (da + db === best.da + best.db && Math.max(da, db) < Math.max(best.da, best.db))
    ) {
      best = { da, db };
    }
  }
  if (!best) return null;

  const { da, db } = best;

  // B is an ancestor of A.
  if (da === 0) return descendantTerm(db, b.gender);
  if (db === 0) return ancestorTerm(da, b.gender);

  if (da === 1 && db === 1) {
    const half = idx.areFullSiblings(aId, bId) ? "" : "half-";
    return half + byGender(b.gender, "brother", "sister", "sibling");
  }

  // One of them is a direct child of the common ancestor: avuncular, not cousins.
  if (db === 1) return greats(da - 2) + byGender(b.gender, "uncle", "aunt", "uncle/aunt");
  if (da === 1) {
    const prefix = db === 2 ? "" : greats(db - 3) + "grand-";
    return prefix + byGender(b.gender, "nephew", "niece", "nibling");
  }

  return `${ordinal(Math.min(da, db) - 1)} cousin${removalSuffix(Math.abs(da - db))}`;
}

/** Names the common in-law cases; anything more exotic falls back to the chain. */
function inLawTerm(idx: GraphIndex, aId: string, bId: string): string | null {
  const b = idx.get(bId);
  if (!b) return null;

  if (idx.spouseIds(aId).includes(bId)) {
    return byGender(b.gender, "husband", "wife", "spouse");
  }

  // B married into A's blood family.
  for (const spouseId of idx.spouseIds(bId)) {
    const rel = bloodTerm(idx, aId, spouseId);
    if (!rel) continue;
    if (rel.endsWith("brother") || rel.endsWith("sister") || rel.endsWith("sibling")) {
      return byGender(b.gender, "brother-in-law", "sister-in-law", "sibling-in-law");
    }
    if (rel === "son" || rel === "daughter" || rel === "child") {
      return byGender(b.gender, "son-in-law", "daughter-in-law", "child-in-law");
    }
    // An uncle's wife is simply an aunt, and the "great-" depth carries over.
    const avuncular = rel.match(/^((?:great-)*)(?:uncle|aunt|uncle\/aunt)$/);
    if (avuncular) {
      return avuncular[1] + byGender(b.gender, "uncle", "aunt", "uncle/aunt");
    }
    return `${rel}'s ${byGender(b.gender, "husband", "wife", "spouse")}`;
  }

  // B is blood family of A's spouse.
  for (const mySpouseId of idx.spouseIds(aId)) {
    const rel = bloodTerm(idx, mySpouseId, bId);
    if (!rel) continue;
    if (rel === "father" || rel === "mother" || rel === "parent") {
      return byGender(b.gender, "father-in-law", "mother-in-law", "parent-in-law");
    }
    if (rel.endsWith("brother") || rel.endsWith("sister") || rel.endsWith("sibling")) {
      return byGender(b.gender, "brother-in-law", "sister-in-law", "sibling-in-law");
    }
    const mySpouse = idx.get(mySpouseId)!;
    return `${byGender(mySpouse.gender, "husband", "wife", "spouse")}'s ${rel}`;
  }

  return null;
}

export function describeRelationship(idx: GraphIndex, aId: string, bId: string): Relationship {
  if (aId === bId) return { term: "yourself", path: [], connected: true };
  const path = idx.shortestPath(aId, bId);
  const term = bloodTerm(idx, aId, bId) ?? inLawTerm(idx, aId, bId);
  return { term, path: path ?? [], connected: path !== null };
}

/** Renders the hop chain as "your father → his elder brother → his daughter". */
export function renderChain(anchor: Person, path: PathStep[]): string[] {
  const out: string[] = [];
  let prevGender: Gender = anchor.gender;
  let first = true;
  for (const step of path) {
    const term = stepTerm(step.kind, step.person.gender);
    const owner = first ? "your" : possessive(prevGender);
    out.push(`${owner} ${term} ${displayName(step.person)}`);
    prevGender = step.person.gender;
    first = false;
  }
  return out;
}
