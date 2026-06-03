-- AlterTable: add shareToken to events
ALTER TABLE "events" ADD COLUMN "shareToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "events_shareToken_key" ON "events"("shareToken");
