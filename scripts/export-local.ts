import { mkdirSync, writeFileSync } from "fs";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const [people, unions] = await Promise.all([
    db.person.findMany({ orderBy: { createdAt: "asc" } }),
    db.union.findMany({ include: { partners: true }, orderBy: { createdAt: "asc" } }),
  ]);
  mkdirSync("migration-data", { recursive: true });
  writeFileSync("migration-data/export.json", JSON.stringify({ people, unions }, null, 2));
  console.log(`Exported ${people.length} people and ${unions.length} unions.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
