-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "documentMetaId" TEXT;

-- CreateTable
CREATE TABLE "DocumentMeta" (
    "id" TEXT NOT NULL,
    "customEmailSubject" TEXT,
    "customEmailBody" TEXT,

    CONSTRAINT "DocumentMeta_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_documentMetaId_fkey" FOREIGN KEY ("documentMetaId") REFERENCES "DocumentMeta"("id") ON DELETE CASCADE ON UPDATE CASCADE;
