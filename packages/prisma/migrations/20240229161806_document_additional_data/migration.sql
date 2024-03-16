-- CreateEnum
CREATE TYPE "AdditionalDataType" AS ENUM ('LOGS', 'CERTIFICATE');

-- CreateTable
CREATE TABLE "DocumentAdditionalData" (
    "id" TEXT NOT NULL,
    "type" "DocumentDataType" NOT NULL,
    "data" TEXT NOT NULL,
    "documentId" INTEGER NOT NULL,
    "contentType" "AdditionalDataType" NOT NULL,

    CONSTRAINT "DocumentAdditionalData_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DocumentAdditionalData_documentId_contentType_key" ON "DocumentAdditionalData"("documentId", "contentType");

-- AddForeignKey
ALTER TABLE "DocumentAdditionalData" ADD CONSTRAINT "DocumentAdditionalData_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
