/*
  Warnings:

  - Added the required column `event` to the `WebhookCall` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "WebhookCall" ADD COLUMN     "event" "WebhookTriggerEvents" NOT NULL;
