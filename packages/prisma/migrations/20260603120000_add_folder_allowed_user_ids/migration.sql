-- AlterTable
ALTER TABLE "Folder" ADD COLUMN "allowedUserIds" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
