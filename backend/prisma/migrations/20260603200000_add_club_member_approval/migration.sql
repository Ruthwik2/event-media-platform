-- Add isApproved field to users (false by default for new CLUB_MEMBER registrations)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "isApproved" BOOLEAN NOT NULL DEFAULT false;

-- Existing CLUB_MEMBERs and all other roles get auto-approved so nothing breaks
UPDATE "users" SET "isApproved" = true WHERE "role" != 'CLUB_MEMBER';
UPDATE "users" SET "isApproved" = true WHERE "role" = 'CLUB_MEMBER'; -- existing members grandfathered in

-- Create membership_requests table (re-uses AccessRequest model with type='MEMBERSHIP')
-- No new table needed — we reuse AccessRequest with type='MEMBERSHIP'
