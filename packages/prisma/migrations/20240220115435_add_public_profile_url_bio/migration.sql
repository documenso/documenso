/*
  Warnings:

  - A unique constraint covering the columns `[profileURL]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "profileURL" TEXT;

-- CreateTable
CREATE TABLE "UserProfile" (
    "profileURL" TEXT NOT NULL,
    "profileBio" TEXT,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("profileURL")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_profileURL_key" ON "UserProfile"("profileURL");

-- CreateIndex
CREATE UNIQUE INDEX "User_profileURL_key" ON "User"("profileURL");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_profileURL_fkey" FOREIGN KEY ("profileURL") REFERENCES "UserProfile"("profileURL") ON DELETE CASCADE ON UPDATE CASCADE;
