export type Gender = "male" | "female" | "other" | null;

export type Social = { label: string; url: string };

export type Person = {
  id: string;
  firstName: string;
  lastName: string | null;
  maidenName: string | null;
  nickname: string | null;
  gender: Gender;
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
  socials: Social[];
  isSelf: boolean;
  childOfUnionId: string | null;
};

export type Union = {
  id: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  note: string | null;
  partnerIds: string[];
  childIds: string[];
};

export type FamilyGraph = {
  people: Person[];
  unions: Union[];
};

export function displayName(p: Person): string {
  return [p.firstName, p.lastName].filter(Boolean).join(" ").trim() || "Unnamed";
}

/**
 * Sortable birth date from the free-text field, handling "2005", "2005-03",
 * "2005-03-12" and "b. March 2005". People with no date sort last, and a stable
 * sort then leaves them in the order they were entered.
 */
export function birthKey(birthDate: string | null): number {
  const raw = birthDate?.trim();
  if (!raw) return Number.MAX_SAFE_INTEGER;
  const iso = raw.match(/(\d{4})-(\d{1,2})(?:-(\d{1,2}))?/);
  if (iso) return Number(iso[1]) * 10000 + Number(iso[2]) * 100 + Number(iso[3] ?? 0);
  const year = raw.match(/\d{4}/);
  return year ? Number(year[0]) * 10000 : Number.MAX_SAFE_INTEGER;
}

export function lifespan(p: Person): string | null {
  const birth = p.birthDate?.slice(0, 4);
  const death = p.deathDate?.slice(0, 4);
  if (!birth && !death) return p.deceased ? "deceased" : null;
  if (birth && death) return `${birth}–${death}`;
  if (birth) return p.deceased ? `b. ${birth}` : `b. ${birth}`;
  return `d. ${death}`;
}
