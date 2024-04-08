-- AlterTable
ALTER TABLE "Recipient" ADD COLUMN     "documentDeletedAt" TIMESTAMP(3);

-- Hard delete all PENDING documents that have been soft deleted
DELETE FROM "Document" WHERE "deletedAt" IS NOT NULL AND "status" = 'PENDING';

-- Update all recipients who are the owner of the document and where the document has deletedAt set to not null
UPDATE "Recipient"
SET "documentDeletedAt" = "Document"."deletedAt"
FROM "Document", "User"
WHERE "Recipient"."documentId" = "Document"."id"
AND "Recipient"."email" = "User"."email"
AND "Document"."deletedAt" IS NOT NULL;
