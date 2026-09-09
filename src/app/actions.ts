"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { toPerson } from "@/lib/serialize";
import type { FamilyGraph } from "@/lib/types";
import { birthKey } from "@/lib/types";

/**
 * The proxy already gates these routes, but Next.js advises against relying on
 * it alone for authorization, so every entry point re-checks.
 */
async function assertSession(): Promise<void> {
  if (!(await requireSession())) throw new Error("Not signed in");
}

export async function loadGraph(): Promise<FamilyGraph> {
  await assertSession();
  const [people, unions] = await Promise.all([
    db.person.findMany({ orderBy: { createdAt: "asc" } }),
    db.union.findMany({
      orderBy: { createdAt: "asc" },
      include: { partners: true, children: { select: { id: true } } },
    }),
  ]);

  // Siblings read oldest-first everywhere: on the canvas, and in any list of children.
  const byBirth = new Map(people.map((p) => [p.id, birthKey(p.birthDate)]));
  const eldestFirst = (a: string, b: string) =>
    (byBirth.get(a) ?? Number.MAX_SAFE_INTEGER) - (byBirth.get(b) ?? Number.MAX_SAFE_INTEGER);

  return {
    people: people.map(toPerson),
    unions: unions.map((u) => ({
      id: u.id,
      status: u.status,
      startDate: u.startDate,
      endDate: u.endDate,
      note: u.note,
      partnerIds: u.partners.map((p) => p.personId),
      childIds: u.children.map((c) => c.id).sort(eldestFirst),
    })),
  };
}

const newPersonSchema = z.object({
  firstName: z.string().trim().min(1, "A name is required").max(80),
  lastName: z.string().trim().max(80).optional(),
  gender: z.enum(["male", "female", "other"]).nullish(),
});

const relationSchema = z.enum(["parent", "spouse", "child", "sibling"]);

/** Finds a union to hang a child off, creating a solo one if the person has none. */
async function unionForChildrenOf(personId: string, preferredUnionId?: string): Promise<string> {
  if (preferredUnionId) return preferredUnionId;
  const existing = await db.unionPartner.findFirst({
    where: { personId },
    orderBy: { union: { createdAt: "asc" } },
  });
  if (existing) return existing.unionId;
  const created = await db.union.create({
    data: { status: "unknown", partners: { create: [{ personId }] } },
  });
  return created.id;
}

/** Finds the union a person was born into, creating an empty one if absent. */
async function birthUnionOf(personId: string): Promise<string> {
  const person = await db.person.findUniqueOrThrow({ where: { id: personId } });
  if (person.childOfUnionId) return person.childOfUnionId;
  const created = await db.union.create({ data: { status: "unknown" } });
  await db.person.update({ where: { id: personId }, data: { childOfUnionId: created.id } });
  return created.id;
}

export async function addRelative(input: {
  anchorId: string;
  relation: z.infer<typeof relationSchema>;
  firstName: string;
  lastName?: string;
  gender?: "male" | "female" | "other" | null;
  unionId?: string;
}): Promise<{ ok: true; personId: string } | { ok: false; error: string }> {
  await assertSession();
  const parsed = newPersonSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const relation = relationSchema.parse(input.relation);

  const anchor = await db.person.findUnique({ where: { id: input.anchorId } });
  if (!anchor) return { ok: false, error: "That person no longer exists" };

  const base = {
    firstName: parsed.data.firstName,
    lastName: parsed.data.lastName || null,
    gender: parsed.data.gender ?? null,
  };

  let personId: string;

  if (relation === "parent") {
    const unionId = await birthUnionOf(anchor.id);
    const partnerCount = await db.unionPartner.count({ where: { unionId } });
    if (partnerCount >= 2) {
      return { ok: false, error: `${anchor.firstName} already has two parents recorded` };
    }
    const created = await db.person.create({ data: base });
    await db.unionPartner.create({ data: { unionId, personId: created.id } });
    personId = created.id;
  } else if (relation === "spouse") {
    const created = await db.person.create({ data: base });
    await db.union.create({
      data: {
        status: "married",
        partners: { create: [{ personId: anchor.id }, { personId: created.id }] },
      },
    });
    personId = created.id;
  } else if (relation === "child") {
    const unionId = await unionForChildrenOf(anchor.id, input.unionId);
    const created = await db.person.create({ data: { ...base, childOfUnionId: unionId } });
    personId = created.id;
  } else {
    const unionId = await birthUnionOf(anchor.id);
    const created = await db.person.create({ data: { ...base, childOfUnionId: unionId } });
    personId = created.id;
  }

  revalidatePath("/");
  return { ok: true, personId };
}

/** Links two people who were entered separately, e.g. joining two branches. */
export async function linkAsSpouses(
  aId: string,
  bId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await assertSession();
  if (aId === bId) return { ok: false, error: "A person cannot marry themselves" };
  const shared = await db.union.findFirst({
    where: { AND: [{ partners: { some: { personId: aId } } }, { partners: { some: { personId: bId } } }] },
  });
  if (shared) return { ok: false, error: "These two are already partners" };
  await db.union.create({
    data: { status: "married", partners: { create: [{ personId: aId }, { personId: bId }] } },
  });
  revalidatePath("/");
  return { ok: true };
}

/** Re-parents an existing person onto an existing person's family. */
export async function linkAsChild(
  parentId: string,
  childId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await assertSession();
  if (parentId === childId) return { ok: false, error: "A person cannot be their own child" };
  const unionId = await unionForChildrenOf(parentId);
  const union = await db.union.findUniqueOrThrow({ where: { id: unionId }, include: { partners: true } });
  if (union.partners.some((p) => p.personId === childId)) {
    return { ok: false, error: "That person is a partner in this family, not a child of it" };
  }
  await db.person.update({ where: { id: childId }, data: { childOfUnionId: unionId } });
  revalidatePath("/");
  return { ok: true };
}

const updateSchema = z.object({
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().max(80).nullish(),
  maidenName: z.string().trim().max(80).nullish(),
  nickname: z.string().trim().max(80).nullish(),
  gender: z.enum(["male", "female", "other"]).nullish(),
  birthDate: z.string().trim().max(40).nullish(),
  deathDate: z.string().trim().max(40).nullish(),
  deceased: z.boolean().optional(),
  photoUrl: z.string().trim().max(2000).nullish(),
  photoX: z.number().min(0).max(100).optional(),
  photoY: z.number().min(0).max(100).optional(),
  photoScale: z.number().min(1).max(4).optional(),
  bio: z.string().trim().max(5000).nullish(),
  email: z.string().trim().max(200).nullish(),
  phone: z.string().trim().max(60).nullish(),
  location: z.string().trim().max(200).nullish(),
  socials: z.array(z.object({ label: z.string().max(60), url: z.string().max(500) })).optional(),
});

export async function updatePerson(
  id: string,
  patch: z.infer<typeof updateSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await assertSession();
  const parsed = updateSchema.safeParse(patch);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { socials, ...rest } = parsed.data;
  const data: Record<string, unknown> = { ...rest };
  for (const key of Object.keys(data)) if (data[key] === "") data[key] = null;
  if (socials) data.socials = JSON.stringify(socials.filter((s) => s.url.trim()));

  await db.person.update({ where: { id }, data });
  revalidatePath("/");
  return { ok: true };
}

export async function setSelf(id: string): Promise<void> {
  await assertSession();
  await db.$transaction([
    db.person.updateMany({ where: { isSelf: true }, data: { isSelf: false } }),
    db.person.update({ where: { id }, data: { isSelf: true } }),
  ]);
  revalidatePath("/");
}

export async function deletePerson(id: string): Promise<void> {
  await assertSession();
  await db.person.delete({ where: { id } });
  // Unions left with nobody attached are noise on the canvas.
  const orphans = await db.union.findMany({
    where: { partners: { none: {} }, children: { none: {} } },
    select: { id: true },
  });
  if (orphans.length) {
    await db.union.deleteMany({ where: { id: { in: orphans.map((o) => o.id) } } });
  }
  revalidatePath("/");
}

export async function createFirstPerson(input: {
  firstName: string;
  lastName?: string;
  gender?: "male" | "female" | "other" | null;
}): Promise<{ ok: true; personId: string } | { ok: false; error: string }> {
  await assertSession();
  const parsed = newPersonSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const count = await db.person.count();
  const created = await db.person.create({
    data: {
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName || null,
      gender: parsed.data.gender ?? null,
      isSelf: count === 0,
    },
  });
  revalidatePath("/");
  return { ok: true, personId: created.id };
}
