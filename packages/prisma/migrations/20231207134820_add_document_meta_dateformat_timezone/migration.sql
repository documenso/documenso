-- AlterTable
ALTER TABLE "DocumentMeta" ADD COLUMN     "dateFormat" TEXT DEFAULT 'yyyy-MM-dd',
ADD COLUMN     "timezone" TEXT DEFAULT 'Etc/UTC';
