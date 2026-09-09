-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Union" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'married',
    "startDate" TEXT,
    "endDate" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Union_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnionPartner" (
    "unionId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,

    CONSTRAINT "UnionPartner_pkey" PRIMARY KEY ("unionId","personId")
);

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "maidenName" TEXT,
    "nickname" TEXT,
    "gender" TEXT,
    "birthDate" TEXT,
    "deathDate" TEXT,
    "deceased" BOOLEAN NOT NULL DEFAULT false,
    "photoUrl" TEXT,
    "photoX" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "photoY" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "photoScale" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "bio" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "location" TEXT,
    "socials" TEXT,
    "isSelf" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "childOfUnionId" TEXT,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UnionPartner_personId_idx" ON "UnionPartner"("personId");

-- CreateIndex
CREATE INDEX "Person_childOfUnionId_idx" ON "Person"("childOfUnionId");

-- AddForeignKey
ALTER TABLE "UnionPartner" ADD CONSTRAINT "UnionPartner_unionId_fkey" FOREIGN KEY ("unionId") REFERENCES "Union"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnionPartner" ADD CONSTRAINT "UnionPartner_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_childOfUnionId_fkey" FOREIGN KEY ("childOfUnionId") REFERENCES "Union"("id") ON DELETE SET NULL ON UPDATE CASCADE;

