import { Gender, Person, Social } from "./types";

type PersonRow = {
  id: string;
  firstName: string;
  lastName: string | null;
  maidenName: string | null;
  nickname: string | null;
  gender: string | null;
  birthDate: string | null;
  deathDate: string | null;
  deceased: boolean;
  photoUrl: string | null;
  photoX: number;
  photoY: number;
  photoScale: number;
  bio: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  socials: string | null;
  isSelf: boolean;
  childOfUnionId: string | null;
};

function parseSocials(raw: string | null): Social[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((s) => s && typeof s.url === "string");
  } catch {
    return [];
  }
}

export function toPerson(row: PersonRow): Person {
  return {
    ...row,
    gender: (row.gender as Gender) ?? null,
    socials: parseSocials(row.socials),
  };
}
