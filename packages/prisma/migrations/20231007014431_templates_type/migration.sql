/*
  Warnings:

  - The `status` column on the `Template` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "TemplateType" AS ENUM ('PUBLIC', 'PRIVATE');

-- AlterTable
ALTER TABLE "Template" DROP COLUMN "status",
ADD COLUMN     "status" "TemplateType" NOT NULL DEFAULT 'PRIVATE';

-- DropEnum
DROP TYPE "TemplateStatus";
