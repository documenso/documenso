-- CreateTable
CREATE TABLE "TemplateDocumentMeta" (
    "id" TEXT NOT NULL,
    "subject" TEXT,
    "message" TEXT,
    "timezone" TEXT DEFAULT 'Etc/UTC',
    "password" TEXT,
    "dateFormat" TEXT DEFAULT 'yyyy-MM-dd hh:mm a',
    "templateId" INTEGER NOT NULL,
    "redirectUrl" TEXT,

    CONSTRAINT "TemplateDocumentMeta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TemplateDocumentMeta_templateId_key" ON "TemplateDocumentMeta"("templateId");

-- AddForeignKey
ALTER TABLE "TemplateDocumentMeta" ADD CONSTRAINT "TemplateDocumentMeta_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;
