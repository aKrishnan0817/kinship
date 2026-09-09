import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

type G = "male" | "female" | "other";

async function main() {
  const wipe = process.argv.includes("--wipe");
  await db.unionPartner.deleteMany();
  await db.person.deleteMany();
  await db.union.deleteMany();
  if (wipe) {
    console.log("Database cleared.");
    return;
  }

  const mk = async (firstName: string, lastName: string, gender: G, extra = {}) =>
    db.person.create({ data: { firstName, lastName, gender, ...extra } });

  const marry = async (a: string, b: string) =>
    db.union.create({
      data: { status: "married", partners: { create: [{ personId: a }, { personId: b }] } },
    });

  const bear = async (unionId: string, people: { id: string }[]) => {
    for (const p of people) {
      await db.person.update({ where: { id: p.id }, data: { childOfUnionId: unionId } });
    }
  };

  const ggpa = await mk("Raman", "Krishnan", "male", { birthDate: "1918", deathDate: "1991", deceased: true });
  const ggma = await mk("Lakshmi", "Krishnan", "female", { birthDate: "1922", deathDate: "2004", deceased: true });

  const grandpa = await mk("Venkat", "Krishnan", "male", { birthDate: "1945", deathDate: "2016", deceased: true });
  const grandma = await mk("Saroja", "Krishnan", "female", { birthDate: "1949", location: "Chennai, India" });

  const dad = await mk("Mohan", "Krishnan", "male", { birthDate: "1968", location: "New Jersey, USA" });
  const mom = await mk("Priya", "Krishnan", "female", { birthDate: "1971", maidenName: "Iyer" });
  const uncle = await mk("Suresh", "Krishnan", "male", { birthDate: "1972", location: "Bangalore, India" });
  const auntie = await mk("Meera", "Krishnan", "female", { birthDate: "1975", maidenName: "Rao" });
  const aunt2 = await mk("Latha", "Subramanian", "female", { birthDate: "1966" });
  const uncle2 = await mk("Ravi", "Subramanian", "male", { birthDate: "1963" });

  const me = await mk("Atul", "Krishnan", "male", { birthDate: "1996", isSelf: true, location: "New York, USA" });
  const sister = await mk("Anjali", "Krishnan", "female", { birthDate: "1999" });
  const cousin1 = await mk("Divya", "Krishnan", "female", { birthDate: "2001" });
  const cousin2 = await mk("Arjun", "Krishnan", "male", { birthDate: "2004" });
  const cousin3 = await mk("Nikhil", "Subramanian", "male", { birthDate: "1994" });

  const wife = await mk("Sara", "Chen", "female", { birthDate: "1997" });
  const wifesDad = await mk("Wei", "Chen", "male", { birthDate: "1965" });
  const wifesMom = await mk("Hong", "Chen", "female", { birthDate: "1967" });

  const cousinsHusband = await mk("Karthik", "Nair", "male", { birthDate: "1999" });
  const cousinsKid = await mk("Ishaan", "Nair", "male", { birthDate: "2024" });

  const u0 = await marry(ggpa.id, ggma.id);
  await bear(u0.id, [grandpa]);

  const u1 = await marry(grandpa.id, grandma.id);
  await bear(u1.id, [dad, uncle, aunt2]);

  const u2 = await marry(dad.id, mom.id);
  await bear(u2.id, [me, sister]);

  const u3 = await marry(uncle.id, auntie.id);
  await bear(u3.id, [cousin1, cousin2]);

  const u4 = await marry(aunt2.id, uncle2.id);
  await bear(u4.id, [cousin3]);

  await marry(me.id, wife.id);
  const u6 = await marry(wifesDad.id, wifesMom.id);
  await bear(u6.id, [wife]);

  const u7 = await marry(cousin1.id, cousinsHusband.id);
  await bear(u7.id, [cousinsKid]);

  const count = await db.person.count();
  console.log(`Seeded ${count} people across 4 generations.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
