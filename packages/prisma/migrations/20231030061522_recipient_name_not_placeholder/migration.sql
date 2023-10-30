/*
  Warnings:

  - You are about to drop the column `placeholder` on the `TemplateRecipient` table. All the data in the column will be lost.
  - Added the required column `name` to the `TemplateRecipient` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "TemplateRecipient" DROP COLUMN "placeholder",
ADD COLUMN     "name" VARCHAR(255) NOT NULL;
