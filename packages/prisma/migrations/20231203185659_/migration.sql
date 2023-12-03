-- CreateTable
CREATE TABLE "DocumentThumbnail" (
    "id" TEXT NOT NULL,
    "documentId" INTEGER NOT NULL,
    "thumbnail_bytes" BYTEA,
    "hq_thumbnail_bytes" BYTEA,

    CONSTRAINT "DocumentThumbnail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DocumentThumbnail_documentId_key" ON "DocumentThumbnail"("documentId");

-- AddForeignKey
ALTER TABLE "DocumentThumbnail" ADD CONSTRAINT "DocumentThumbnail_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
