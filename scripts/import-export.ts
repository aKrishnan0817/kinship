/**
 * One-off move from the local SQLite database into Postgres.
 *
 *   1. npm run export:local      (while still on SQLite)
 *   2. point DATABASE_URL at Postgres and run the migration
 *   3. npm run import:remote
 *
 * Locally-uploaded photos are pushed to Vercel Blob and their URLs rewritten,
 * because /uploads/* does not exist on a serverless host.
 */
import { readFile } from "fs/promises";
import path from "path";
import { put } from "@vercel/blob";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

type Export = {
  people: Record<string, unknown>[];
  unions: (Record<string, unknown> & { partners: { unionId: string; personId: string }[] })[];
};

async function migratePhoto(url: string): Promise<string> {
  if (!url.startsWith("/uploads/")) return url;
  const file = path.join(process.cwd(), "public", url.replace(/^\//, ""));
  const body = await readFile(file);
  const ext = path.extname(url).slice(1).toLowerCase();
  const blob = await put(`people/${path.basename(url)}`, body, {
    access: "public",
    contentType: ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg",
    addRandomSuffix: false,
  });
  console.log(`  photo ${url} -> ${blob.url}`);
  return blob.url;
}

async function main() {
  const raw = await readFile("migration-data/export.json", "utf8");
  const data: Export = JSON.parse(raw);

  const existing = await db.person.count();
  if (existing > 0 && !process.argv.includes("--force")) {
    throw new Error(
      `Target database already has ${existing} people. Re-run with --force only if you mean to add to them.`,
    );
  }

  // Unions first (people reference them), then people, then the partner links.
  for (const u of data.unions) {
    await db.union.create({
      data: {
        id: u.id as string,
        status: u.status as string,
        startDate: (u.startDate as string) ?? null,
        endDate: (u.endDate as string) ?? null,
        note: (u.note as string) ?? null,
        createdAt: new Date(u.createdAt as string),
      },
    });
  }

  for (const p of data.people) {
    const photoUrl = p.photoUrl ? await migratePhoto(p.photoUrl as string) : null;
    await db.person.create({
      data: {
        ...(p as object),
        photoUrl,
        createdAt: new Date(p.createdAt as string),
        updatedAt: new Date(p.updatedAt as string),
      } as never,
    });
  }

  for (const u of data.unions) {
    for (const link of u.partners) {
      await db.unionPartner.create({ data: { unionId: link.unionId, personId: link.personId } });
    }
  }

  const [people, unions] = await Promise.all([db.person.count(), db.union.count()]);
  console.log(`Imported ${people} people and ${unions} unions.`);
}

main()
  .catch((e) => {
    console.error(e.message ?? e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
