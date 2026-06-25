import { db } from './client';
import { 
  owners, 
  tenants, 
  listings, 
  wallets, 
  ledgerAccounts, 
  reservations, 
  paymentIntents, 
  escrows, 
  disputes, 
  ledgerEntries, 
  ledgerLines 
} from './schema';
import { encryptSecret } from '../crypto';
import { stellarProvider } from '../stellar/provider';
import { eq } from 'drizzle-orm';

export async function runDatabaseSeeder() {
  console.log('--- SEEDING DATABASE ---');

  // Clear existing transactions and bookings first (safe for seed re-runs)
  console.log('Cleaning existing transaction data...');
  await db.delete(disputes);
  await db.delete(ledgerLines);
  await db.delete(ledgerEntries);
  await db.delete(escrows);
  await db.delete(paymentIntents);
  await db.delete(reservations);
  await db.delete(listings);
  await db.delete(tenants);
  await db.delete(owners);
  await db.delete(wallets);
  await db.delete(ledgerAccounts);

  // 1. Setup Ledger Accounts
  console.log('Seeding ledger accounts...');
  const baseAccounts = [
    { id: 'assets:treasury', name: 'Platform Treasury Account', type: 'asset' as const },
    { id: 'revenue:fees', name: 'Platform Fee Revenue', type: 'revenue' as const },
    { id: 'equity:platform', name: 'Platform Equity Balance', type: 'equity' as const },
  ];

  for (const acc of baseAccounts) {
    await db.insert(ledgerAccounts).values(acc).onConflictDoNothing();
  }

  // 2. Create Owners
  console.log('Seeding owners...');
  const [owner1] = await db.insert(owners).values({
    stellarPublicKey: 'GCQTG2372RLF74OWMEV4SIOTWIEZCA4DZ32C37R7635M262NZKU67252',
  }).returning();

  const [owner2] = await db.insert(owners).values({
    stellarPublicKey: 'GB22U5TRT4IQLH6OEX7D2DDKNYZ7L6L552M5J3T3QLNV6J223I56MOWH',
  }).returning();

  // Create Owner ledger accounts
  await db.insert(ledgerAccounts).values([
    { id: `liabilities:owners:${owner1.id}`, name: `Owner 1 Owed Balance`, type: 'liability' as const },
    { id: `liabilities:owners:${owner2.id}`, name: `Owner 2 Owed Balance`, type: 'liability' as const },
  ]);

  // 3. Create Tenants
  console.log('Seeding tenants...');
  const [tenant1] = await db.insert(tenants).values({
    stellarPublicKey: 'GCTENANT455NDJE7QWMEV4SIOTWIEZCA4DZ32C37R7635M262NZKU6GUEP',
  }).returning();

  const [tenant2] = await db.insert(tenants).values({
    stellarPublicKey: 'GCTENANT8821092QWMEV4SIOTWIEZCA4DZ32C37R7635M262NZKU6SAMPLE',
  }).returning();

  // Create Tenant ledger accounts
  await db.insert(ledgerAccounts).values([
    { id: `liabilities:tenants:${tenant1.id}`, name: `Tenant 1 Refundable Deposits`, type: 'liability' as const },
    { id: `liabilities:tenants:${tenant2.id}`, name: `Tenant 2 Refundable Deposits`, type: 'liability' as const },
  ]);

  // 4. Create Listings (4 Premium properties matching Stitch's homepage proposal)
  console.log('Seeding listings...');
  const sampleListings = [
    {
      ownerId: owner1.id,
      title: 'Uluwatu Sanctuary',
      description: 'A beachfront sanctuary in Bali. Minimalist brutalist villa surrounded by tropical greenery and an infinity pool.',
      pricePerNightUsdt: '450.0000',
      securityDepositUsdt: '500.0000',
      images: [
        'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1513584684374-8bab748fbf90?auto=format&fit=crop&w=800&q=80'
      ],
      address: 'Jalan Pura Uluwatu 88',
      city: 'Bali',
      country: 'Indonesia',
    },
    {
      ownerId: owner1.id,
      title: 'Neo-Tokyo Loft',
      description: 'Stunning glass penthouse in Shibuya with floor-to-ceiling windows overlooking the neon Tokyo skyline.',
      pricePerNightUsdt: '820.0000',
      securityDepositUsdt: '900.0000',
      images: [
        'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80'
      ],
      address: 'Shibuya Crossing Suite 404',
      city: 'Tokyo',
      country: 'Japan',
    },
    {
      ownerId: owner2.id,
      title: 'Alpina Peak Cabin',
      description: 'Ultra-modern A-frame cabin in Zermatt. Panoramic mountain views, custom fireplace, and hot tub.',
      pricePerNightUsdt: '690.0000',
      securityDepositUsdt: '800.0000',
      images: [
        'https://images.unsplash.com/photo-1518780664697-55e3ad937233?auto=format&fit=crop&w=800&q=80'
      ],
      address: 'Route des Alpinistes 22',
      city: 'Zermatt',
      country: 'Switzerland',
    },
    {
      ownerId: owner2.id,
      title: 'Azure Cliff Estate',
      description: 'Luxurious cliffside villa on the Amalfi Coast. Clean architectural lines, private deck, and emerald sea views.',
      pricePerNightUsdt: '1200.0000',
      securityDepositUsdt: '1500.0000',
      images: [
        'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80'
      ],
      address: 'Via Cristoforo Colombo 15',
      city: 'Positano',
      country: 'Italy',
    }
  ];

  const seededListings = await db.insert(listings).values(sampleListings).returning();
  const listingUluwatu = seededListings[0];
  const listingTokyo = seededListings[1];
  const listingAlps = seededListings[2];
  const listingAmalfi = seededListings[3];

  // 5. Seed Wallet Pool (5 wallets)
  console.log('Generating and seeding 5 pool accounts...');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const poolWallets: any[] = [];
  for (let i = 0; i < 5; i++) {
    const kp = stellarProvider.createKeypair();
    const { encrypted, iv, tag } = encryptSecret(kp.secretKey);
    
    const [walletRecord] = await db.insert(wallets).values({
      publicKey: kp.publicKey,
      encryptedSecretKey: encrypted,
      encryptionIv: iv,
      encryptionTag: tag,
      status: 'available',
    }).returning();
    poolWallets.push(walletRecord);

    // Create ledger account for this wallet
    await db.insert(ledgerAccounts).values({
      id: `assets:wallet_pool:${kp.publicKey}`,
      name: `Pool Wallet (${kp.publicKey.substring(0, 6)}...${kp.publicKey.slice(-4)})`,
      type: 'asset' as const,
    });
  }

  // Helper to insert ledger entries and lines synchronously to ensure validation passes
  const postSeedLedgerEntry = async (
    description: string,
    refType: string,
    refId: string,
    lines: { accountPath: string; amount: string; direction: 'debit' | 'credit' }[]
  ) => {
    const [entry] = await db.insert(ledgerEntries).values({
      description,
      referenceType: refType,
      referenceId: refId,
    }).returning();

    for (const line of lines) {
      await db.insert(ledgerLines).values({
        entryId: entry.id,
        accountPath: line.accountPath,
        amount: line.amount,
        direction: line.direction,
      });
    }
    return entry.id;
  };

  // 6. Create Booking 1 (Pending Payment state)
  console.log('Seeding booking 1 (pending payment)...');
  // 4 nights at Uluwatu Sanctuary = 450 * 4 = 1800 rent + 90 fee + 500 deposit = 2390 total
  const checkIn1 = new Date();
  checkIn1.setDate(checkIn1.getDate() + 5);
  const checkOut1 = new Date();
  checkOut1.setDate(checkOut1.getDate() + 9);

  const [res1] = await db.insert(reservations).values({
    listingId: listingUluwatu.id,
    tenantId: tenant1.id,
    checkIn: checkIn1,
    checkOut: checkOut1,
    subtotalUsdt: '1800.0000',
    securityDepositUsdt: '500.0000',
    platformFeeUsdt: '90.0000',
    status: 'pending_payment',
  }).returning();

  // Assign Wallet 0 to booking 1
  await db.update(wallets).set({ status: 'assigned' }).where(eq(wallets.id, poolWallets[0].id));

  await db.insert(paymentIntents).values({
    reservationId: res1.id,
    walletId: poolWallets[0].id,
    amountUsdt: '2390.0000',
    status: 'pending',
    expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours expiry
  });

  // 7. Create Booking 2 (Escrowed / Deposit Secured state)
  console.log('Seeding booking 2 (escrowed / deposit secured)...');
  // 5 nights at Tokyo Loft = 820 * 5 = 4100 rent + 205 fee + 900 deposit = 5205 total
  const checkIn2 = new Date();
  checkIn2.setDate(checkIn2.getDate() + 15);
  const checkOut2 = new Date();
  checkOut2.setDate(checkOut2.getDate() + 20);

  const [res2] = await db.insert(reservations).values({
    listingId: listingTokyo.id,
    tenantId: tenant1.id,
    checkIn: checkIn2,
    checkOut: checkOut2,
    subtotalUsdt: '4100.0000',
    securityDepositUsdt: '900.0000',
    platformFeeUsdt: '205.0000',
    status: 'escrowed',
  }).returning();

  await db.update(wallets).set({ status: 'settling' }).where(eq(wallets.id, poolWallets[1].id));

  await db.insert(paymentIntents).values({
    reservationId: res2.id,
    walletId: poolWallets[1].id,
    amountUsdt: '5205.0000',
    status: 'paid',
    expiresAt: new Date(Date.now() - 1 * 60 * 60 * 1000), // expired/used
    txHash: '0x2222222222222222222222222222222222222222222222222222222222222222',
  });

  const [escrow2] = await db.insert(escrows).values({
    reservationId: res2.id,
    contractAddress: 'GCSMARTECSROWCONTRACT222222222222222222222222222',
    amountUsdt: '900.0000',
    status: 'funded',
    trustlessEscrowId: 'tw_escrow_8821092',
  }).returning();

  // Create ledger account for this escrow
  await db.insert(ledgerAccounts).values({
    id: `assets:escrow:trustless:${escrow2.id}`,
    name: `Smart Escrow #${escrow2.trustlessEscrowId}`,
    type: 'asset' as const,
  });

  // Post Balanced Ledger Entries for Booking 2
  // A. Booking Payment Received
  await postSeedLedgerEntry(
    `Rent and deposit received from Tenant 1 for Reservation #${res2.id.substring(0, 8)}`,
    'reservation',
    res2.id,
    [
      { accountPath: `assets:wallet_pool:${poolWallets[1].publicKey}`, amount: '5205.0000', direction: 'debit' },
      { accountPath: `liabilities:tenants:${tenant1.id}`, amount: '900.0000', direction: 'credit' },
      { accountPath: `liabilities:owners:${owner1.id}`, amount: '4100.0000', direction: 'credit' },
      { accountPath: `revenue:fees`, amount: '205.0000', direction: 'credit' },
    ]
  );
  // B. Security Deposit Locked in smart escrow contract
  await postSeedLedgerEntry(
    `Locked deposit in Smart Escrow contract for Reservation #${res2.id.substring(0, 8)}`,
    'reservation',
    res2.id,
    [
      { accountPath: `assets:escrow:trustless:${escrow2.id}`, amount: '900.0000', direction: 'debit' },
      { accountPath: `assets:wallet_pool:${poolWallets[1].publicKey}`, amount: '900.0000', direction: 'credit' },
    ]
  );
  // C. Sweeping rent and fee to platform treasury
  await postSeedLedgerEntry(
    `Swept rent and platform fee from pool wallet for Reservation #${res2.id.substring(0, 8)}`,
    'reservation',
    res2.id,
    [
      { accountPath: `assets:treasury`, amount: '4305.0000', direction: 'debit' },
      { accountPath: `assets:wallet_pool:${poolWallets[1].publicKey}`, amount: '4305.0000', direction: 'credit' },
    ]
  );


  // 8. Create Booking 3 (Completed checkout state)
  console.log('Seeding booking 3 (completed checkout)...');
  // 5 nights at Alpina Cabin = 690 * 5 = 3450 rent + 172.50 fee + 800 deposit = 4422.50 total
  const checkIn3 = new Date();
  checkIn3.setDate(checkIn3.getDate() - 10);
  const checkOut3 = new Date();
  checkOut3.setDate(checkOut3.getDate() - 5);

  const [res3] = await db.insert(reservations).values({
    listingId: listingAlps.id,
    tenantId: tenant2.id,
    checkIn: checkIn3,
    checkOut: checkOut3,
    subtotalUsdt: '3450.0000',
    securityDepositUsdt: '800.0000',
    platformFeeUsdt: '172.5000',
    status: 'completed',
  }).returning();

  await db.update(wallets).set({ status: 'cooldown' }).where(eq(wallets.id, poolWallets[2].id));

  await db.insert(paymentIntents).values({
    reservationId: res3.id,
    walletId: poolWallets[2].id,
    amountUsdt: '4422.5000',
    status: 'paid',
    expiresAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000),
    txHash: '0x3333333333333333333333333333333333333333333333333333333333333333',
  });

  const [escrow3] = await db.insert(escrows).values({
    reservationId: res3.id,
    contractAddress: 'GCSMARTECSROWCONTRACT333333333333333333333333333',
    amountUsdt: '800.0000',
    status: 'released',
    trustlessEscrowId: 'tw_escrow_5510293',
  }).returning();

  // Create ledger account for this escrow
  await db.insert(ledgerAccounts).values({
    id: `assets:escrow:trustless:${escrow3.id}`,
    name: `Smart Escrow #${escrow3.trustlessEscrowId}`,
    type: 'asset' as const,
  });

  // Post Balanced Ledger Entries for Booking 3 (Fully settled)
  // A. Booking Payment Received
  await postSeedLedgerEntry(
    `Rent and deposit received from Tenant 2 for Reservation #${res3.id.substring(0, 8)}`,
    'reservation',
    res3.id,
    [
      { accountPath: `assets:wallet_pool:${poolWallets[2].publicKey}`, amount: '4422.5000', direction: 'debit' },
      { accountPath: `liabilities:tenants:${tenant2.id}`, amount: '800.0000', direction: 'credit' },
      { accountPath: `liabilities:owners:${owner2.id}`, amount: '3450.0000', direction: 'credit' },
      { accountPath: `revenue:fees`, amount: '172.5000', direction: 'credit' },
    ]
  );
  // B. Security Deposit Locked in smart escrow contract
  await postSeedLedgerEntry(
    `Locked deposit in Smart Escrow contract for Reservation #${res3.id.substring(0, 8)}`,
    'reservation',
    res3.id,
    [
      { accountPath: `assets:escrow:trustless:${escrow3.id}`, amount: '800.0000', direction: 'debit' },
      { accountPath: `assets:wallet_pool:${poolWallets[2].publicKey}`, amount: '800.0000', direction: 'credit' },
    ]
  );
  // C. Sweeping rent and fee to platform treasury
  await postSeedLedgerEntry(
    `Swept rent and platform fee from pool wallet for Reservation #${res3.id.substring(0, 8)}`,
    'reservation',
    res3.id,
    [
      { accountPath: `assets:treasury`, amount: '3622.5000', direction: 'debit' },
      { accountPath: `assets:wallet_pool:${poolWallets[2].publicKey}`, amount: '3622.5000', direction: 'credit' },
    ]
  );
  // D. Checkout Payout to Owner (Owner rent portion paid out of treasury)
  await postSeedLedgerEntry(
    `Checkout Owner Payout for Reservation #${res3.id.substring(0, 8)}`,
    'reservation',
    res3.id,
    [
      { accountPath: `liabilities:owners:${owner2.id}`, amount: '3450.0000', direction: 'debit' },
      { accountPath: `assets:treasury`, amount: '3450.0000', direction: 'credit' },
    ]
  );
  // E. Checkout Refund to Tenant (Tenant deposit released from Smart Escrow contract)
  await postSeedLedgerEntry(
    `Checkout Security Deposit Refund for Reservation #${res3.id.substring(0, 8)}`,
    'reservation',
    res3.id,
    [
      { accountPath: `liabilities:tenants:${tenant2.id}`, amount: '800.0000', direction: 'debit' },
      { accountPath: `assets:escrow:trustless:${escrow3.id}`, amount: '800.0000', direction: 'credit' },
    ]
  );


  // 9. Create Booking 4 (Disputed state)
  console.log('Seeding booking 4 (disputed)...');
  // 5 nights at Azure Cliff = 1200 * 5 = 6000 rent + 300 fee + 1500 deposit = 7800 total
  const checkIn4 = new Date();
  checkIn4.setDate(checkIn4.getDate() - 15);
  const checkOut4 = new Date();
  checkOut4.setDate(checkOut4.getDate() - 10);

  const [res4] = await db.insert(reservations).values({
    listingId: listingAmalfi.id,
    tenantId: tenant1.id,
    checkIn: checkIn4,
    checkOut: checkOut4,
    subtotalUsdt: '6000.0000',
    securityDepositUsdt: '1500.0000',
    platformFeeUsdt: '300.0000',
    status: 'disputed',
  }).returning();

  await db.update(wallets).set({ status: 'cooldown' }).where(eq(wallets.id, poolWallets[3].id));

  await db.insert(paymentIntents).values({
    reservationId: res4.id,
    walletId: poolWallets[3].id,
    amountUsdt: '7800.0000',
    status: 'paid',
    expiresAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
    txHash: '0x4444444444444444444444444444444444444444444444444444444444444444',
  });

  const [escrow4] = await db.insert(escrows).values({
    reservationId: res4.id,
    contractAddress: 'GCSMARTECSROWCONTRACT444444444444444444444444444',
    amountUsdt: '1500.0000',
    status: 'disputed',
    trustlessEscrowId: 'tw_escrow_3309120',
  }).returning();

  // Create ledger account for this escrow
  await db.insert(ledgerAccounts).values({
    id: `assets:escrow:trustless:${escrow4.id}`,
    name: `Smart Escrow #${escrow4.trustlessEscrowId}`,
    type: 'asset' as const,
  });

  // Create dispute record
  await db.insert(disputes).values({
    escrowId: escrow4.id,
    reservationId: res4.id,
    claimedAmountUsdt: '1500.0000',
    reason: 'Host claims guest damaged the custom outdoor dining table and broke glass panels.',
    status: 'active',
  });

  // Post Balanced Ledger Entries for Booking 4 (Disputed, rent paid but deposit locked)
  // A. Booking Payment Received
  await postSeedLedgerEntry(
    `Rent and deposit received from Tenant 1 for Reservation #${res4.id.substring(0, 8)}`,
    'reservation',
    res4.id,
    [
      { accountPath: `assets:wallet_pool:${poolWallets[3].publicKey}`, amount: '7800.0000', direction: 'debit' },
      { accountPath: `liabilities:tenants:${tenant1.id}`, amount: '1500.0000', direction: 'credit' },
      { accountPath: `liabilities:owners:${owner2.id}`, amount: '6000.0000', direction: 'credit' },
      { accountPath: `revenue:fees`, amount: '300.0000', direction: 'credit' },
    ]
  );
  // B. Security Deposit Locked in smart escrow contract
  await postSeedLedgerEntry(
    `Locked deposit in Smart Escrow contract for Reservation #${res4.id.substring(0, 8)}`,
    'reservation',
    res4.id,
    [
      { accountPath: `assets:escrow:trustless:${escrow4.id}`, amount: '1500.0000', direction: 'debit' },
      { accountPath: `assets:wallet_pool:${poolWallets[3].publicKey}`, amount: '1500.0000', direction: 'credit' },
    ]
  );
  // C. Sweeping rent and fee to platform treasury
  await postSeedLedgerEntry(
    `Swept rent and platform fee from pool wallet for Reservation #${res4.id.substring(0, 8)}`,
    'reservation',
    res4.id,
    [
      { accountPath: `assets:treasury`, amount: '6300.0000', direction: 'debit' },
      { accountPath: `assets:wallet_pool:${poolWallets[3].publicKey}`, amount: '6300.0000', direction: 'credit' },
    ]
  );
  // D. checkout rent payout to host
  await postSeedLedgerEntry(
    `Checkout Owner Payout (Disputed Stay) for Reservation #${res4.id.substring(0, 8)}`,
    'reservation',
    res4.id,
    [
      { accountPath: `liabilities:owners:${owner2.id}`, amount: '6000.0000', direction: 'debit' },
      { accountPath: `assets:treasury`, amount: '6000.0000', direction: 'credit' },
    ]
  );

  console.log('Seeding completed successfully!');
}
