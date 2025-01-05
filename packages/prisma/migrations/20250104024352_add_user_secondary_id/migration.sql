-- AlterTable
ALTER TABLE "User" ADD COLUMN     "secondaryId" TEXT;

-- Set all null secondaryId fields to a uuid
UPDATE "User" SET "secondaryId" = gen_random_uuid()::text WHERE "secondaryId" IS NULL;

-- Restrict the User to required
ALTER TABLE "User" ALTER COLUMN "secondaryId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_secondaryId_key" ON "User"("secondaryId");
