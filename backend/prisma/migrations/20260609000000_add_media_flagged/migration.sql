-- Add a moderation "flagged" flag to media so AI content moderation can mark
-- unsafe uploads for admin review. moderationLabels already exists from the
-- baseline migration; guard it with IF NOT EXISTS so this is idempotent.
ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "flagged" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "moderationLabels" TEXT[] DEFAULT ARRAY[]::TEXT[];
