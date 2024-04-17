/*
  Warnings:

  - You are about to drop the column `profileURL` on the `User` table. All the data in the column will be lost.
  - The primary key for the `UserProfile` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `profileBio` on the `UserProfile` table. All the data in the column will be lost.
  - You are about to drop the column `profileURL` on the `UserProfile` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[url]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `id` to the `UserProfile` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_profileURL_fkey";

-- DropIndex
DROP INDEX "User_profileURL_key";

-- DropIndex
DROP INDEX "UserProfile_profileURL_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "profileURL",
ADD COLUMN     "url" TEXT;

-- AlterTable
ALTER TABLE "UserProfile" DROP CONSTRAINT "UserProfile_pkey",
DROP COLUMN "profileBio",
DROP COLUMN "profileURL",
ADD COLUMN     "bio" TEXT,
ADD COLUMN     "id" INTEGER NOT NULL,
ADD CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id");

-- CreateIndex
CREATE UNIQUE INDEX "User_url_key" ON "User"("url");

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_id_fkey" FOREIGN KEY ("id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
