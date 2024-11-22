-- AlterTable
ALTER TABLE "DocumentMeta" ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'en';

-- AlterTable
ALTER TABLE "TemplateMeta" ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'en';
