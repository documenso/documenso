-- AlterTable
ALTER TABLE "Document" ADD COLUMN "createdAt" TIMESTAMP(3);
ALTER TABLE "Document" ADD COLUMN "updatedAt" TIMESTAMP(3);

-- DefaultValues
UPDATE "Document"
SET
  "createdAt" = COALESCE("created"::TIMESTAMP, NOW()),
  "updatedAt" = COALESCE("created"::TIMESTAMP, NOW());

-- AlterColumn
ALTER TABLE "Document" ALTER COLUMN "createdAt" SET NOT NULL DEFAULT NOW();
ALTER TABLE "Document" ALTER COLUMN "updatedAt" SET NOT NULL DEFAULT NOW();
