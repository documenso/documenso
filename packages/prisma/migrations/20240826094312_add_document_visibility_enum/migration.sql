/*
  Warnings:

  - The `visibility` column on the `Document` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "DocumentVisibility" AS ENUM ('EVERYONE', 'MANAGER_AND_ABOVE', 'ADMIN');

-- AlterTable
ALTER TABLE "Document" DROP COLUMN "visibility",
ADD COLUMN     "visibility" "DocumentVisibility" NOT NULL DEFAULT 'EVERYONE';
