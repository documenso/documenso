-- AlterTable
ALTER TABLE "Folder" ADD COLUMN "allowedGroupIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
