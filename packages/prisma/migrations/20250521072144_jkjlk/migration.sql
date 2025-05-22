/*
  Warnings:

  - You are about to drop the column `allowEmbeddedAuthoring` on the `TeamGlobalSettings` table. All the data in the column will be lost.
  - Made the column `teamId` on table `ApiToken` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "ApiToken" ALTER COLUMN "teamId" SET NOT NULL;

-- AlterTable
ALTER TABLE "TeamGlobalSettings" DROP COLUMN "allowEmbeddedAuthoring";
