-- CreateEnum
CREATE TYPE "DocumentDistributionMethod" AS ENUM ('EMAIL', 'NONE');

-- AlterTable
ALTER TABLE "DocumentMeta" ADD COLUMN     "distributionMethod" "DocumentDistributionMethod" NOT NULL DEFAULT 'EMAIL',
ADD COLUMN     "emailSettings" JSONB;

-- AlterTable
ALTER TABLE "TemplateMeta" ADD COLUMN     "distributionMethod" "DocumentDistributionMethod" NOT NULL DEFAULT 'EMAIL',
ADD COLUMN     "emailSettings" JSONB;
