import { db } from './client';
import { 
  users,
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
  ledgerLines,
  blockchainTransactions
} from './schema';
import { encryptSecret } from '../crypto';
import { stellarProvider } from '../stellar/provider';
import { eq, sql } from 'drizzle-orm';

export async function runDatabaseSeeder() {
  console.log('--- SEEDING DATABASE ---');

  // Clear existing transactions and bookings first (safe for seed re-runs)
  console.log('Cleaning existing transaction data...');
  await db.delete(blockchainTransactions);
  await db.delete(disputes);
  await db.delete(ledgerLines);
  await db.delete(ledgerEntries);
  await db.delete(escrows);
  await db.delete(paymentIntents);
  await db.delete(reservations);
  await db.delete(listings);
  await db.delete(tenants);
  await db.delete(owners);
  await db.delete(users);
  await db.delete(wallets);
  await db.delete(ledgerAccounts);

  // Wipe auth tables (account before user to satisfy FK constraint).
  // neon_auth is a local sync of the Neon Auth upstream — deleting here
  // removes the rows from the DB that the proxy reads, allowing the seed
  // step below to re-register every test user from scratch via the HTTP API.
  await db.execute(sql`DELETE FROM neon_auth.account`);
  await db.execute(sql`DELETE FROM neon_auth.user`);

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

  // 1.5 Seed Users
  console.log('Seeding public users...');
  const [user1] = await db.insert(users).values({
    name: 'Sebastian Valerius',
    email: 'admin.demo@vytrosti.com',
  }).returning();

  const [user2] = await db.insert(users).values({
    name: 'Alexander Sterling',
    email: 'host2.demo@vytrosti.com',
  }).returning();

  const [user3] = await db.insert(users).values({
    name: 'Elena Rostova',
    email: 'guest1.demo@vytrosti.com',
  }).returning();

  const [user4] = await db.insert(users).values({
    name: 'Lucas Miller',
    email: 'guest2.demo@vytrosti.com',
  }).returning();

  // 2. Create Owners
  console.log('Seeding owners...');
  const [owner1] = await db.insert(owners).values({
    userId: user1.id,
    stellarPublicKey: 'GCQTG2372RLF74OWMEV4SIOTWIEZCA4DZ32C37R7635M262NZKU67252',
  }).returning();

  const [owner2] = await db.insert(owners).values({
    userId: user2.id,
    stellarPublicKey: 'GB22U5TRT4IQLH6OEX7D2DDKNYZ7L6L552M5J3T3QLNV6J223I56MOWH',
  }).returning();

  // Create Owner ledger accounts
  await db.insert(ledgerAccounts).values([
    { id: `liabilities:owners:${owner1.id}`, name: `${user1.name} Owed Balance`, type: 'liability' as const },
    { id: `liabilities:owners:${owner2.id}`, name: `${user2.name} Owed Balance`, type: 'liability' as const },
  ]);

  // 3. Create Tenants
  console.log('Seeding tenants...');
  const [tenant1] = await db.insert(tenants).values({
    userId: user3.id,
    stellarPublicKey: 'GCTENANT455NDJE7QWMEV4SIOTWIEZCA4DZ32C37R7635M262NZKU6GUEP',
  }).returning();

  const [tenant2] = await db.insert(tenants).values({
    userId: user4.id,
    stellarPublicKey: 'GCTENANT8821092QWMEV4SIOTWIEZCA4DZ32C37R7635M262NZKU6SAMPLE',
  }).returning();

  // Create Tenant ledger accounts
  await db.insert(ledgerAccounts).values([
    { id: `liabilities:tenants:${tenant1.id}`, name: `${user3.name} Refundable Deposits`, type: 'liability' as const },
    { id: `liabilities:tenants:${tenant2.id}`, name: `${user4.name} Refundable Deposits`, type: 'liability' as const },
  ]);

  // 4. Create Listings (4 Premium properties matching Stitch's homepage proposal)
  console.log('Seeding listings...');
  const sampleListings = [
    {
      ownerId: owner1.id,
      title: 'Uluwatu Sanctuary',
      description: 'A beachfront sanctuary in Bali. Minimalist brutalist villa surrounded by tropical greenery and an infinity pool.',
      pricePerNightUsdt: '1.0000',
      securityDepositUsdt: '1.0000',
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
      pricePerNightUsdt: '2.0000',
      securityDepositUsdt: '2.0000',
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
      pricePerNightUsdt: '3.0000',
      securityDepositUsdt: '3.0000',
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
      pricePerNightUsdt: '4.0000',
      securityDepositUsdt: '4.0000',
      images: [
        'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80'
      ],
      address: 'Via Cristoforo Colombo 15',
      city: 'Positano',
      country: 'Italy',
    },
    {
      ownerId: owner1.id,
      title: 'Santorini Sunset Caldera Villa',
      description: 'Exquisite cave villa offering panoramic views of the Aegean Sea, private infinity pool, and white-washed luxury.',
      pricePerNightUsdt: '5.0000',
      securityDepositUsdt: '5.0000',
      images: [
        'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?auto=format&fit=crop&w=800&q=80'
      ],
      address: 'Caldera Road 42',
      city: 'Santorini',
      country: 'Greece',
    },
    {
      ownerId: owner2.id,
      title: 'Kyoto Bamboo Wood Chalet',
      description: 'Traditional wooden townhouse nestled next to Arashiyama bamboo forest with private onsen and zen gardens.',
      pricePerNightUsdt: '1.5000',
      securityDepositUsdt: '1.5000',
      images: [
        'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=800&q=80'
      ],
      address: 'Arashiyama Path 12',
      city: 'Kyoto',
      country: 'Japan',
    },
    {
      ownerId: owner1.id,
      title: 'Manhattan Sky Penthouse',
      description: 'Ultra-luxury glass penthouse perched high above Central Park with a private helipad access and wrap-around terrace.',
      pricePerNightUsdt: '6.0000',
      securityDepositUsdt: '6.0000',
      images: [
        'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80'
      ],
      address: '5th Avenue Penthouse B',
      city: 'New York',
      country: 'USA',
    },
    {
      ownerId: owner2.id,
      title: 'Malibu Beachfront Villa',
      description: 'Spectacular mid-century modern beach house directly on Malibu sand with private deck, hot tub, and surf access.',
      pricePerNightUsdt: '7.0000',
      securityDepositUsdt: '7.0000',
      images: [
        'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?auto=format&fit=crop&w=800&q=80'
      ],
      address: 'Pacific Coast Highway 2042',
      city: 'Malibu',
      country: 'USA',
    },
    {
      ownerId: owner1.id,
      title: 'Reykjavik Aurora Glass Cabin',
      description: 'Futuristic A-frame glass cabin designed to watch the Northern Lights directly from your master bed.',
      pricePerNightUsdt: '2.5000',
      securityDepositUsdt: '2.5000',
      images: [
        'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=800&q=80'
      ],
      address: 'Golden Circle Trail 9',
      city: 'Reykjavik',
      country: 'Iceland',
    },
    {
      ownerId: owner2.id,
      title: 'Tulum Jungle Sanctuary',
      description: 'Eco-chic luxury treehouse offering private cenote pool, open-air master bathroom, and hanging nets.',
      pricePerNightUsdt: '1.8000',
      securityDepositUsdt: '1.8000',
      images: [
        'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80'
      ],
      address: 'Aldea Zama Road Lot 4',
      city: 'Tulum',
      country: 'Mexico',
    },
    {
      ownerId: owner1.id,
      title: 'Copacabana Ocean Loft',
      description: 'Stylish high-ceiling studio loft steps from Copacabana beach, featuring retro Brazilian design and hammocks.',
      pricePerNightUsdt: '1.2000',
      securityDepositUsdt: '1.2000',
      images: [
        'https://images.unsplash.com/photo-1502672023488-70e25813eb80?auto=format&fit=crop&w=800&q=80'
      ],
      address: 'Avenida Atlantica 1020',
      city: 'Rio de Janeiro',
      country: 'Brazil',
    },
    {
      ownerId: owner2.id,
      title: 'Reykjavik Volcanic Estate',
      description: 'Architectural volcanic stone estate surrounded by active steam vents and lava fields, with heated geothermal pool.',
      pricePerNightUsdt: '8.0000',
      securityDepositUsdt: '8.0000',
      images: [
        'https://images.unsplash.com/photo-1512915922686-57c11dde9b6b?auto=format&fit=crop&w=800&q=80'
      ],
      address: 'Grindavik Geothermal Zone',
      city: 'Reykjavik',
      country: 'Iceland',
    },
    {
      ownerId: owner1.id,
      title: 'Chamonix Alpine Chalet',
      description: 'Cozy timber chalet under Mont Blanc with sauna, outdoor hot tub, and direct ski-in/ski-out slope access.',
      pricePerNightUsdt: '3.5000',
      securityDepositUsdt: '3.5000',
      images: [
        'https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?auto=format&fit=crop&w=800&q=80'
      ],
      address: 'Chemin des Ecureuils 5',
      city: 'Chamonix',
      country: 'France',
    },
    {
      ownerId: owner2.id,
      title: 'Phuket Beach Hideaway',
      description: 'Cliffside private pool villa overlooking the Andaman Sea, featuring a dedicated butler and private beach access.',
      pricePerNightUsdt: '4.5000',
      securityDepositUsdt: '4.5000',
      images: [
        'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=800&q=80'
      ],
      address: 'Kata Noi Ocean Crest 17',
      city: 'Phuket',
      country: 'Thailand',
    },
    {
      ownerId: owner1.id,
      title: 'Sydney Harbour Penthouse',
      description: 'Sprawling luxury penthouse with uninterrupted panoramic views of the Opera House and Harbour Bridge.',
      pricePerNightUsdt: '9.0000',
      securityDepositUsdt: '9.0000',
      images: [
        'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80'
      ],
      address: 'Circular Quay East 10',
      city: 'Sydney',
      country: 'Australia',
    },
    {
      ownerId: owner2.id,
      title: 'Aspen Wood Cabin',
      description: 'Charming luxury log cabin with a stone fireplace, billiards room, and outdoor heated jacuzzi.',
      pricePerNightUsdt: '3.2000',
      securityDepositUsdt: '3.2000',
      images: [
        'https://images.unsplash.com/photo-1542718610-a1d656d1884c?auto=format&fit=crop&w=800&q=80'
      ],
      address: 'Red Mountain Roost 88',
      city: 'Aspen',
      country: 'USA',
    },
    {
      ownerId: owner1.id,
      title: 'Cape Town Cliff Villa',
      description: 'Stunning minimalist villa built directly into the cliffs of Clifton Beach, with heated pool and ocean sunsets.',
      pricePerNightUsdt: '5.5000',
      securityDepositUsdt: '5.5000',
      images: [
        'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=800&q=80'
      ],
      address: 'Clifton Victoria Road 104',
      city: 'Cape Town',
      country: 'South Africa',
    },
    {
      ownerId: owner2.id,
      title: 'Barcelona Gothic Loft',
      description: 'High-ceiling loft with exposed historic brickwork, steel accents, and a private courtyard pool in the Gothic Quarter.',
      pricePerNightUsdt: '2.2000',
      securityDepositUsdt: '2.2000',
      images: [
        'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=800&q=80'
      ],
      address: 'Carrer dels Banys Nous 7',
      city: 'Barcelona',
      country: 'Spain',
    },
    {
      ownerId: owner1.id,
      title: 'Dubailand Desert Villa',
      description: 'Ultra-luxury oasis in the Dubai desert featuring sand-dune views, infinity pool, and private falconry displays.',
      pricePerNightUsdt: '10.0000',
      securityDepositUsdt: '10.0000',
      images: [
        'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=800&q=80'
      ],
      address: 'Al Maha Desert Oasis 11',
      city: 'Dubai',
      country: 'UAE',
    },
    {
      ownerId: owner2.id,
      title: 'Vancouver Forest Cabin',
      description: 'Rustic-chic cabin in the deep woods of British Columbia, with a cedar hot tub and wooden deck over a flowing stream.',
      pricePerNightUsdt: '1.6000',
      securityDepositUsdt: '1.6000',
      images: [
        'https://images.unsplash.com/photo-1449034446853-66c86144b0ad?auto=format&fit=crop&w=800&q=80'
      ],
      address: 'Deep Cove Wilderness Lot 33',
      city: 'Vancouver',
      country: 'Canada',
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
  // 4 nights at Uluwatu Sanctuary = 1 * 4 = 4 rent + 0.20 fee + 1 deposit = 5.20 total
  const checkIn1 = new Date();
  checkIn1.setDate(checkIn1.getDate() + 5);
  const checkOut1 = new Date();
  checkOut1.setDate(checkOut1.getDate() + 9);

  const [res1] = await db.insert(reservations).values({
    listingId: listingUluwatu.id,
    tenantId: tenant1.id,
    checkIn: checkIn1,
    checkOut: checkOut1,
    subtotalUsdt: '4.0000',
    securityDepositUsdt: '1.0000',
    platformFeeUsdt: '0.2000',
    status: 'pending_payment',
  }).returning();

  // Assign Wallet 0 to booking 1
  await db.update(wallets).set({ status: 'assigned' }).where(eq(wallets.id, poolWallets[0].id));

  await db.insert(paymentIntents).values({
    reservationId: res1.id,
    walletId: poolWallets[0].id,
    amountUsdt: '5.2000',
    status: 'pending',
    expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours expiry
  });

  // 7. Create Booking 2 (Escrowed / Deposit Secured state)
  console.log('Seeding booking 2 (escrowed / deposit secured)...');
  // 5 nights at Tokyo Loft = 2 * 5 = 10 rent + 0.5 fee + 2 deposit = 12.5 total
  const checkIn2 = new Date();
  checkIn2.setDate(checkIn2.getDate() + 15);
  const checkOut2 = new Date();
  checkOut2.setDate(checkOut2.getDate() + 20);

  const [res2] = await db.insert(reservations).values({
    listingId: listingTokyo.id,
    tenantId: tenant1.id,
    checkIn: checkIn2,
    checkOut: checkOut2,
    subtotalUsdt: '10.0000',
    securityDepositUsdt: '2.0000',
    platformFeeUsdt: '0.5000',
    status: 'escrowed',
  }).returning();

  await db.update(wallets).set({ status: 'settling' }).where(eq(wallets.id, poolWallets[1].id));

  await db.insert(paymentIntents).values({
    reservationId: res2.id,
    walletId: poolWallets[1].id,
    amountUsdt: '12.5000',
    status: 'paid',
    expiresAt: new Date(Date.now() - 1 * 60 * 60 * 1000), // expired/used
    txHash: '0x2222222222222222222222222222222222222222222222222222222222222222',
  });

  const [escrow2] = await db.insert(escrows).values({
    reservationId: res2.id,
    contractAddress: 'GCSMARTECSROWCONTRACT222222222222222222222222222',
    amountUsdt: '2.0000',
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
      { accountPath: `assets:wallet_pool:${poolWallets[1].publicKey}`, amount: '12.5000', direction: 'debit' },
      { accountPath: `liabilities:tenants:${tenant1.id}`, amount: '2.0000', direction: 'credit' },
      { accountPath: `liabilities:owners:${owner1.id}`, amount: '10.0000', direction: 'credit' },
      { accountPath: `revenue:fees`, amount: '0.5000', direction: 'credit' },
    ]
  );
  // B. Security Deposit Locked in smart escrow contract
  await postSeedLedgerEntry(
    `Locked deposit in Smart Escrow contract for Reservation #${res2.id.substring(0, 8)}`,
    'reservation',
    res2.id,
    [
      { accountPath: `assets:escrow:trustless:${escrow2.id}`, amount: '2.0000', direction: 'debit' },
      { accountPath: `assets:wallet_pool:${poolWallets[1].publicKey}`, amount: '2.0000', direction: 'credit' },
    ]
  );
  // C. Sweeping rent and fee to platform treasury
  await postSeedLedgerEntry(
    `Swept rent and platform fee from pool wallet for Reservation #${res2.id.substring(0, 8)}`,
    'reservation',
    res2.id,
    [
      { accountPath: `assets:treasury`, amount: '10.5000', direction: 'debit' },
      { accountPath: `assets:wallet_pool:${poolWallets[1].publicKey}`, amount: '10.5000', direction: 'credit' },
    ]
  );


  // 8. Create Booking 3 (Completed checkout state)
  console.log('Seeding booking 3 (completed checkout)...');
  // 5 nights at Alpina Cabin = 3 * 5 = 15 rent + 0.75 fee + 3 deposit = 18.75 total
  const checkIn3 = new Date();
  checkIn3.setDate(checkIn3.getDate() - 10);
  const checkOut3 = new Date();
  checkOut3.setDate(checkOut3.getDate() - 5);

  const [res3] = await db.insert(reservations).values({
    listingId: listingAlps.id,
    tenantId: tenant2.id,
    checkIn: checkIn3,
    checkOut: checkOut3,
    subtotalUsdt: '15.0000',
    securityDepositUsdt: '3.0000',
    platformFeeUsdt: '0.7500',
    status: 'completed',
  }).returning();

  // await db.update(wallets).set({ status: 'cooldown' }).where(eq(wallets.id, poolWallets[2].id));

  await db.insert(paymentIntents).values({
    reservationId: res3.id,
    walletId: poolWallets[2].id,
    amountUsdt: '18.7500',
    status: 'paid',
    expiresAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000),
    txHash: '0x3333333333333333333333333333333333333333333333333333333333333333',
  });

  const [escrow3] = await db.insert(escrows).values({
    reservationId: res3.id,
    contractAddress: 'GCSMARTECSROWCONTRACT333333333333333333333333333',
    amountUsdt: '3.0000',
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
      { accountPath: `assets:wallet_pool:${poolWallets[2].publicKey}`, amount: '18.7500', direction: 'debit' },
      { accountPath: `liabilities:tenants:${tenant2.id}`, amount: '3.0000', direction: 'credit' },
      { accountPath: `liabilities:owners:${owner2.id}`, amount: '15.0000', direction: 'credit' },
      { accountPath: `revenue:fees`, amount: '0.7500', direction: 'credit' },
    ]
  );
  // B. Security Deposit Locked in smart escrow contract
  await postSeedLedgerEntry(
    `Locked deposit in Smart Escrow contract for Reservation #${res3.id.substring(0, 8)}`,
    'reservation',
    res3.id,
    [
      { accountPath: `assets:escrow:trustless:${escrow3.id}`, amount: '3.0000', direction: 'debit' },
      { accountPath: `assets:wallet_pool:${poolWallets[2].publicKey}`, amount: '3.0000', direction: 'credit' },
    ]
  );
  // C. Sweeping rent and fee to platform treasury
  await postSeedLedgerEntry(
    `Swept rent and platform fee from pool wallet for Reservation #${res3.id.substring(0, 8)}`,
    'reservation',
    res3.id,
    [
      { accountPath: `assets:treasury`, amount: '15.7500', direction: 'debit' },
      { accountPath: `assets:wallet_pool:${poolWallets[2].publicKey}`, amount: '15.7500', direction: 'credit' },
    ]
  );
  // D. Checkout Payout to Owner (Owner rent portion paid out of treasury)
  await postSeedLedgerEntry(
    `Checkout Owner Payout for Reservation #${res3.id.substring(0, 8)}`,
    'reservation',
    res3.id,
    [
      { accountPath: `liabilities:owners:${owner2.id}`, amount: '15.0000', direction: 'debit' },
      { accountPath: `assets:treasury`, amount: '15.0000', direction: 'credit' },
    ]
  );
  // E. Checkout Refund to Tenant (Tenant deposit released from Smart Escrow contract)
  await postSeedLedgerEntry(
    `Checkout Security Deposit Refund for Reservation #${res3.id.substring(0, 8)}`,
    'reservation',
    res3.id,
    [
      { accountPath: `liabilities:tenants:${tenant2.id}`, amount: '3.0000', direction: 'debit' },
      { accountPath: `assets:escrow:trustless:${escrow3.id}`, amount: '3.0000', direction: 'credit' },
    ]
  );


  // 9. Create Booking 4 (Disputed state)
  console.log('Seeding booking 4 (disputed)...');
  // 5 nights at Azure Cliff = 4 * 5 = 20 rent + 1 fee + 4 deposit = 25 total
  const checkIn4 = new Date();
  checkIn4.setDate(checkIn4.getDate() - 15);
  const checkOut4 = new Date();
  checkOut4.setDate(checkOut4.getDate() - 10);

  const [res4] = await db.insert(reservations).values({
    listingId: listingAmalfi.id,
    tenantId: tenant1.id,
    checkIn: checkIn4,
    checkOut: checkOut4,
    subtotalUsdt: '20.0000',
    securityDepositUsdt: '4.0000',
    platformFeeUsdt: '1.0000',
    status: 'disputed',
  }).returning();

  // await db.update(wallets).set({ status: 'cooldown' }).where(eq(wallets.id, poolWallets[3].id));

  await db.insert(paymentIntents).values({
    reservationId: res4.id,
    walletId: poolWallets[3].id,
    amountUsdt: '25.0000',
    status: 'paid',
    expiresAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
    txHash: '0x4444444444444444444444444444444444444444444444444444444444444444',
  });

  const [escrow4] = await db.insert(escrows).values({
    reservationId: res4.id,
    contractAddress: 'GCSMARTECSROWCONTRACT444444444444444444444444444',
    amountUsdt: '4.0000',
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
    claimedAmountUsdt: '4.0000',
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
      { accountPath: `assets:wallet_pool:${poolWallets[3].publicKey}`, amount: '25.0000', direction: 'debit' },
      { accountPath: `liabilities:tenants:${tenant1.id}`, amount: '4.0000', direction: 'credit' },
      { accountPath: `liabilities:owners:${owner2.id}`, amount: '20.0000', direction: 'credit' },
      { accountPath: `revenue:fees`, amount: '1.0000', direction: 'credit' },
    ]
  );
  // B. Security Deposit Locked in smart escrow contract
  await postSeedLedgerEntry(
    `Locked deposit in Smart Escrow contract for Reservation #${res4.id.substring(0, 8)}`,
    'reservation',
    res4.id,
    [
      { accountPath: `assets:escrow:trustless:${escrow4.id}`, amount: '4.0000', direction: 'debit' },
      { accountPath: `assets:wallet_pool:${poolWallets[3].publicKey}`, amount: '4.0000', direction: 'credit' },
    ]
  );
  // C. Sweeping rent and fee to platform treasury
  await postSeedLedgerEntry(
    `Swept rent and platform fee from pool wallet for Reservation #${res4.id.substring(0, 8)}`,
    'reservation',
    res4.id,
    [
      { accountPath: `assets:treasury`, amount: '21.0000', direction: 'debit' },
      { accountPath: `assets:wallet_pool:${poolWallets[3].publicKey}`, amount: '21.0000', direction: 'credit' },
    ]
  );
  // D. checkout rent payout to host
  await postSeedLedgerEntry(
    `Checkout Owner Payout (Disputed Stay) for Reservation #${res4.id.substring(0, 8)}`,
    'reservation',
    res4.id,
    [
      { accountPath: `liabilities:owners:${owner2.id}`, amount: '20.0000', direction: 'debit' },
      { accountPath: `assets:treasury`, amount: '20.0000', direction: 'credit' },
    ]
  );

  // 10. Seed Neon Auth Users via upstream HTTP API
  // Neon Auth is a managed proxy — users MUST be registered via its HTTP sign-up
  // endpoint, not via direct DB inserts. We call the upstream sign-up endpoint for
  // each test user, then patch the admin role in the local sync table afterwards.
  console.log('Seeding authentication users via Neon Auth upstream...');

  const neonAuthBaseUrl = process.env.NEON_AUTH_BASE_URL;
  if (!neonAuthBaseUrl) {
    console.warn('NEON_AUTH_BASE_URL is not set — skipping auth user seeding.');
  } else {
    const testUsers = [
      { email: 'admin.demo@vytrosti.com',  password: 'Vytr0sti#Admin2024!',  name: 'Sebastian Valerius' },
      { email: 'guest1.demo@vytrosti.com', password: 'Vytr0sti#Guest1!', name: 'Elena Rostova'       },
      { email: 'guest2.demo@vytrosti.com', password: 'Vytr0sti#Guest2!', name: 'Lucas Miller'        },
      { email: 'host2.demo@vytrosti.com',  password: 'Vytr0sti#Host2!',  name: 'Alexander Sterling' },
    ];

    for (const user of testUsers) {
      try {
        // Attempt sign-up on the upstream Neon Auth service.
        // If the user already exists the endpoint returns 422 — we swallow that
        // so the seed script is safe to re-run.
        const res = await fetch(`${neonAuthBaseUrl}/sign-up/email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Origin': 'http://localhost:3000',
          },
          body: JSON.stringify({
            email:       user.email,
            password:    user.password,
            name:        user.name,
            callbackURL: 'http://localhost:3000/',
          }),
        });

        const text = await res.text();

        if (res.ok) {
          console.log(`  ✓ Registered ${user.email} (status ${res.status})`);
        } else if (res.status === 422 || res.status === 409) {
          // User already exists — safe to continue
          console.log(`  ~ ${user.email} already exists upstream (status ${res.status}) — skipping`);
        } else {
          console.warn(`  ✗ Failed to register ${user.email}: ${res.status} ${res.statusText} — ${text}`);
        }
      } catch (err) {
        console.warn(`  ✗ Network error registering ${user.email}:`, err);
      }
    }

    // Grant admin role to the admin user in the local neon_auth sync table.
    // The upstream doesn't manage roles — the role column lives only in the local DB.
    try {
      await db.execute(sql`
        UPDATE neon_auth.user SET role = 'admin'
        WHERE email = 'admin.demo@vytrosti.com'
      `);
      console.log('  ✓ Granted admin role to admin.demo@vytrosti.com');
    } catch (err) {
      console.warn('  Could not set admin role (user may not have synced yet):', err);
    }

    console.log('Auth user seeding complete.');
  }

  console.log('Seeding completed successfully!');
}
