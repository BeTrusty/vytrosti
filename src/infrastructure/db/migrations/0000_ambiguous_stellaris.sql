CREATE TYPE "public"."dispute_status" AS ENUM('active', 'resolved_to_tenant', 'resolved_to_owner', 'split_resolution');--> statement-breakpoint
CREATE TYPE "public"."escrow_status" AS ENUM('pending', 'funded', 'released', 'disputed', 'resolved', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."ledger_account_type" AS ENUM('asset', 'liability', 'equity', 'revenue', 'expense');--> statement-breakpoint
CREATE TYPE "public"."ledger_direction" AS ENUM('debit', 'credit');--> statement-breakpoint
CREATE TYPE "public"."payment_intent_status" AS ENUM('pending', 'paid', 'expired');--> statement-breakpoint
CREATE TYPE "public"."payout_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."payout_type" AS ENUM('owner_rent', 'tenant_refund', 'platform_fee');--> statement-breakpoint
CREATE TYPE "public"."reservation_status" AS ENUM('pending_payment', 'paid', 'escrowed', 'active', 'completed', 'cancelled', 'disputed');--> statement-breakpoint
CREATE TYPE "public"."wallet_status" AS ENUM('available', 'assigned', 'settling', 'cooldown', 'disabled');--> statement-breakpoint
CREATE TABLE "blockchain_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_id" uuid NOT NULL,
	"tx_hash" text NOT NULL,
	"amount" numeric(18, 4) NOT NULL,
	"asset_code" text NOT NULL,
	"from_address" text NOT NULL,
	"to_address" text NOT NULL,
	"ledger_cursor" text NOT NULL,
	"processed_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "blockchain_transactions_tx_hash_unique" UNIQUE("tx_hash")
);
--> statement-breakpoint
CREATE TABLE "disputes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"escrow_id" uuid NOT NULL,
	"reservation_id" uuid NOT NULL,
	"claimed_amount_usdt" numeric(18, 4) NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"resolution_details" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "escrows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reservation_id" uuid NOT NULL,
	"contract_address" text,
	"amount_usdt" numeric(18, 4) NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"trustless_escrow_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"description" text NOT NULL,
	"reference_type" text,
	"reference_id" text,
	"posted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"account_path" text NOT NULL,
	"amount" numeric(18, 4) NOT NULL,
	"direction" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"price_per_night_usdt" numeric(18, 4) NOT NULL,
	"security_deposit_usdt" numeric(18, 4) NOT NULL,
	"images" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"address" text NOT NULL,
	"city" text NOT NULL,
	"country" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "owners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stellar_public_key" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_intents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reservation_id" uuid NOT NULL,
	"wallet_id" uuid NOT NULL,
	"amount_usdt" numeric(18, 4) NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"tx_hash" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reservation_id" uuid NOT NULL,
	"recipient_address" text NOT NULL,
	"amount_usdt" numeric(18, 4) NOT NULL,
	"payout_type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"tx_hash" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"check_in" timestamp NOT NULL,
	"check_out" timestamp NOT NULL,
	"subtotal_usdt" numeric(18, 4) NOT NULL,
	"security_deposit_usdt" numeric(18, 4) NOT NULL,
	"platform_fee_usdt" numeric(18, 4) NOT NULL,
	"status" text DEFAULT 'pending_payment' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reservation_id" uuid NOT NULL,
	"total_rent_usdt" numeric(18, 4) NOT NULL,
	"platform_fee_usdt" numeric(18, 4) NOT NULL,
	"owner_share_usdt" numeric(18, 4) NOT NULL,
	"security_deposit_refund_usdt" numeric(18, 4) NOT NULL,
	"security_deposit_retained_usdt" numeric(18, 4) NOT NULL,
	"settled_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stellar_public_key" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_key" text NOT NULL,
	"encrypted_secret_key" text NOT NULL,
	"encryption_iv" text NOT NULL,
	"encryption_tag" text NOT NULL,
	"status" text DEFAULT 'available' NOT NULL,
	"last_horizon_cursor" text,
	"last_polled_at" timestamp,
	CONSTRAINT "wallets_public_key_unique" UNIQUE("public_key")
);
--> statement-breakpoint
ALTER TABLE "blockchain_transactions" ADD CONSTRAINT "blockchain_transactions_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_escrow_id_escrows_id_fk" FOREIGN KEY ("escrow_id") REFERENCES "public"."escrows"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escrows" ADD CONSTRAINT "escrows_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_lines" ADD CONSTRAINT "ledger_lines_entry_id_ledger_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."ledger_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_lines" ADD CONSTRAINT "ledger_lines_account_path_ledger_accounts_id_fk" FOREIGN KEY ("account_path") REFERENCES "public"."ledger_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE no action ON UPDATE no action;