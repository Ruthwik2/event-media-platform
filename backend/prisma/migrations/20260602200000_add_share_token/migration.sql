-- AlterTable: add shareToken to albums for private album guest access
ALTER TABLE "albums" ADD COLUMN "shareToken" TEXT;

-- Unique index so lookups are fast and tokens can't collide
CREATE UNIQUE INDEX "albums_shareToken_key" ON "albums"("shareToken");
