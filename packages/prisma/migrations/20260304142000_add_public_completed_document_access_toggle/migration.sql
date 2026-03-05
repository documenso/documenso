ALTER TABLE "OrganisationGlobalSettings"
ADD COLUMN "allowPublicCompletedDocumentAccess" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "TeamGlobalSettings"
ADD COLUMN "allowPublicCompletedDocumentAccess" BOOLEAN;
