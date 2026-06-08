-- Add an optional category to albums (mirrors event categories).
ALTER TABLE "albums" ADD COLUMN IF NOT EXISTS "category" TEXT;
