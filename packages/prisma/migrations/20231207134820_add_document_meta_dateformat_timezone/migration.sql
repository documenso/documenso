-- AlterTable
ALTER TABLE "DocumentMeta" ADD COLUMN     "dateFormat" TEXT DEFAULT 'yyyy-MM-dd hh:mm a',
ADD COLUMN     "timezone" TEXT DEFAULT 'Etc/UTC';
