-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "avatarImageId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarImageId" TEXT;

-- CreateTable
CREATE TABLE "AvatarImage" (
    "id" TEXT NOT NULL,
    "bytes" TEXT NOT NULL,

    CONSTRAINT "AvatarImage_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_avatarImageId_fkey" FOREIGN KEY ("avatarImageId") REFERENCES "AvatarImage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_avatarImageId_fkey" FOREIGN KEY ("avatarImageId") REFERENCES "AvatarImage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
