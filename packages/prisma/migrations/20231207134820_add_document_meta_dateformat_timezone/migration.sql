-- AlterTable
ALTER TABLE "DocumentMeta" ADD COLUMN     "dateFormat" TEXT DEFAULT 'MM-DD-YYYY',
ADD COLUMN     "timezone" TEXT DEFAULT 'Europe/London';
