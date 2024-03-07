-- CreateTable
CREATE TABLE "DummyData" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "hello" TEXT,

    CONSTRAINT "DummyData_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "DummyData" ADD CONSTRAINT "DummyData_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
