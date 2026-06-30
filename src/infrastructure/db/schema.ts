import { pgTable, uuid, text, numeric, timestamp, jsonb, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const walletStatusEnum = pgEnum('wallet_status', ['available', 'assigned', 'settling', 'cooldown', 'disabled']);
export const reservationStatusEnum = pgEnum('reservation_status', [
  'pending_payment',
  'paid',
  'escrowed',
  'active',
  'completed',
  'cancelled',
  'disputed',
  'checking_out'
]);
export const paymentIntentStatusEnum = pgEnum('payment_intent_status', ['pending', 'paid', 'expired']);
export const escrowStatusEnum = pgEnum('escrow_status', ['pending', 'funded', 'released', 'disputed', 'resolved', 'refunded']);
export const payoutTypeEnum = pgEnum('payout_type', ['owner_rent', 'tenant_refund', 'platform_fee']);
export const payoutStatusEnum = pgEnum('payout_status', ['pending', 'processing', 'completed', 'failed']);
export const disputeStatusEnum = pgEnum('dispute_status', ['active', 'resolved_to_tenant', 'resolved_to_owner', 'split_resolution']);
export const ledgerAccountTypeEnum = pgEnum('ledger_account_type', ['asset', 'liability', 'equity', 'revenue', 'expense']);
export const ledgerDirectionEnum = pgEnum('ledger_direction', ['debit', 'credit']);

// 0. Users
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 1. Owners
export const owners = pgTable('owners', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull().unique(),
  stellarPublicKey: text('stellar_public_key').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 2. Tenants
export const tenants = pgTable('tenants', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull().unique(),
  stellarPublicKey: text('stellar_public_key').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 3. Listings
export const listings = pgTable('listings', {
  id: uuid('id').defaultRandom().primaryKey(),
  ownerId: uuid('owner_id').references(() => owners.id).notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  pricePerNightUsdt: numeric('price_per_night_usdt', { precision: 18, scale: 4 }).notNull(),
  securityDepositUsdt: numeric('security_deposit_usdt', { precision: 18, scale: 4 }).notNull(),
  images: jsonb('images').$type<string[]>().default([]).notNull(),
  address: text('address').notNull(),
  city: text('city').notNull(),
  country: text('country').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 4. Reservations
export const reservations = pgTable('reservations', {
  id: uuid('id').defaultRandom().primaryKey(),
  listingId: uuid('listing_id').references(() => listings.id).notNull(),
  tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
  checkIn: timestamp('check_in').notNull(),
  checkOut: timestamp('check_out').notNull(),
  subtotalUsdt: numeric('subtotal_usdt', { precision: 18, scale: 4 }).notNull(),
  securityDepositUsdt: numeric('security_deposit_usdt', { precision: 18, scale: 4 }).notNull(),
  platformFeeUsdt: numeric('platform_fee_usdt', { precision: 18, scale: 4 }).notNull(),
  status: text('status').$type<'pending_payment' | 'paid' | 'escrowed' | 'active' | 'completed' | 'cancelled' | 'disputed' | 'checking_out'>().default('pending_payment').notNull(),
  checkoutClaimedAt: timestamp('checkout_claimed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 5. Wallets (Pool Wallets)
export const wallets = pgTable('wallets', {
  id: uuid('id').defaultRandom().primaryKey(),
  publicKey: text('public_key').notNull().unique(),
  encryptedSecretKey: text('encrypted_secret_key').notNull(),
  encryptionIv: text('encryption_iv').notNull(),
  encryptionTag: text('encryption_tag').notNull(),
  status: text('status').$type<'available' | 'assigned' | 'settling' | 'cooldown' | 'disabled'>().default('available').notNull(),
  lastHorizonCursor: text('last_horizon_cursor'),
  lastPolledAt: timestamp('last_polled_at'),
});

// 6. Payment Intents
export const paymentIntents = pgTable('payment_intents', {
  id: uuid('id').defaultRandom().primaryKey(),
  reservationId: uuid('reservation_id').references(() => reservations.id).notNull(),
  walletId: uuid('wallet_id').references(() => wallets.id).notNull(),
  amountUsdt: numeric('amount_usdt', { precision: 18, scale: 4 }).notNull(),
  status: text('status').$type<'pending' | 'paid' | 'expired'>().default('pending').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  txHash: text('tx_hash'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 7. Escrows (Trustless Work Escrow tracking)
export const escrows = pgTable('escrows', {
  id: uuid('id').defaultRandom().primaryKey(),
  reservationId: uuid('reservation_id').references(() => reservations.id).notNull(),
  contractAddress: text('contract_address'),
  amountUsdt: numeric('amount_usdt', { precision: 18, scale: 4 }).notNull(),
  status: text('status').$type<'pending' | 'funded' | 'released' | 'disputed' | 'resolved' | 'refunded'>().default('pending').notNull(),
  trustlessEscrowId: text('trustless_escrow_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 8. Payouts
export const payouts = pgTable('payouts', {
  id: uuid('id').defaultRandom().primaryKey(),
  reservationId: uuid('reservation_id').references(() => reservations.id).notNull(),
  recipientAddress: text('recipient_address').notNull(),
  amountUsdt: numeric('amount_usdt', { precision: 18, scale: 4 }).notNull(),
  payoutType: text('payout_type').$type<'owner_rent' | 'tenant_refund' | 'platform_fee'>().notNull(),
  status: text('status').$type<'pending' | 'processing' | 'completed' | 'failed'>().default('pending').notNull(),
  txHash: text('tx_hash'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
});

// 9. Disputes
export const disputes = pgTable('disputes', {
  id: uuid('id').defaultRandom().primaryKey(),
  escrowId: uuid('escrow_id').references(() => escrows.id).notNull(),
  reservationId: uuid('reservation_id').references(() => reservations.id).notNull(),
  claimedAmountUsdt: numeric('claimed_amount_usdt', { precision: 18, scale: 4 }).notNull(),
  reason: text('reason').notNull(),
  status: text('status').$type<'active' | 'resolved_to_tenant' | 'resolved_to_owner' | 'split_resolution'>().default('active').notNull(),
  resolutionDetails: text('resolution_details'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  resolvedAt: timestamp('resolved_at'),
});

// 10. Settlements
export const settlements = pgTable('settlements', {
  id: uuid('id').defaultRandom().primaryKey(),
  reservationId: uuid('reservation_id').references(() => reservations.id).notNull(),
  totalRentUsdt: numeric('total_rent_usdt', { precision: 18, scale: 4 }).notNull(),
  platformFeeUsdt: numeric('platform_fee_usdt', { precision: 18, scale: 4 }).notNull(),
  ownerShareUsdt: numeric('owner_share_usdt', { precision: 18, scale: 4 }).notNull(),
  securityDepositRefundUsdt: numeric('security_deposit_refund_usdt', { precision: 18, scale: 4 }).notNull(),
  securityDepositRetainedUsdt: numeric('security_deposit_retained_usdt', { precision: 18, scale: 4 }).notNull(),
  settledAt: timestamp('settled_at').defaultNow().notNull(),
});

// 11. Ledger Accounts
export const ledgerAccounts = pgTable('ledger_accounts', {
  id: text('id').primaryKey(), // e.g. "assets:wallet_pool:address", "liabilities:owners:uuid"
  name: text('name').notNull(),
  type: text('type').$type<'asset' | 'liability' | 'equity' | 'revenue' | 'expense'>().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 12. Ledger Entries
export const ledgerEntries = pgTable('ledger_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  description: text('description').notNull(),
  referenceType: text('reference_type'), // e.g. "reservation", "payout", "escrow"
  referenceId: text('reference_id'),
  postedAt: timestamp('posted_at').defaultNow().notNull(),
});

// 13. Ledger Lines
export const ledgerLines = pgTable('ledger_lines', {
  id: uuid('id').defaultRandom().primaryKey(),
  entryId: uuid('entry_id').references(() => ledgerEntries.id).notNull(),
  accountPath: text('account_path').references(() => ledgerAccounts.id).notNull(),
  amount: numeric('amount', { precision: 18, scale: 4 }).notNull(),
  direction: text('direction').$type<'debit' | 'credit'>().notNull(),
});

// 14. Blockchain Transactions (For Polling Idempotency)
export const blockchainTransactions = pgTable('blockchain_transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  walletId: uuid('wallet_id').references(() => wallets.id).notNull(),
  txHash: text('tx_hash').notNull().unique(),
  amount: numeric('amount', { precision: 18, scale: 4 }).notNull(),
  assetCode: text('asset_code').notNull(),
  fromAddress: text('from_address').notNull(),
  toAddress: text('to_address').notNull(),
  ledgerCursor: text('ledger_cursor').notNull(),
  processedAt: timestamp('processed_at').defaultNow().notNull(),
});


// 15. System Config
export const systemConfigs = pgTable('system_configs', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Relations
export const userRelations = relations(users, ({ one }) => ({
  owner: one(owners, { fields: [users.id], references: [owners.userId] }),
  tenant: one(tenants, { fields: [users.id], references: [tenants.userId] }),
}));

export const ownerRelations = relations(owners, ({ one, many }) => ({
  user: one(users, { fields: [owners.userId], references: [users.id] }),
  listings: many(listings),
}));

export const tenantRelations = relations(tenants, ({ one, many }) => ({
  user: one(users, { fields: [tenants.userId], references: [users.id] }),
  reservations: many(reservations),
}));

export const listingRelations = relations(listings, ({ one, many }) => ({
  owner: one(owners, { fields: [listings.ownerId], references: [owners.id] }),
  reservations: many(reservations),
}));

export const reservationRelations = relations(reservations, ({ one, many }) => ({
  listing: one(listings, { fields: [reservations.listingId], references: [listings.id] }),
  tenant: one(tenants, { fields: [reservations.tenantId], references: [tenants.id] }),
  paymentIntents: many(paymentIntents),
  escrows: many(escrows),
  payouts: many(payouts),
  settlements: many(settlements),
}));

export const walletRelations = relations(wallets, ({ many }) => ({
  paymentIntents: many(paymentIntents),
  blockchainTransactions: many(blockchainTransactions),
}));

export const paymentIntentRelations = relations(paymentIntents, ({ one }) => ({
  reservation: one(reservations, { fields: [paymentIntents.reservationId], references: [reservations.id] }),
  wallet: one(wallets, { fields: [paymentIntents.walletId], references: [wallets.id] }),
}));

export const escrowRelations = relations(escrows, ({ one, many }) => ({
  reservation: one(reservations, { fields: [escrows.reservationId], references: [reservations.id] }),
  disputes: many(disputes),
}));

export const payoutRelations = relations(payouts, ({ one }) => ({
  reservation: one(reservations, { fields: [payouts.reservationId], references: [reservations.id] }),
}));

export const disputeRelations = relations(disputes, ({ one }) => ({
  escrow: one(escrows, { fields: [disputes.escrowId], references: [escrows.id] }),
  reservation: one(reservations, { fields: [disputes.reservationId], references: [reservations.id] }),
}));

export const settlementRelations = relations(settlements, ({ one }) => ({
  reservation: one(reservations, { fields: [settlements.reservationId], references: [reservations.id] }),
}));

export const ledgerEntryRelations = relations(ledgerEntries, ({ many }) => ({
  lines: many(ledgerLines),
}));

export const ledgerLineRelations = relations(ledgerLines, ({ one }) => ({
  entry: one(ledgerEntries, { fields: [ledgerLines.entryId], references: [ledgerEntries.id] }),
  account: one(ledgerAccounts, { fields: [ledgerLines.accountPath], references: [ledgerAccounts.id] }),
}));

export const blockchainTransactionRelations = relations(blockchainTransactions, ({ one }) => ({
  wallet: one(wallets, { fields: [blockchainTransactions.walletId], references: [wallets.id] }),
}));
