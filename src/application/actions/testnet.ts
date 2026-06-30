'use server';

import { db } from '@/infrastructure/db/client';
import { wallets, ledgerAccounts, blockchainTransactions, users as usersTable, owners as ownersTable, tenants as tenantsTable, systemConfigs } from '@/infrastructure/db/schema';
import { eq } from 'drizzle-orm';
import { encryptSecret } from '@/infrastructure/crypto';
import * as StellarSdk from '@stellar/stellar-sdk';
import crypto from 'crypto';
import { revalidatePath } from 'next/cache';
import { walletPoolService } from '../services/wallet-pool';

// Interface to return account details to UI
export interface DeveloperAccountDetails {
  id: string;
  publicKey: string;
  status: string;
  xlmBalance: string;
  usdcBalance: string;
  usdtBalance: string;
  isEnv: boolean;
}

export interface ConfiguredSystemAccount {
  publicKey: string;
  label: string;
  category: 'treasury' | 'master' | 'issuer' | 'pool' | 'owner' | 'tenant';
}

interface AssetDescriptor {
  code: 'USDC' | 'USDT';
  issuer: string;
}

// Helper to save developer master keys to DB
async function saveMasterKeysInDb(publicKey: string, secretKey: string) {
  try {
    const existing = await db.query.systemConfigs.findFirst({
      where: eq(systemConfigs.key, 'stellar_dev_keys'),
    });

    if (existing) {
      await db
        .update(systemConfigs)
        .set({
          value: JSON.stringify({ publicKey, secretKey }),
          updatedAt: new Date(),
        })
        .where(eq(systemConfigs.key, 'stellar_dev_keys'));
    } else {
      await db.insert(systemConfigs).values({
        key: 'stellar_dev_keys',
        value: JSON.stringify({ publicKey, secretKey }),
      });
    }
  } catch (err) {
    console.error('Failed to save master keys to DB:', err);
  }
}

// Helpers for mock user balances
async function getMockBalancesMap(): Promise<Record<string, { xlm: string; usdc: string; usdt: string }>> {
  try {
    const config = await db.query.systemConfigs.findFirst({
      where: eq(systemConfigs.key, 'mock_balances'),
    });
    if (config) {
      return JSON.parse(config.value);
    }
  } catch (err) {
    console.error('Failed to read mock balances:', err);
  }
  return {};
}

async function saveMockBalancesMap(map: Record<string, { xlm: string; usdc: string; usdt: string }>) {
  try {
    const existing = await db.query.systemConfigs.findFirst({
      where: eq(systemConfigs.key, 'mock_balances'),
    });
    if (existing) {
      await db
        .update(systemConfigs)
        .set({
          value: JSON.stringify(map),
          updatedAt: new Date(),
        })
        .where(eq(systemConfigs.key, 'mock_balances'));
    } else {
      await db.insert(systemConfigs).values({
        key: 'mock_balances',
        value: JSON.stringify(map),
      });
    }
  } catch (err) {
    console.error('Failed to save mock balances:', err);
  }
}

// Helper to resolve master secret key (checks env, input, then DB)
async function resolveMasterSecretKey(inputSecret: string | undefined): Promise<string | undefined> {
  const envSecretKey = process.env.STELLAR_DEV_SECRET_KEY;
  if (envSecretKey) return envSecretKey;
  if (inputSecret) {
    try {
      const derivedPub = StellarSdk.Keypair.fromSecret(inputSecret).publicKey();
      await saveMasterKeysInDb(derivedPub, inputSecret);
    } catch {
      // ignore invalid secret keys
    }
    return inputSecret;
  }

  try {
    const dbKeys = await db.query.systemConfigs.findFirst({
      where: eq(systemConfigs.key, 'stellar_dev_keys'),
    });
    if (dbKeys) {
      const parsed = JSON.parse(dbKeys.value);
      return parsed.secretKey;
    }
  } catch (err) {
    console.error('Error resolving master secret key from DB:', err);
  }
  return undefined;
}

// Helper to resolve master public key
async function resolveMasterPublicKey(inputPublic: string | undefined): Promise<string | undefined> {
  const envPublicKey = process.env.STELLAR_DEV_PUBLIC_KEY;
  if (envPublicKey) return envPublicKey;
  if (inputPublic) return inputPublic;

  try {
    const dbKeys = await db.query.systemConfigs.findFirst({
      where: eq(systemConfigs.key, 'stellar_dev_keys'),
    });
    if (dbKeys) {
      const parsed = JSON.parse(dbKeys.value);
      return parsed.publicKey;
    }
  } catch (err) {
    console.error('Error resolving master public key from DB:', err);
  }
  return undefined;
}

function getExplorerBaseUrl() {
  return process.env.STELLAR_NETWORK === 'public'
    ? 'https://stellar.expert/explorer/public/account/'
    : 'https://stellar.expert/explorer/testnet/account/';
}

function getAssetDescriptor(assetType: 'USDC' | 'USDT'): AssetDescriptor {
  const issuer = process.env.STELLAR_USDC_ASSET_ISSUER || 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
  if (assetType === 'USDC') {
    return {
      code: 'USDC',
      issuer,
    };
  }

  return {
    code: 'USDT',
    issuer,
  };
}

async function ensureFriendbotFunding(publicKey: string) {
  try {
    await fetch(`https://friendbot.stellar.org/?addr=${publicKey}`);
  } catch (err) {
    console.warn('Friendbot funding warning, account might already be active:', err);
  }
}

async function ensureAssetTrustline(
  server: StellarSdk.Horizon.Server,
  publicKey: string,
  secretKey: string,
  assetType: 'USDC' | 'USDT'
) {
  const { code, issuer } = getAssetDescriptor(assetType);
  const asset = new StellarSdk.Asset(code, issuer);
  const networkPassphrase = StellarSdk.Networks.TESTNET;

  const account = await server.loadAccount(publicKey);
  const hasTrustline = account.balances.some(
    (balance) =>
      balance.asset_type !== 'native' &&
      'asset_code' in balance &&
      balance.asset_code === code &&
      'asset_issuer' in balance &&
      balance.asset_issuer === issuer
  );

  if (hasTrustline) {
    return { created: false };
  }

  const keypair = StellarSdk.Keypair.fromSecret(secretKey);
  const trustTx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase,
  })
    .addOperation(
      StellarSdk.Operation.changeTrust({
        asset,
      })
    )
    .setTimeout(30)
    .build();

  trustTx.sign(keypair);
  const result = await server.submitTransaction(trustTx);
  return {
    created: true,
    txHash: result.hash,
  };
}

async function resolveConfiguredAccountSecret(
  publicKey: string,
  masterSecretKeyInput?: string
): Promise<string | undefined> {
  const treasuryPublicKey = process.env.STELLAR_TREASURY_PUBLIC_KEY;
  const treasurySecretKey = process.env.STELLAR_TREASURY_SECRET_KEY;

  if (treasuryPublicKey && publicKey === treasuryPublicKey) {
    return treasurySecretKey;
  }

  const masterPublicKey = await resolveMasterPublicKey(undefined);
  if (masterPublicKey && masterPublicKey === publicKey) {
    return resolveMasterSecretKey(masterSecretKeyInput);
  }

  const secretConfig = await db.query.systemConfigs.findFirst({
    where: eq(systemConfigs.key, `test_user_secret_${publicKey}`),
  });

  if (secretConfig?.value) {
    return secretConfig.value;
  }

  const walletRecord = await db.query.wallets.findFirst({
    where: eq(wallets.publicKey, publicKey),
  });

  if (walletRecord) {
    return walletPoolService.getWalletSecret(walletRecord.id);
  }

  return undefined;
}

async function issueUsdtFromIssuer(
  destinationPublicKey: string,
  amountStr: string,
  masterSecretKeyInput?: string
): Promise<{ txHash: string }> {
  const issuerPublicKey = process.env.STELLAR_USDC_ASSET_ISSUER || '';
  if (!issuerPublicKey) {
    throw new Error('USDC issuer is not configured in environment');
  }

  const issuerSecretKey = await resolveConfiguredAccountSecret(issuerPublicKey, masterSecretKeyInput);
  if (!issuerSecretKey) {
    throw new Error('Could not resolve the secret key for the configured USDC issuer.');
  }

  const horizonUrl = process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org';
  const server = new StellarSdk.Horizon.Server(horizonUrl);
  const networkPassphrase = StellarSdk.Networks.TESTNET;
  const issuerKeypair = StellarSdk.Keypair.fromSecret(issuerSecretKey);

  if (issuerKeypair.publicKey() !== issuerPublicKey) {
    throw new Error('The resolved issuer secret key does not match STELLAR_USDC_ASSET_ISSUER.');
  }

  await ensureFriendbotFunding(issuerPublicKey);
  const issuerAccount = await server.loadAccount(issuerPublicKey);
  const asset = new StellarSdk.Asset(process.env.STELLAR_USDC_ASSET_CODE || 'USDC', issuerPublicKey);
  const paymentTx = new StellarSdk.TransactionBuilder(issuerAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase,
  })
    .addOperation(
      StellarSdk.Operation.payment({
        destination: destinationPublicKey,
        asset,
        amount: amountStr,
      })
    )
    .setTimeout(30)
    .build();

  paymentTx.sign(issuerKeypair);
  const result = await server.submitTransaction(paymentTx);
  return { txHash: result.hash };
}

// 1. Get developer master keys status from environment or database
export async function getMasterKeysConfig() {
  const envPublicKey = process.env.STELLAR_DEV_PUBLIC_KEY;
  const envSecretKey = process.env.STELLAR_DEV_SECRET_KEY;
  const isMock = process.env.STELLAR_MOCK !== 'false';

  if (envPublicKey && envSecretKey) {
    return {
      publicKey: envPublicKey,
      secretKey: envSecretKey,
      isConfigured: true,
      isMock,
    };
  }

  // Fallback to database
  try {
    const dbKeys = await db.query.systemConfigs.findFirst({
      where: eq(systemConfigs.key, 'stellar_dev_keys'),
    });
    if (dbKeys) {
      const parsed = JSON.parse(dbKeys.value);
      return {
        publicKey: parsed.publicKey,
        secretKey: parsed.secretKey,
        isConfigured: true,
        isMock,
      };
    }
  } catch (err) {
    console.error('Failed to load developer keys config from database:', err);
  }

  return {
    publicKey: null,
    secretKey: null,
    isConfigured: false,
    isMock,
  };
}

// 2. Generate random developer keys (server-side helper) and persist in database
export async function generateMasterKeys() {
  const pair = StellarSdk.Keypair.random();
  const publicKey = pair.publicKey();
  const secretKey = pair.secret();

  await saveMasterKeysInDb(publicKey, secretKey);

  return {
    publicKey,
    secretKey,
  };
}

// 3. Deterministically derive and save N accounts to DB
export async function createDerivedAccountsAction(
  masterPublicKey: string,
  masterSecretKeyInput: string | undefined,
  count: number
) {
  try {
    const masterSecretKey = await resolveMasterSecretKey(masterSecretKeyInput);

    if (!masterSecretKey) {
      throw new Error('Secret key is required for derivation');
    }

    const derivedAccounts: { publicKey: string; secretKey: string }[] = [];

    // Deriving N accounts
    for (let i = 0; i < count; i++) {
      // Create a deterministic 32-byte seed from the master secret key and the index
      const seed = crypto
        .createHash('sha256')
        .update(masterSecretKey + '_' + i)
        .digest();
      const kp = StellarSdk.Keypair.fromRawEd25519Seed(seed);
      derivedAccounts.push({
        publicKey: kp.publicKey(),
        secretKey: kp.secret(),
      });
    }

    const results: string[] = [];

    // Save to database
    await db.transaction(async (tx) => {
      for (const account of derivedAccounts) {
        // Check if account already exists in DB
        const existing = await tx.query.wallets.findFirst({
          where: eq(wallets.publicKey, account.publicKey),
        });

        if (!existing) {
          const { encrypted, iv, tag } = encryptSecret(account.secretKey);

          await tx.insert(wallets).values({
            publicKey: account.publicKey,
            encryptedSecretKey: encrypted,
            encryptionIv: iv,
            encryptionTag: tag,
            status: 'available',
          });

          // Create ledger account coordinates
          await tx.insert(ledgerAccounts).values({
            id: `assets:wallet_pool:${account.publicKey}`,
            name: `Pool Account (${account.publicKey.substring(0, 6)}...${account.publicKey.slice(-4)})`,
            type: 'asset',
          });

          results.push(account.publicKey);
        } else {
          results.push(account.publicKey);
        }
      }
    });

    console.log(`Registered ${results.length} derived accounts.`);
    revalidatePath('/testnet');
    return { success: true, accounts: results };
  } catch (error) {
    console.error('Failed to create accounts:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to derive accounts',
    };
  }
}

// 4. Fetch balances for a list of accounts
export async function getAccountBalancesAction(publicKeys: string[]) {
  try {
    const isMock = process.env.STELLAR_MOCK !== 'false';
    const horizonUrl = process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org';
    const server = new StellarSdk.Horizon.Server(horizonUrl);

    const usdcCode = process.env.STELLAR_USDC_ASSET_CODE || 'USDC';
    const usdcIssuer = process.env.STELLAR_USDC_ASSET_ISSUER || 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

    const usdtCode = 'USDT';
    const usdtIssuer = '';

    const balancesList = await Promise.all(
      publicKeys.map(async (publicKey) => {
        let xlm = '0.0000';
        let usdt = '0.0000';
        let usdc = '0.0000';

        if (isMock) {
          // In mock mode, fetch simulated transactions to sum balance
          const walletRecord = await db.query.wallets.findFirst({
            where: eq(wallets.publicKey, publicKey),
          });
          if (walletRecord) {
            const mockTxs = await db.query.blockchainTransactions.findMany({
              where: eq(blockchainTransactions.walletId, walletRecord.id),
            });
            mockTxs.forEach((tx) => {
              const amount = parseFloat(tx.amount);
              if (tx.assetCode === usdtCode) usdt = (parseFloat(usdt) + amount).toFixed(4);
              if (tx.assetCode === usdcCode) usdc = (parseFloat(usdc) + amount).toFixed(4);
            });
            xlm = '10000.0000';
          } else {
            // Check if it belongs to a test user (owner or tenant)
            const isOwner = await db.query.owners.findFirst({
              where: eq(ownersTable.stellarPublicKey, publicKey),
            });
            const isTenant = await db.query.tenants.findFirst({
              where: eq(tenantsTable.stellarPublicKey, publicKey),
            });

            if (isOwner || isTenant) {
              const mockBalances = await getMockBalancesMap();
              const userBal = mockBalances[publicKey] || { xlm: '10000.0000', usdc: '0.0000', usdt: '0.0000' };
              xlm = userBal.xlm;
              usdc = userBal.usdc;
              usdt = userBal.usdt;
            } else {
              xlm = '10000.0000'; // Default fallback
            }
          }
        } else {
          try {
            const accountInfo = await server.loadAccount(publicKey);
            accountInfo.balances.forEach((bal) => {
              if (bal.asset_type === 'native') {
                xlm = parseFloat(bal.balance).toFixed(4);
              } else if ('asset_code' in bal && 'asset_issuer' in bal) {
                const code = bal.asset_code;
                const issuer = bal.asset_issuer;
                if (code === usdtCode && issuer === usdtIssuer) {
                  usdt = parseFloat(bal.balance).toFixed(4);
                } else if (code === usdcCode && issuer === usdcIssuer) {
                  usdc = parseFloat(bal.balance).toFixed(4);
                }
              }
            });
          } catch {
            // Account not found on-chain yet
            xlm = '0.0000';
          }
        }

        return {
          publicKey,
          xlmBalance: xlm,
          usdtBalance: usdt,
          usdcBalance: usdc,
        };
      })
    );

    return { success: true, balances: balancesList };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch balances',
    };
  }
}

// 5. Fund derived account with XLM (Friendbot) and USDC/USDT programmatically
export async function fundAccountAction(
  derivedPublicKey: string,
  masterSecretKeyInput: string | undefined,
  assetType: 'USDC' | 'USDT',
  amountStr = '100.0000'
) {
  try {
    const isMock = process.env.STELLAR_MOCK !== 'false';

    // A. Check if the input key is directly the secret key for the target account
    let derivedSecretKey = '';
    if (masterSecretKeyInput) {
      try {
        const kp = StellarSdk.Keypair.fromSecret(masterSecretKeyInput);
        if (kp.publicKey() === derivedPublicKey) {
          derivedSecretKey = masterSecretKeyInput;
        }
      } catch {
        // Not a direct secret key match
      }
    }

    // B. If not resolved and we are not in mock mode, try to derive it from master keys (for pool accounts)
    // Note: in mock mode we don't need the secret key to fund
    if (!derivedSecretKey && !isMock) {
      const masterSecretKey = await resolveMasterSecretKey(masterSecretKeyInput);
      if (masterSecretKey) {
        for (let i = 0; i < 20; i++) {
          const seed = crypto
            .createHash('sha256')
            .update(masterSecretKey + '_' + i)
            .digest();
          const kp = StellarSdk.Keypair.fromRawEd25519Seed(seed);
          if (kp.publicKey() === derivedPublicKey) {
            derivedSecretKey = kp.secret();
            break;
          }
        }
      }
    }

    // In real mode, we absolutely need the secret key to establish the trustline
    if (!derivedSecretKey && !isMock) {
      throw new Error('Derived account secret key could not be recovered');
    }

    // Check if the account is in the wallets table
    const walletRecord = await db.query.wallets.findFirst({
      where: eq(wallets.publicKey, derivedPublicKey),
    });

    if (isMock) {
      const txHash = 'mock_tx_' + crypto.randomBytes(16).toString('hex');
      const mockSourceAddress = process.env.STELLAR_USDC_ASSET_ISSUER || 'mock_usdc_issuer';
      
      if (walletRecord) {
        // Pool account: insert into blockchain transactions
        const mockCursor = (Date.now() * 1000).toString();
        await db.insert(blockchainTransactions).values({
          walletId: walletRecord.id,
          txHash,
          amount: amountStr,
          assetCode: assetType,
          fromAddress: mockSourceAddress,
          toAddress: derivedPublicKey,
          ledgerCursor: mockCursor,
        });
      } else {
        // User account: check if it's owner/tenant, and save mock balance in systemConfigs
        const isOwner = await db.query.owners.findFirst({
          where: eq(ownersTable.stellarPublicKey, derivedPublicKey),
        });
        const isTenant = await db.query.tenants.findFirst({
          where: eq(tenantsTable.stellarPublicKey, derivedPublicKey),
        });

        if (isOwner || isTenant) {
          const mockBalances = await getMockBalancesMap();
          const userBal = mockBalances[derivedPublicKey] || { xlm: '10000.0000', usdc: '0.0000', usdt: '0.0000' };
          
          if (assetType === 'USDC') {
            userBal.usdc = (parseFloat(userBal.usdc) + parseFloat(amountStr)).toFixed(4);
          } else {
            userBal.usdt = (parseFloat(userBal.usdt) + parseFloat(amountStr)).toFixed(4);
          }
          mockBalances[derivedPublicKey] = userBal;
          await saveMockBalancesMap(mockBalances);
        } else {
          throw new Error('Account is not registered in the database');
        }
      }

      console.log(`Simulated funding of ${amountStr} ${assetType} to ${derivedPublicKey}`);
      revalidatePath('/testnet');
      return { success: true, txHash };
    }

    // REAL TESTNET FUNDING
    const horizonUrl = process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org';
    const server = new StellarSdk.Horizon.Server(horizonUrl);
    const networkPassphrase = StellarSdk.Networks.TESTNET;

    // A. Friendbot funding for derived account
    console.log(`Funding derived account ${derivedPublicKey} with XLM via Friendbot...`);
    try {
      const friendbotRes = await fetch(`https://friendbot.stellar.org/?addr=${derivedPublicKey}`);
      if (!friendbotRes.ok) {
        throw new Error('Friendbot returned error response');
      }
      await friendbotRes.json();
    } catch (err) {
      console.warn('Friendbot funding warning, account might already be active:', err);
    }

    // Load derived account to verify
    const derivedKeypair = StellarSdk.Keypair.fromSecret(derivedSecretKey);
    const derivedAcc = await server.loadAccount(derivedPublicKey);

    // B. Establish Trustline
    const { code: targetAssetCode, issuer: targetAssetIssuer } = getAssetDescriptor(assetType);
    const asset = new StellarSdk.Asset(targetAssetCode, targetAssetIssuer);

    const hasTrustline = derivedAcc.balances.some(
      (b) => b.asset_type !== 'native' && 'asset_code' in b && b.asset_code === targetAssetCode && 'asset_issuer' in b && b.asset_issuer === targetAssetIssuer
    );

    if (!hasTrustline) {
      console.log(`Creating trustline for ${targetAssetCode} on ${derivedPublicKey}...`);
      const tx = new StellarSdk.TransactionBuilder(derivedAcc, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase,
      })
        .addOperation(
          StellarSdk.Operation.changeTrust({
            asset,
          })
        )
        .setTimeout(30)
        .build();

      tx.sign(derivedKeypair);
      await server.submitTransaction(tx);
    }

    // C. Fund asset
    if (assetType === 'USDT') {
      const result = await issueUsdtFromIssuer(derivedPublicKey, amountStr, masterSecretKeyInput);
      revalidatePath('/testnet');
      return { success: true, txHash: result.txHash };
    }

    // USDC path stays DEX-based because treasury is not the issuer.
    console.log(`Performing path payment strict receive for ${amountStr} ${targetAssetCode} on ${derivedPublicKey}...`);
    const payTx = new StellarSdk.TransactionBuilder(derivedAcc, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase,
    })
      .addOperation(
        StellarSdk.Operation.pathPaymentStrictReceive({
          sendAsset: StellarSdk.Asset.native(),
          sendMax: '1000', // max XLM to spend
          destination: derivedPublicKey,
          destAsset: asset,
          destAmount: amountStr,
          path: [], // direct swap on the DEX
        })
      )
      .setTimeout(30)
      .build();

    payTx.sign(derivedKeypair);
    const result = await server.submitTransaction(payTx);
    revalidatePath('/testnet');
    return { success: true, txHash: result.hash };
  } catch (error: unknown) {
    console.error('Programmatic funding failed:', error);
    const horizonError = (error as { response?: { data?: { detail?: string; extras?: { result_codes?: unknown } } } }).response?.data;
    if (horizonError) {
      console.error('Horizon error details:', JSON.stringify(horizonError, null, 2));
      const resultCodes = horizonError.extras?.result_codes;
      const codesStr = resultCodes ? JSON.stringify(resultCodes) : '';
      return {
        success: false,
        error: `Stellar transaction failed: ${horizonError.detail || 'Unknown error'}. Codes: ${codesStr}`.trim(),
      };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Funding failed',
    };
  }
}

// 6. Fund the developer master account with USDC/USDT from Treasury
export async function fundMasterAccountAction(
  masterPublicKey: string,
  masterSecretKeyInput: string | undefined,
  assetType: 'USDC' | 'USDT',
  amountStr = '100.0000'
) {
  try {
    const isMock = process.env.STELLAR_MOCK !== 'false';
    if (isMock) {
      return { success: true, txHash: 'mock_master_funding_hash' };
    }

    const horizonUrl = process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org';
    const server = new StellarSdk.Horizon.Server(horizonUrl);
    const networkPassphrase = StellarSdk.Networks.TESTNET;

    // A. Friendbot funding for master account
    try {
      await fetch(`https://friendbot.stellar.org/?addr=${masterPublicKey}`);
    } catch {
      // ignore
    }

    // B. Setup target asset
    const { code: targetAssetCode, issuer: targetAssetIssuer } = getAssetDescriptor(assetType);
    const asset = new StellarSdk.Asset(targetAssetCode, targetAssetIssuer);

    // C. Fund asset
    const masterSecretKey = await resolveMasterSecretKey(masterSecretKeyInput);
    if (!masterSecretKey) {
      throw new Error('Secret key is required to fund the master account.');
    }

    const masterKeypair = StellarSdk.Keypair.fromSecret(masterSecretKey);
    const masterAcc = await server.loadAccount(masterPublicKey);

    const hasTrustline = masterAcc.balances.some(
      (b) => b.asset_type !== 'native' && 'asset_code' in b && b.asset_code === targetAssetCode && 'asset_issuer' in b && b.asset_issuer === targetAssetIssuer
    );

    if (!hasTrustline) {
      console.log(`Creating trustline for ${targetAssetCode} on Master ${masterPublicKey}...`);
      const trustTx = new StellarSdk.TransactionBuilder(masterAcc, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase,
      })
        .addOperation(
          StellarSdk.Operation.changeTrust({
            asset,
          })
        )
        .setTimeout(30)
        .build();

      trustTx.sign(masterKeypair);
      await server.submitTransaction(trustTx);
    }

    if (assetType === 'USDT') {
      const result = await issueUsdtFromIssuer(masterPublicKey, amountStr, masterSecretKeyInput);
      return { success: true, txHash: result.txHash };
    }

    // Re-load account to get correct sequence number for path payment
    const masterAccReloaded = await server.loadAccount(masterPublicKey);

    console.log(`Performing path payment strict receive for ${amountStr} ${targetAssetCode} on Master ${masterPublicKey}...`);
    const payTx = new StellarSdk.TransactionBuilder(masterAccReloaded, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase,
    })
      .addOperation(
        StellarSdk.Operation.pathPaymentStrictReceive({
          sendAsset: StellarSdk.Asset.native(),
          sendMax: '1000', // max XLM to spend
          destination: masterPublicKey,
          destAsset: asset,
          destAmount: amountStr,
          path: [], // direct swap on the DEX
        })
      )
      .setTimeout(30)
      .build();

    payTx.sign(masterKeypair);
    const result = await server.submitTransaction(payTx);
    return { success: true, txHash: result.hash };
  } catch (error: unknown) {
    console.error('Master funding failed:', error);
    const horizonError = (error as { response?: { data?: { detail?: string; extras?: { result_codes?: unknown } } } }).response?.data;
    if (horizonError) {
      console.error('Horizon error details:', JSON.stringify(horizonError, null, 2));
      const resultCodes = horizonError.extras?.result_codes;
      const codesStr = resultCodes ? JSON.stringify(resultCodes) : '';
      return {
        success: false,
        error: `Stellar transaction failed: ${horizonError.detail || 'Unknown error'}. Codes: ${codesStr}`.trim(),
      };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Master funding failed',
    };
  }
}

export async function getTreasuryStatusAction() {
  try {
    const treasuryPublicKey = process.env.STELLAR_TREASURY_PUBLIC_KEY || '';
    const treasurySecretKey = process.env.STELLAR_TREASURY_SECRET_KEY || '';
    const usdcIssuer = process.env.STELLAR_USDC_ASSET_ISSUER || '';

    if (!treasuryPublicKey) {
      return { success: false, error: 'STELLAR_TREASURY_PUBLIC_KEY is not configured.' };
    }

    const balancesResult = await getAccountBalancesAction([treasuryPublicKey]);
    if (!balancesResult.success || !balancesResult.balances?.[0]) {
      return { success: false, error: balancesResult.error || 'Could not load treasury balances.' };
    }

    return {
      success: true,
      treasury: {
        publicKey: treasuryPublicKey,
        hasSecretKey: Boolean(treasurySecretKey),
        isIssuerForUsdt: treasuryPublicKey === usdcIssuer,
        issuerPublicKey: usdcIssuer,
        explorerUrl: `${getExplorerBaseUrl()}${treasuryPublicKey}`,
        balances: balancesResult.balances[0],
      },
    };
  } catch (error) {
    console.error('Failed to get treasury status:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get treasury status',
    };
  }
}

export async function activateTreasuryAccountAction() {
  try {
    const treasuryPublicKey = process.env.STELLAR_TREASURY_PUBLIC_KEY || '';

    if (!treasuryPublicKey) {
      throw new Error('STELLAR_TREASURY_PUBLIC_KEY is not configured.');
    }

    if (process.env.STELLAR_MOCK !== 'false') {
      return { success: true, txHash: 'mock_treasury_friendbot' };
    }

    await ensureFriendbotFunding(treasuryPublicKey);
    revalidatePath('/testnet');
    return { success: true };
  } catch (error) {
    console.error('Failed to activate treasury account:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to activate treasury account',
    };
  }
}

export async function createTreasuryTrustlineAction(assetType: 'USDC' | 'USDT') {
  try {
    const treasuryPublicKey = process.env.STELLAR_TREASURY_PUBLIC_KEY || '';
    const treasurySecretKey = process.env.STELLAR_TREASURY_SECRET_KEY || '';

    if (!treasuryPublicKey || !treasurySecretKey) {
      throw new Error('Treasury public and secret keys must be configured.');
    }

    const { issuer } = getAssetDescriptor(assetType);

    if (assetType === 'USDT' && issuer === treasuryPublicKey) {
      return {
        success: true,
        skipped: true,
        message: 'The treasury account is the current USDT issuer, so it cannot create a trustline to its own asset. Configure a separate treasury account to hold USDT.',
      };
    }

    if (process.env.STELLAR_MOCK !== 'false') {
      return {
        success: true,
        txHash: `mock_treasury_trustline_${assetType.toLowerCase()}`,
      };
    }

    const horizonUrl = process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org';
    const server = new StellarSdk.Horizon.Server(horizonUrl);
    await ensureFriendbotFunding(treasuryPublicKey);
    const result = await ensureAssetTrustline(server, treasuryPublicKey, treasurySecretKey, assetType);
    revalidatePath('/testnet');
    return {
      success: true,
      txHash: result.txHash,
      created: result.created,
    };
  } catch (error) {
    console.error('Failed to create treasury trustline:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create treasury trustline',
    };
  }
}

export async function fundTreasuryAssetAction(assetType: 'USDC' | 'USDT', amountStr = '100.0000') {
  try {
    const treasuryPublicKey = process.env.STELLAR_TREASURY_PUBLIC_KEY || '';
    const treasurySecretKey = process.env.STELLAR_TREASURY_SECRET_KEY || '';

    if (!treasuryPublicKey || !treasurySecretKey) {
      throw new Error('Treasury public and secret keys must be configured.');
    }

    const { issuer } = getAssetDescriptor(assetType);
    if (assetType === 'USDT' && issuer === treasuryPublicKey) {
      throw new Error('The treasury account is currently acting as the USDT issuer, so it cannot hold its own USDT balance. Configure a separate treasury account first.');
    }

    const result = await fundAccountAction(treasuryPublicKey, treasurySecretKey, assetType, amountStr);
    revalidatePath('/testnet');
    return result;
  } catch (error) {
    console.error('Failed to fund treasury asset:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fund treasury asset',
    };
  }
}

export async function getConfiguredAccountsAction() {
  try {
    const accountsMap = new Map<string, ConfiguredSystemAccount>();

    const treasuryPublicKey = process.env.STELLAR_TREASURY_PUBLIC_KEY;
    if (treasuryPublicKey) {
      accountsMap.set(treasuryPublicKey, {
        publicKey: treasuryPublicKey,
        label: 'Treasury Account',
        category: 'treasury',
      });
    }

    const masterPublicKey = await resolveMasterPublicKey(undefined);
    if (masterPublicKey) {
      accountsMap.set(masterPublicKey, {
        publicKey: masterPublicKey,
        label: 'Developer Master Account',
        category: 'master',
      });
    }

    const usdcIssuerPublicKey = process.env.STELLAR_USDC_ASSET_ISSUER;
    if (usdcIssuerPublicKey) {
      const existingAccount = accountsMap.get(usdcIssuerPublicKey);
      accountsMap.set(usdcIssuerPublicKey, {
        publicKey: usdcIssuerPublicKey,
        label:
          existingAccount?.category === 'master'
            ? 'USDC Issuer Account (Developer Master)'
            : existingAccount?.category === 'treasury'
              ? 'USDC Issuer Account (Treasury)'
              : 'USDC Issuer Account',
        category: existingAccount?.category === 'master' || existingAccount?.category === 'treasury'
          ? existingAccount.category
          : 'issuer',
      });
    }

    const allWallets = await db.select().from(wallets);
    allWallets.forEach((wallet, index) => {
      accountsMap.set(wallet.publicKey, {
        publicKey: wallet.publicKey,
        label: `Pool Account ${index + 1}`,
        category: 'pool',
      });
    });

    const owners = await db.query.owners.findMany({
      with: {
        user: true,
      },
    });

    owners.forEach((owner) => {
      accountsMap.set(owner.stellarPublicKey, {
        publicKey: owner.stellarPublicKey,
        label: `Host: ${owner.user.name}`,
        category: 'owner',
      });
    });

    const tenants = await db.query.tenants.findMany({
      with: {
        user: true,
      },
    });

    tenants.forEach((tenant) => {
      accountsMap.set(tenant.stellarPublicKey, {
        publicKey: tenant.stellarPublicKey,
        label: `Guest: ${tenant.user.name}`,
        category: 'tenant',
      });
    });

    return {
      success: true,
      accounts: Array.from(accountsMap.values()),
    };
  } catch (error) {
    console.error('Failed to load configured accounts:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load configured accounts',
    };
  }
}

export async function transferBetweenConfiguredAccountsAction(formData: {
  sourcePublicKey: string;
  destinationPublicKey: string;
  assetType: 'USDC' | 'USDT';
  amountStr: string;
  masterSecretKeyInput?: string;
}) {
  try {
    const { sourcePublicKey, destinationPublicKey, assetType, amountStr, masterSecretKeyInput } = formData;

    if (!sourcePublicKey || !destinationPublicKey || !assetType || !amountStr) {
      throw new Error('Source, destination, asset, and amount are required.');
    }

    if (sourcePublicKey === destinationPublicKey) {
      throw new Error('Source and destination accounts must be different.');
    }

    if (process.env.STELLAR_MOCK !== 'false') {
      return {
        success: false,
        error: 'Transfers between configured accounts are only available when STELLAR_MOCK=false.',
      };
    }

    const { code, issuer } = getAssetDescriptor(assetType);
    const sourceSecretKey = await resolveConfiguredAccountSecret(sourcePublicKey, masterSecretKeyInput);

    if (!sourceSecretKey) {
      throw new Error('Could not resolve the secret key for the selected source account.');
    }

    const sourceKeypair = StellarSdk.Keypair.fromSecret(sourceSecretKey);
    if (sourceKeypair.publicKey() !== sourcePublicKey) {
      throw new Error('Resolved secret key does not match the selected source account.');
    }

    if (assetType === 'USDT' && issuer === destinationPublicKey) {
      throw new Error('The issuer account cannot receive its own USDT asset through a trustline transfer.');
    }

    const horizonUrl = process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org';
    const server = new StellarSdk.Horizon.Server(horizonUrl);
    const networkPassphrase = StellarSdk.Networks.TESTNET;

    await ensureFriendbotFunding(destinationPublicKey);
    const destinationSecretKey = await resolveConfiguredAccountSecret(destinationPublicKey, masterSecretKeyInput);

    if (!destinationSecretKey) {
      throw new Error('Could not resolve the secret key for the selected destination account, so the trustline cannot be prepared automatically.');
    }

    await ensureAssetTrustline(server, destinationPublicKey, destinationSecretKey, assetType);

    const sourceAccount = await server.loadAccount(sourcePublicKey);
    const asset = new StellarSdk.Asset(code, issuer);
    const transferTx = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase,
    })
      .addOperation(
        StellarSdk.Operation.payment({
          destination: destinationPublicKey,
          asset,
          amount: amountStr,
        })
      )
      .setTimeout(30)
      .build();

    transferTx.sign(sourceKeypair);
    const result = await server.submitTransaction(transferTx);
    revalidatePath('/testnet');
    return {
      success: true,
      txHash: result.hash,
    };
  } catch (error: unknown) {
    console.error('Configured account transfer failed:', error);
    const horizonError = (error as { response?: { data?: { detail?: string; extras?: { result_codes?: unknown } } } }).response?.data;
    if (horizonError) {
      const resultCodes = horizonError.extras?.result_codes;
      return {
        success: false,
        error: `Stellar transaction failed: ${horizonError.detail || 'Unknown error'}. Codes: ${resultCodes ? JSON.stringify(resultCodes) : ''}`.trim(),
      };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Configured account transfer failed',
    };
  }
}

// 7. Get seeded test users with their owner/tenant status, public keys and secret keys from database
export async function getTestUsersAction() {
  try {
    const allUsers = await db.select().from(usersTable);
    const results = [];

    for (const u of allUsers) {
      const ownerRecord = await db.select().from(ownersTable).where(eq(ownersTable.userId, u.id)).limit(1);
      const tenantRecord = await db.select().from(tenantsTable).where(eq(tenantsTable.userId, u.id)).limit(1);

      const ownerPub = ownerRecord[0]?.stellarPublicKey || null;
      const tenantPub = tenantRecord[0]?.stellarPublicKey || null;

      let ownerSec = null;
      let tenantSec = null;

      if (ownerPub) {
        const ownerSecConf = await db.query.systemConfigs.findFirst({
          where: eq(systemConfigs.key, `test_user_secret_${ownerPub}`),
        });
        if (ownerSecConf) {
          ownerSec = ownerSecConf.value;
        }
      }

      if (tenantPub) {
        const tenantSecConf = await db.query.systemConfigs.findFirst({
          where: eq(systemConfigs.key, `test_user_secret_${tenantPub}`),
        });
        if (tenantSecConf) {
          tenantSec = tenantSecConf.value;
        }
      }

      results.push({
        userId: u.id,
        name: u.name,
        email: u.email,
        ownerId: ownerRecord[0]?.id || null,
        tenantId: tenantRecord[0]?.id || null,
        ownerPublicKey: ownerPub,
        ownerSecretKey: ownerSec,
        tenantPublicKey: tenantPub,
        tenantSecretKey: tenantSec,
      });
    }

    return { success: true, users: results };
  } catch (error) {
    console.error('Failed to get test users:', error);
    return { success: false, error: 'Failed to fetch test users' };
  }
}

// 8. Update a test user's owner or tenant stellar public key and secret key in the database
export async function updateUserPublicKeyAction(
  userId: string,
  type: 'owner' | 'tenant',
  newPublicKey: string,
  secretKey?: string
) {
  try {
    if (type === 'owner') {
      await db.update(ownersTable).set({ stellarPublicKey: newPublicKey }).where(eq(ownersTable.userId, userId));
    } else {
      await db.update(tenantsTable).set({ stellarPublicKey: newPublicKey }).where(eq(tenantsTable.userId, userId));
    }

    if (secretKey) {
      const configKey = `test_user_secret_${newPublicKey}`;
      const existing = await db.query.systemConfigs.findFirst({
        where: eq(systemConfigs.key, configKey),
      });

      if (existing) {
        await db
          .update(systemConfigs)
          .set({
            value: secretKey,
            updatedAt: new Date(),
          })
          .where(eq(systemConfigs.key, configKey));
      } else {
        await db.insert(systemConfigs).values({
          key: configKey,
          value: secretKey,
        });
      }
    }

    revalidatePath('/testnet');
    return { success: true };
  } catch (error) {
    console.error('Failed to update public key:', error);
    return { success: false, error: 'Failed to update public key' };
  }
}

// 9. Get all derived public keys from the wallets table
export async function getDerivedAccountsAction() {
  try {
    const allWallets = await db.select().from(wallets);
    const results = allWallets.map((w) => w.publicKey);
    return { success: true, accounts: results };
  } catch (error) {
    console.error('Failed to get derived accounts:', error);
    return { success: false, error: 'Failed to fetch derived accounts' };
  }
}

// 10. Clear master keys from the database configs
export async function clearMasterKeysAction() {
  try {
    await db.delete(systemConfigs).where(eq(systemConfigs.key, 'stellar_dev_keys'));
    revalidatePath('/testnet');
    return { success: true };
  } catch (error) {
    console.error('Failed to clear master keys:', error);
    return { success: false, error: 'Failed to clear master keys' };
  }
}

// 11. Save master keys to database
export async function saveMasterKeysAction(publicKey: string, secretKey: string) {
  try {
    await saveMasterKeysInDb(publicKey, secretKey);
    revalidatePath('/testnet');
    return { success: true };
  } catch (error) {
    console.error('Failed to save master keys:', error);
    return { success: false, error: 'Failed to save master keys' };
  }
}
