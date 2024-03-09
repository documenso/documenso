-- CreateTable
CREATE TABLE "Banner" (
    "id" SERIAL NOT NULL,
    "text" TEXT NOT NULL,
    "customHTML" TEXT NOT NULL,
    "userId" INTEGER,

    CONSTRAINT "Banner_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Banner" ADD CONSTRAINT "Banner_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
