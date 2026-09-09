# Family

A private tool for mapping out who's who in an extended family — and answering
"how am I actually related to this person?"

## Running it

Storage is Postgres (Neon) with photos on Vercel Blob, so local development
needs the same env vars as production. Copy `.env.example` to `.env` and fill it
in, then:

```bash
npm install
npx prisma migrate deploy   # apply the schema
npm run dev                 # http://localhost:3000
```

With no `FAMILY_PASSWORD` set the password gate is skipped in development, so
local runs stay frictionless. In production a missing password fails closed and
the site refuses to serve.

On first load you enter your own name. Everything else hangs off you.

```bash
npm run seed:demo      # 20 fictional people across 4 generations, to poke at
npm run db:reset       # wipe everything
npm run test:kinship   # check the relationship naming logic
npm run db:studio      # browse the raw data
```

## How the data is modelled

A family is a graph, not a tree — remarriages and in-laws create cycles that
parent pointers can't express. So there are two kinds of node:

- **Person**
- **Union** — a marriage or partnership

with edges `person → union` (partner) and `union → person` (child). Half-siblings,
remarriage, adoption and unmarried parents all fall out of this without special
cases, and it gives the layout engine something sane to work with. A person's
`childOfUnionId` is the union they were born into.

## Getting around

| Key | Action |
| --- | --- |
| `p` `s` `c` `b` | add parent / spouse / child / sibling to the selected person |
| `/` or `⌘K` | search |
| `r` | how am I related to…? |
| `Esc` | close whatever's open |

Quick-add stays open on Enter so you can type a whole generation in one go.

## Relationship naming

`src/lib/kinship.ts` computes the lowest common ancestor and turns the two
generation distances into a real term — "first cousin once removed",
"great-uncle", "half-brother", "mother-in-law". Where there's no blood relation
it tries the common in-law shapes, and it always shows the hop-by-hop chain
("your father → his brother → his daughter"), which is usually the part that
actually makes it click.

Run `npm run test:kinship` after touching it.

## Deploying

Four env vars, listed in `.env.example`. Set all of them in Vercel before the
first deploy.

1. **Neon** — create a project, copy the pooled URL into `DATABASE_URL` and the
   unpooled one into `DIRECT_URL`.
2. **Vercel** — import the repo. Under Storage, create a Blob store and connect
   it, which sets `BLOB_READ_WRITE_TOKEN` automatically.
3. Set `FAMILY_PASSWORD` to whatever you'll tell the family, and `AUTH_SECRET`
   to a long random string (`openssl rand -hex 32`). Changing `AUTH_SECRET`
   signs everyone out.
4. Apply the schema against the new database:
   ```bash
   DATABASE_URL=... DIRECT_URL=... npx prisma migrate deploy
   ```

To carry local data over, run `npm run export:local` while still pointed at the
old database, then `npm run import:remote` with the new one configured. Photos
under `public/uploads/` are pushed to Blob and their URLs rewritten. The import
refuses to run against a non-empty database unless you pass `--force`.

## Privacy

This holds living relatives' phone numbers, addresses and photos.

Access is one shared password for the whole family, checked in `src/proxy.ts`
and again in every server action. Every response carries `noindex` and
`robots.txt` disallows everything, so the tree should never be crawled.

Two things this does *not* give you:

- **No per-person permissions.** Anyone with the password can edit or delete
  anyone. Fine for a small trusted beta; not fine at scale.
- **Photo URLs are public.** Vercel Blob serves them from unguessable URLs with
  no auth, so anyone holding a link can open that image directly.

`migration-data/`, `public/uploads/` and any local database are gitignored.

## Not built yet

- Per-person accounts, invites, and letting relatives edit only their own card
- An audit trail or undo, so an accidental delete is recoverable
- Live sync — two people editing at once will not see each other's changes until
  they act, and the later write wins
- GEDCOM import/export
- Merging two separately-built trees (duplicate-person reconciliation)
