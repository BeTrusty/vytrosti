ALTER TYPE "public"."reservation_status" ADD VALUE 'checking_out';--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "checkout_claimed_at" timestamp;