import { GraphIndex, describeRelationship, renderChain } from "../src/lib/kinship";
import { FamilyGraph, Gender, Person, Union } from "../src/lib/types";

let seq = 0;
const people: Person[] = [];
const unions: Union[] = [];

function person(firstName: string, gender: Gender): Person {
  const p: Person = {
    id: `p${++seq}`,
    firstName,
    lastName: null,
    maidenName: null,
    nickname: null,
    gender,
    birthDate: null,
    deathDate: null,
    deceased: false,
    photoUrl: null,
    photoX: 50,
    photoY: 50,
    photoScale: 1,
    bio: null,
    email: null,
    phone: null,
    location: null,
    socials: [],
    isSelf: false,
    childOfUnionId: null,
  };
  people.push(p);
  return p;
}

function union(a: Person, b: Person, children: Person[]): Union {
  const u: Union = {
    id: `u${++seq}`,
    status: "married",
    startDate: null,
    endDate: null,
    note: null,
    partnerIds: [a.id, b.id],
    childIds: children.map((c) => c.id),
  };
  for (const c of children) c.childOfUnionId = u.id;
  unions.push(u);
  return u;
}

// Three generations plus an in-law branch and a half-sibling.
const grandpa = person("Grandpa", "male");
const grandma = person("Grandma", "female");
const dad = person("Dad", "male");
const uncle = person("Uncle", "male");
const aunt = person("Aunt", "female");
const mom = person("Mom", "female");
const me = person("Me", "male");
const sister = person("Sister", "female");
const cousin = person("Cousin", "female");
const cousinsKid = person("CousinsKid", "male");
const myKid = person("MyKid", "male");
const stepmom = person("Stepmom", "female");
const halfBro = person("HalfBro", "male");
const wife = person("Wife", "female");
const wifesMother = person("WifesMother", "female");
const greatGrandpa = person("GreatGrandpa", "male");
const greatGrandma = person("GreatGrandma", "female");
const auntsBrother = person("AuntsBrother", "male");

union(greatGrandpa, greatGrandma, [grandpa]);
union(grandpa, grandma, [dad, uncle]);
union(dad, mom, [me, sister]);
union(dad, stepmom, [halfBro]);
union(uncle, aunt, [cousin]);
union(cousin, person("CousinsHusband", "male"), [cousinsKid]);
union(me, wife, [myKid]);
union(person("WifesFather", "male"), wifesMother, [wife]);
union(person("AuntsDad", "male"), person("AuntsMom", "female"), [aunt, auntsBrother]);

const graph: FamilyGraph = { people, unions };
const idx = new GraphIndex(graph);

const cases: Array<[string, Person, string]> = [
  ["dad", dad, "father"],
  ["mom", mom, "mother"],
  ["sister", sister, "sister"],
  ["half brother", halfBro, "half-brother"],
  ["grandpa", grandpa, "grandfather"],
  ["great grandpa", greatGrandpa, "great-grandfather"],
  ["uncle", uncle, "uncle"],
  ["aunt (by marriage)", aunt, "aunt"],
  ["cousin", cousin, "first cousin"],
  ["cousin's kid", cousinsKid, "first cousin once removed"],
  ["my kid", myKid, "son"],
  ["wife", wife, "wife"],
  ["mother-in-law", wifesMother, "mother-in-law"],
  ["aunt's brother", auntsBrother, null as unknown as string],
];

let failures = 0;
for (const [label, target, expected] of cases) {
  const rel = describeRelationship(idx, me.id, target.id);
  const ok = rel.term === expected;
  if (!ok) failures += 1;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${label.padEnd(20)} got=${String(rel.term).padEnd(28)} want=${String(expected)}`,
  );
  if (!ok || process.env.VERBOSE) {
    console.log(`        chain: ${renderChain(me, rel.path).join(" -> ") || "(none)"}`);
  }
}

console.log(`\n${cases.length - failures}/${cases.length} passed`);
process.exit(failures ? 1 : 0);
