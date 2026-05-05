ALTER TABLE "OrganisationGlobalSettings" ADD COLUMN "allowDocumentRejection" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "TeamGlobalSettings" ADD COLUMN "allowDocumentRejection" BOOLEAN;
ALTER TABLE "DocumentMeta" ADD COLUMN "allowDocumentRejection" BOOLEAN;
