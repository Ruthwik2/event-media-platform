-- Add positional coordinates (percentage of width/height) for Instagram-style photo tags.
ALTER TABLE "media_tags" ADD COLUMN IF NOT EXISTS "x" DOUBLE PRECISION;
ALTER TABLE "media_tags" ADD COLUMN IF NOT EXISTS "y" DOUBLE PRECISION;
