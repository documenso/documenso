-- AlterTable
ALTER TABLE "Template" ADD COLUMN     "authOptions" JSONB;

-- CreateTable
CREATE TABLE "TemplateMeta" (
    "id" TEXT NOT NULL,
    "subject" TEXT,
    "message" TEXT,
    "timezone" TEXT DEFAULT 'Etc/UTC',
    "password" TEXT,
    "dateFormat" TEXT DEFAULT 'yyyy-MM-dd hh:mm a',
    "templateId" INTEGER NOT NULL,
    "redirectUrl" TEXT,

    CONSTRAINT "TemplateMeta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TemplateMeta_templateId_key" ON "TemplateMeta"("templateId");

-- AddForeignKey
ALTER TABLE "TemplateMeta" ADD CONSTRAINT "TemplateMeta_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;
