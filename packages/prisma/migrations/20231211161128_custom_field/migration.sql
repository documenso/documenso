-- AlterEnum
ALTER TYPE "FieldType" ADD VALUE 'CUSTOM';

-- AlterTable
ALTER TABLE "Field" ADD COLUMN     "customFieldValue" TEXT NOT NULL DEFAULT '';
