'use client';

import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Table, Chip, Alert } from '@heroui/react';
import * as StellarSdk from '@stellar/stellar-sdk';
import {
  Key,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
  DollarSign,
  Lock,
  Layers,
  Sparkles,
  Users,
} from 'lucide-react';
import {
  getMasterKeysConfig,
  generateMasterKeys,
  createDerivedAccountsAction,
  getAccountBalancesAction,
  fundAccountAction,
  fundMasterAccountAction,
  getTestUsersAction,
  updateUserPublicKeyAction,
  getDerivedAccountsAction,
  clearMasterKeysAction,
  saveMasterKeysAction,
  getTreasuryStatusAction,
  activateTreasuryAccountAction,
  createTreasuryTrustlineAction,
  fundTreasuryAssetAction,
  getConfiguredAccountsAction,
  transferBetweenConfiguredAccountsAction,
} from '@/application/actions/testnet';

interface AccountRow {
  publicKey: string;
  status: string;
  xlmBalance: string;
  usdcBalance: string;
  usdtBalance: string;
}

interface TreasuryStatus {
  publicKey: string;
  hasSecretKey: boolean;
  isIssuerForUsdt: boolean;
  issuerPublicKey: string;
  explorerUrl: string;
  balances: {
    publicKey: string;
    xlmBalance: string;
    usdcBalance: string;
    usdtBalance: string;
  };
}

interface ConfiguredAccountOption {
  publicKey: string;
  label: string;
  category: 'treasury' | 'master' | 'issuer' | 'pool' | 'owner' | 'tenant';
}

interface TestUserRecord {
  userId: string;
  name: string;
  email: string;
  ownerId: string | null;
  tenantId: string | null;
  ownerPublicKey: string | null;
  ownerSecretKey: string | null;
  tenantPublicKey: string | null;
  tenantSecretKey: string | null;
}

export default function TestnetSetupPage() {
  // Key state
  const [masterPublicKey, setMasterPublicKey] = useState<string>('');
  const [masterSecretKey, setMasterSecretKey] = useState<string>('');
  const [isEnvConfigured, setIsEnvConfigured] = useState<boolean>(false);
  const [isGeneratingKeys, setIsGeneratingKeys] = useState<boolean>(false);
  const [keyError, setKeyError] = useState<string>('');
  const [isMockMode, setIsMockMode] = useState<boolean>(true);

  // Account derivation state
  const [deriveCount, setDeriveCount] = useState<number>(5);
  const [isDeriving, setIsDeriving] = useState<boolean>(false);
  const [derivedAccounts, setDerivedAccounts] = useState<string[]>([]);

  // Accounts list state
  const [accountsData, setAccountsData] = useState<AccountRow[]>([]);
  const [isLoadingBalances, setIsLoadingBalances] = useState<boolean>(false);

  // Funding status state
  const [fundingAccount, setFundingAccount] = useState<string | null>(null);
  const [fundingAsset, setFundingAsset] = useState<'USDC' | 'USDT' | null>(null);
  const [fundingMessage, setFundingMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Test users state
  const [testUsers, setTestUsers] = useState<TestUserRecord[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(false);
  const [userBalances, setUserBalances] = useState<Record<string, { xlm: string; usdc: string; usdt: string }>>({});
  const [treasuryStatus, setTreasuryStatus] = useState<TreasuryStatus | null>(null);
  const [isLoadingTreasury, setIsLoadingTreasury] = useState<boolean>(false);
  const [configuredAccounts, setConfiguredAccounts] = useState<ConfiguredAccountOption[]>([]);
  const [transferSource, setTransferSource] = useState<string>('');
  const [transferDestination, setTransferDestination] = useState<string>('');
  const [transferAsset, setTransferAsset] = useState<'USDC' | 'USDT'>('USDT');
  const [transferAmount, setTransferAmount] = useState<string>('10.0000');
  const [isTransferring, setIsTransferring] = useState<boolean>(false);
  const [treasuryAction, setTreasuryAction] = useState<string | null>(null);

  // Fetch balances for derived accounts
  async function fetchBalances(pubKeys: string[]) {
    if (pubKeys.length === 0) return;
    setIsLoadingBalances(true);
    try {
      const res = await getAccountBalancesAction(pubKeys);
      if (res.success && res.balances) {
        const updatedRows = res.balances.map((b) => ({
          publicKey: b.publicKey,
          status: 'available', // derived accounts are pool accounts
          xlmBalance: b.xlmBalance,
          usdcBalance: b.usdcBalance,
          usdtBalance: b.usdtBalance,
        }));
        setAccountsData(updatedRows);
      }
    } catch (err) {
      console.error('Error fetching balances:', err);
    } finally {
      setIsLoadingBalances(false);
    }
  }

  // Fetch balances for test users
  async function fetchUserBalances(usersList: TestUserRecord[]) {
    const keys: string[] = [];
    usersList.forEach((u) => {
      if (u.ownerPublicKey) keys.push(u.ownerPublicKey);
      if (u.tenantPublicKey) keys.push(u.tenantPublicKey);
    });

    if (keys.length === 0) return;

    try {
      const res = await getAccountBalancesAction(keys);
      if (res.success && res.balances) {
        const balancesMap: Record<string, { xlm: string; usdc: string; usdt: string }> = {};
        res.balances.forEach((b) => {
          balancesMap[b.publicKey] = {
            xlm: b.xlmBalance,
            usdc: b.usdcBalance,
            usdt: b.usdtBalance,
          };
        });
        setUserBalances((prev) => ({ ...prev, ...balancesMap }));
      }
    } catch (err) {
      console.error('Failed to fetch user balances:', err);
    }
  }

  async function fetchTreasuryStatus() {
    setIsLoadingTreasury(true);
    try {
      const result = await getTreasuryStatusAction();
      if (result.success && result.treasury) {
        setTreasuryStatus(result.treasury);
      }
    } catch (err) {
      console.error('Failed to fetch treasury status:', err);
    } finally {
      setIsLoadingTreasury(false);
    }
  }

  async function fetchConfiguredAccounts() {
    try {
      const result = await getConfiguredAccountsAction();
      if (result.success && result.accounts) {
        setConfiguredAccounts(result.accounts);
        setTransferSource((current) => current || result.accounts[0]?.publicKey || '');
        setTransferDestination((current) => {
          if (current) return current;
          const fallback = result.accounts.find((account) => account.publicKey !== result.accounts[0]?.publicKey);
          return fallback?.publicKey || '';
        });
      }
    } catch (err) {
      console.error('Failed to fetch configured accounts:', err);
    }
  }

  // Load configuration on mount
  useEffect(() => {
    async function loadConfig() {
      try {
        const config = await getMasterKeysConfig();
        setIsMockMode(config.isMock);
        if (config.isConfigured && config.publicKey) {
          setMasterPublicKey(config.publicKey);
          setMasterSecretKey(config.secretKey || '••••••••••••••••••••••••••••••••••••••••••••••••••••');
          setIsEnvConfigured(!!config.secretKey && config.secretKey === process.env.STELLAR_DEV_SECRET_KEY);
        }

        const walletsRes = await getDerivedAccountsAction();
        if (walletsRes.success && walletsRes.accounts) {
          setDerivedAccounts(walletsRes.accounts);
          await fetchBalances(walletsRes.accounts);
        }

        setIsLoadingUsers(true);
        const usersRes = await getTestUsersAction();
        if (usersRes.success && usersRes.users) {
          setTestUsers(usersRes.users);
          await fetchUserBalances(usersRes.users);
        }
        await fetchTreasuryStatus();
        await fetchConfiguredAccounts();
        setIsLoadingUsers(false);
      } catch (err) {
        console.error('Failed to load config:', err);
        setIsLoadingUsers(false);
      }
    }
    void loadConfig();
  }, []);

  // Generate public and secret keys for test user
  const handleGenerateUserKeys = async (userId: string, type: 'owner' | 'tenant') => {
    try {
      const pair = StellarSdk.Keypair.random();
      const pubKey = pair.publicKey();
      const secKey = pair.secret();

      // Save keys in DB
      const res = await updateUserPublicKeyAction(userId, type, pubKey, secKey);
      if (res.success) {
        alert(`Successfully generated and registered keys for test user!\nPublic Key: ${pubKey}`);
        
        // Refresh users list
        const usersRes = await getTestUsersAction();
        if (usersRes.success && usersRes.users) {
          setTestUsers(usersRes.users);
          fetchUserBalances(usersRes.users);
        }
        fetchConfiguredAccounts();
      } else {
        alert(`Failed to save keys in database: ${res.error}`);
      }
    } catch (err) {
      alert('Error generating keys: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  // Fund test user account
  const handleFundUserAccount = async (publicKey: string, secretKey: string, asset: 'USDC' | 'USDT') => {
    setFundingAccount(publicKey);
    setFundingAsset(asset);
    setFundingMessage(null);

    try {
      const res = await fundAccountAction(
        publicKey,
        secretKey || undefined,
        asset,
        '100.0000'
      );

      if (res.success) {
        alert(`Successfully funded 100.0000 ${asset}!`);
        // Refresh balances
        const usersRes = await getTestUsersAction();
        if (usersRes.success && usersRes.users) {
          fetchUserBalances(usersRes.users);
        }
        fetchConfiguredAccounts();
      } else {
        alert(`Funding failed: ${res.error || 'Unknown error'}`);
      }
    } catch (err) {
      alert('Error funding test user: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setFundingAccount(null);
      setFundingAsset(null);
    }
  };

  // Generate new keys
  const handleGenerateKeys = async () => {
    setIsGeneratingKeys(true);
    setKeyError('');
    try {
      const keys = await generateMasterKeys();
      setMasterPublicKey(keys.publicKey);
      setMasterSecretKey(keys.secretKey);
    } catch (err) {
      setKeyError(err instanceof Error ? err.message : 'Failed to generate keys');
    } finally {
      setIsGeneratingKeys(false);
    }
  };

  // Fund Master Account with XLM via Friendbot
  const handleFundMaster = async () => {
    if (!masterPublicKey) return;
    setIsGeneratingKeys(true);
    try {
      const res = await fetch(`https://friendbot.stellar.org/?addr=${masterPublicKey}`);
      if (res.ok) {
        alert('Master Account successfully funded on Testnet!');
      } else {
        alert('Friendbot request failed. Account might already be active or Friendbot is down.');
      }
    } catch (err) {
      alert('Error requesting Friendbot: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsGeneratingKeys(false);
    }
  };

  const [isFundingMasterAsset, setIsFundingMasterAsset] = useState<'USDC' | 'USDT' | null>(null);

  const handleFundMasterAsset = async (asset: 'USDC' | 'USDT') => {
    if (!masterPublicKey) return;
    setIsFundingMasterAsset(asset);
    try {
      const res = await fundMasterAccountAction(
        masterPublicKey,
        isEnvConfigured ? undefined : masterSecretKey,
        asset,
        '100.0000'
      );
      if (res.success) {
        alert(`Master Account successfully funded with 100.0000 ${asset}!`);
        fetchConfiguredAccounts();
      } else {
        alert(`Funding failed: ${res.error || 'Unknown error'}`);
      }
    } catch (err) {
      alert('Error: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsFundingMasterAsset(null);
    }
  };

  // Clear keys from database
  const handleClearKeys = async () => {
    if (confirm('Are you sure you want to clear the master keys from the database?')) {
      const res = await clearMasterKeysAction();
      if (res.success) {
        setMasterPublicKey('');
        setMasterSecretKey('');
        setDerivedAccounts([]);
        setAccountsData([]);
      } else {
        alert('Failed to clear keys: ' + res.error);
      }
    }
  };

  // Derive and register N accounts
  const handleDeriveAccounts = async () => {
    if (!masterPublicKey) {
      alert('Please set or generate master keys first');
      return;
    }
    setIsDeriving(true);
    try {
      const res = await createDerivedAccountsAction(
        masterPublicKey,
        isEnvConfigured ? undefined : masterSecretKey,
        deriveCount
      );

      if (res.success && res.accounts) {
        setDerivedAccounts(res.accounts);
        await fetchBalances(res.accounts);
        await fetchConfiguredAccounts();
      } else {
        alert('Failed to create derived accounts: ' + (res.error || 'Unknown error'));
      }
    } catch (err) {
      alert('Error: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsDeriving(false);
    }
  };

  // Fund individual account with USDC/USDT
  const handleFundAccount = async (publicKey: string, asset: 'USDC' | 'USDT') => {
    setFundingAccount(publicKey);
    setFundingAsset(asset);
    setFundingMessage(null);

    try {
      const res = await fundAccountAction(
        publicKey,
        isEnvConfigured ? undefined : masterSecretKey,
        asset,
        '100.0000'
      );

      if (res.success) {
        setFundingMessage({
          type: 'success',
          text: `Successfully funded 100.0000 ${asset}! Reference ID: ${res.txHash?.substring(0, 16)}...`,
        });
        // Refresh balances
        await fetchBalances(derivedAccounts);
        await fetchTreasuryStatus();
      } else {
        setFundingMessage({
          type: 'error',
          text: `Funding failed: ${res.error || 'Unknown error'}`,
        });
      }
    } catch (err) {
      setFundingMessage({
        type: 'error',
        text: 'Error funding account: ' + (err instanceof Error ? err.message : String(err)),
      });
    } finally {
      setFundingAccount(null);
      setFundingAsset(null);
    }
  };

  const handleActivateTreasury = async () => {
    setTreasuryAction('activate');
    try {
      const result = await activateTreasuryAccountAction();
      if (result.success) {
        alert('Treasury account activated or refreshed with Friendbot.');
        await fetchTreasuryStatus();
      } else {
        alert(`Treasury activation failed: ${result.error || 'Unknown error'}`);
      }
    } finally {
      setTreasuryAction(null);
    }
  };

  const handleCreateTreasuryTrustline = async (asset: 'USDC' | 'USDT') => {
    setTreasuryAction(`trustline-${asset}`);
    try {
      const result = await createTreasuryTrustlineAction(asset);
      if (result.success) {
        alert(result.message || (result.created ? `${asset} trustline created for treasury.` : `${asset} trustline already exists for treasury.`));
        await fetchTreasuryStatus();
      } else {
        alert(`Treasury trustline failed: ${result.error || 'Unknown error'}`);
      }
    } finally {
      setTreasuryAction(null);
    }
  };

  const handleFundTreasuryAsset = async (asset: 'USDC' | 'USDT') => {
    setTreasuryAction(`fund-${asset}`);
    try {
      const result = await fundTreasuryAssetAction(asset, '100.0000');
      if (result.success) {
        alert(`Treasury funded with 100.0000 ${asset}.`);
        await fetchTreasuryStatus();
      } else {
        alert(`Treasury funding failed: ${result.error || 'Unknown error'}`);
      }
    } finally {
      setTreasuryAction(null);
    }
  };

  const handleTransferBetweenConfiguredAccounts = async () => {
    if (!transferSource || !transferDestination || !transferAmount) {
      alert('Choose source, destination, and amount first.');
      return;
    }

    setIsTransferring(true);
    try {
      const result = await transferBetweenConfiguredAccountsAction({
        sourcePublicKey: transferSource,
        destinationPublicKey: transferDestination,
        assetType: transferAsset,
        amountStr: transferAmount,
        masterSecretKeyInput: isEnvConfigured ? undefined : masterSecretKey,
      });

      if (result.success) {
        alert(`Transfer submitted. Reference ID: ${result.txHash?.substring(0, 18)}...`);
        await Promise.all([
          fetchTreasuryStatus(),
          fetchBalances(derivedAccounts),
          fetchUserBalances(testUsers),
        ]);
      } else {
        alert(`Transfer failed: ${result.error || 'Unknown error'}`);
      }
    } finally {
      setIsTransferring(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 flex flex-col gap-12 text-slate-800">
      {/* Header */}
      <section className="precision-callout precision-callout--emerald max-w-4xl text-left">
        <div className="precision-callout__rail" />
        <div className="precision-callout__body">
          <div className="precision-callout__header">
            <div className="precision-callout__intro">
              <span className="precision-callout__eyebrow">
                <Sparkles size={12} className="precision-callout__icon" />
                Developer playground
              </span>
              <h1 className="text-4xl font-extrabold tracking-tight text-[#131b2e]">
                Testnet account setup
              </h1>
              <p className="precision-callout__copy text-sm">
                Configure dev credentials, derive temporary accounts, register them in the pool, and fund them for demo review.
              </p>
            </div>
            {isMockMode ? (
              <Chip size="sm" className="precision-callout__chip">
                Mock mode
              </Chip>
            ) : (
              <Chip size="sm" className="precision-callout__chip">
                Active testnet
              </Chip>
            )}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Side: Keys Config & Derivation */}
        <div className="lg:col-span-5 flex flex-col gap-8">
          {/* Card 1: Master Keys */}
          <Card className="border border-[#eaedff] p-6 rounded-3xl bg-white shadow-sm text-left">
            <div className="flex flex-col gap-4">
              <h3 className="font-bold text-[#131b2e] text-base flex items-center gap-2">
                <Key className="text-[#003527]" size={20} /> Master Coordinates
              </h3>
              
              {isEnvConfigured ? (
                <div className="flex items-center gap-2 bg-[#f2f3ff] border border-[#eaedff] p-3 rounded-xl text-xs text-[#003527] font-semibold">
                  <Lock size={14} /> Keys are configured in environment variables.
                </div>
              ) : (
                <p className="text-slate-500 text-xs">
                  Generate a master keypair to derive accounts. Keys are stored safely in your browser session.
                </p>
              )}

              <div className="flex flex-col gap-3 mt-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Public Key (Coordinates)</label>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      value={masterPublicKey}
                      readOnly
                      placeholder="Not generated yet"
                      className="bg-white border border-[#eaedff] focus-within:border-[#003527] rounded-xl px-3 py-2 w-full text-sm outline-none font-mono text-xs flex-grow"
                    />
                    {masterPublicKey && (
                      <Button
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(masterPublicKey);
                          alert('Coordinates copied to clipboard!');
                        }}
                        className="border border-[#eaedff] bg-white text-slate-700 text-xs font-semibold rounded-xl px-3"
                      >
                        Copy
                      </Button>
                    )}
                  </div>
                </div>
                {!isEnvConfigured && (
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Secret Key (Key)</label>
                    <div className="flex gap-2">
                      <Input
                        type="password"
                        value={masterSecretKey}
                        onChange={async (e) => {
                          const val = e.target.value;
                          setMasterSecretKey(val);
                          if (!val) {
                            setMasterPublicKey('');
                            await clearMasterKeysAction();
                            return;
                          }
                          try {
                            const pub = StellarSdk.Keypair.fromSecret(val).publicKey();
                            setMasterPublicKey(pub);
                            await saveMasterKeysAction(pub, val);
                          } catch {
                            // ignore typing state
                          }
                        }}
                        placeholder="Enter or generate secret key"
                        className="bg-white border border-[#eaedff] focus-within:border-[#003527] rounded-xl px-3 py-2 w-full text-sm outline-none font-mono text-xs flex-grow"
                      />
                      {masterSecretKey && (
                        <Button
                          size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText(masterSecretKey);
                            alert('Key copied to clipboard!');
                          }}
                          className="border border-[#eaedff] bg-white text-slate-700 text-xs font-semibold rounded-xl px-3"
                        >
                          Copy
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {keyError && <div className="text-red-500 text-xs">{keyError}</div>}

              <div className="flex gap-2 mt-4">
                {!isEnvConfigured && (!masterPublicKey || !masterSecretKey) && (
                  <Button
                    onClick={handleGenerateKeys}
                    isPending={isGeneratingKeys}
                    className="bg-[#003527] text-white text-xs font-semibold rounded-xl flex-grow"
                    size="sm"
                  >
                    Generate Keys
                  </Button>
                )}
                {masterPublicKey && (
                  <Button
                    onClick={handleFundMaster}
                    className="border border-[#eaedff] bg-white text-slate-700 text-xs font-semibold rounded-xl"
                    size="sm"
                  >
                    Fund Master (Friendbot)
                  </Button>
                )}
                {!isEnvConfigured && masterPublicKey && (
                  <Button
                    onClick={handleClearKeys}
                    variant="danger-soft"
                    size="sm"
                    className="rounded-xl text-xs"
                  >
                    Clear
                  </Button>
                )}
              </div>

              {masterPublicKey && (
                <div className="flex gap-2 mt-2">
                  <Button
                    onClick={() => handleFundMasterAsset('USDC')}
                    isPending={isFundingMasterAsset === 'USDC'}
                    className="bg-[#003527] text-white text-xs font-semibold rounded-xl flex-grow"
                    size="sm"
                  >
                    Fund Master USDC
                  </Button>
                  <Button
                    onClick={() => handleFundMasterAsset('USDT')}
                    isPending={isFundingMasterAsset === 'USDT'}
                    className="bg-indigo-600 text-white text-xs font-semibold rounded-xl flex-grow"
                    size="sm"
                  >
                    Fund Master USDT
                  </Button>
                </div>
              )}

              {masterPublicKey && !isEnvConfigured && (
                <div className="mt-4 p-3 bg-slate-50 border border-[#eaedff] rounded-2xl flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">.env Configuration Block</span>
                    <Button
                      size="sm"
                      onClick={() => {
                        const envBlock = `STELLAR_DEV_PUBLIC_KEY=${masterPublicKey}\nSTELLAR_DEV_SECRET_KEY=${masterSecretKey}`;
                        navigator.clipboard.writeText(envBlock);
                        alert('.env parameters block copied to clipboard!');
                      }}
                      className="border border-[#eaedff] bg-white text-slate-700 text-[10px] font-semibold h-6 rounded-lg px-2"
                    >
                      Copy .env parameters
                    </Button>
                  </div>
                  <pre className="font-mono text-[10px] text-slate-600 bg-white p-2 rounded-xl border border-[#eaedff] overflow-x-auto select-all">
                    {`STELLAR_DEV_PUBLIC_KEY=${masterPublicKey}\nSTELLAR_DEV_SECRET_KEY=${masterSecretKey}`}
                  </pre>
                </div>
              )}
            </div>
          </Card>

          <Card className="border border-[#eaedff] p-6 rounded-3xl bg-white shadow-sm text-left">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-[#131b2e] text-base flex items-center gap-2">
                  <ShieldAlert className="text-[#003527]" size={20} /> Treasury Account
                </h3>
                <Button
                  size="sm"
                  onClick={fetchTreasuryStatus}
                  isPending={isLoadingTreasury}
                  className="border border-[#eaedff] bg-white text-slate-700 text-xs font-semibold rounded-xl"
                >
                  <RefreshCw size={12} className="mr-1" /> Sync
                </Button>
              </div>

              {treasuryStatus ? (
                <>
                  <div className="rounded-2xl border border-[#eaedff] bg-slate-50 p-4 flex flex-col gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Treasury Coordinates</span>
                    <span className="font-mono text-xs text-slate-700 break-all">{treasuryStatus.publicKey}</span>
                    <a
                      href={treasuryStatus.explorerUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#064e3b] hover:underline text-xs font-semibold inline-flex items-center gap-1"
                    >
                      Open in Stellar Expert <ExternalLink size={12} />
                    </a>
                  </div>

                  <div className="rounded-2xl border border-[#eaedff] bg-white p-4 flex flex-col gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Configured USDC Issuer</span>
                    <span className="font-mono text-xs text-slate-700 break-all">{treasuryStatus.issuerPublicKey || 'Not configured'}</span>
                    {treasuryStatus.issuerPublicKey && (
                      <a
                        href={`${treasuryStatus.explorerUrl.replace(treasuryStatus.publicKey, treasuryStatus.issuerPublicKey)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#064e3b] hover:underline text-xs font-semibold inline-flex items-center gap-1"
                      >
                        Open Issuer In Stellar Expert <ExternalLink size={12} />
                      </a>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div className="rounded-2xl border border-[#eaedff] bg-white p-3">
                      <span className="text-slate-400 font-semibold">XLM</span>
                      <p className="mt-1 font-bold text-slate-800">{parseFloat(treasuryStatus.balances.xlmBalance).toFixed(2)}</p>
                    </div>
                    <div className="rounded-2xl border border-[#eaedff] bg-white p-3">
                      <span className="text-slate-400 font-semibold">USDC</span>
                      <p className="mt-1 font-bold text-[#003527]">{parseFloat(treasuryStatus.balances.usdcBalance).toFixed(2)}</p>
                    </div>
                    <div className="rounded-2xl border border-[#eaedff] bg-white p-3">
                      <span className="text-slate-400 font-semibold">USDT</span>
                      <p className="mt-1 font-bold text-indigo-600">{parseFloat(treasuryStatus.balances.usdtBalance).toFixed(2)}</p>
                    </div>
                  </div>

                  {treasuryStatus.isIssuerForUsdt && (
                    <Alert status="warning">
                      <Alert.Indicator />
                      <Alert.Content>
                        <Alert.Title>Treasury Is Also The USDC Issuer</Alert.Title>
                        <Alert.Description>
                          This account is currently configured as both treasury and USDC issuer. It can mint the asset, but it cannot hold a normal USDC trustline balance itself. For Trustless Work flows, a separate treasury account is safer.
                        </Alert.Description>
                      </Alert.Content>
                    </Alert>
                  )}

                  {!treasuryStatus.isIssuerForUsdt && (
                    <Alert status="success">
                      <Alert.Indicator />
                      <Alert.Content>
                        <Alert.Title>Issuer And Treasury Are Separated</Alert.Title>
                        <Alert.Description>
                          This setup is ready for testnet-style USDC flows: the issuer can mint `USDC`, and the treasury can keep a normal trustline balance of that asset.
                        </Alert.Description>
                      </Alert.Content>
                    </Alert>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={handleActivateTreasury}
                      isPending={treasuryAction === 'activate'}
                      className="border border-[#eaedff] bg-white text-slate-700 text-xs font-semibold rounded-xl"
                    >
                      Fund Treasury XLM
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleCreateTreasuryTrustline('USDC')}
                      isPending={treasuryAction === 'trustline-USDC'}
                      className="bg-[#003527] text-white text-xs font-semibold rounded-xl"
                    >
                      Create Treasury USDC Trustline
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleCreateTreasuryTrustline('USDT')}
                      isPending={treasuryAction === 'trustline-USDT'}
                      className="bg-indigo-600 text-white text-xs font-semibold rounded-xl"
                    >
                      Create Treasury USDT Trustline
                    </Button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleFundTreasuryAsset('USDC')}
                      isPending={treasuryAction === 'fund-USDC'}
                      className="bg-[#003527] text-white text-xs font-semibold rounded-xl"
                    >
                      Fund Treasury USDC
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleFundTreasuryAsset('USDT')}
                      isPending={treasuryAction === 'fund-USDT'}
                      className="bg-indigo-600 text-white text-xs font-semibold rounded-xl"
                    >
                      Fund Treasury USDT
                    </Button>
                  </div>
                </>
              ) : (
                <div className="py-8 text-sm text-slate-400 border border-dashed border-[#eaedff] rounded-2xl bg-slate-50/50 text-center">
                  Treasury account is not configured yet.
                </div>
              )}
            </div>
          </Card>

          {/* Card 2: Account Derivation */}
          <Card className="border border-[#eaedff] p-6 rounded-3xl bg-white shadow-sm text-left">
            <div className="flex flex-col gap-4">
              <h3 className="font-bold text-[#131b2e] text-base flex items-center gap-2">
                <Layers className="text-[#003527]" size={20} /> Derive Accounts
              </h3>
              <p className="text-slate-500 text-xs">
                Derive N distinct accounts deterministically using the master keys. Generated accounts are saved to the pool database as available for rentals.
              </p>
              <div className="flex flex-col gap-1 mt-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Number of Accounts (N)</label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={String(deriveCount)}
                  onChange={(e) => setDeriveCount(Number(e.target.value))}
                  className="bg-white border border-[#eaedff] focus-within:border-[#003527] rounded-xl px-3 py-2 w-full text-sm outline-none"
                />
              </div>

              <Button
                onClick={handleDeriveAccounts}
                isPending={isDeriving}
                isDisabled={!masterPublicKey}
                className="bg-[#003527] text-white text-xs font-semibold rounded-xl w-full mt-2"
                size="sm"
              >
                Derive & Register in DB
              </Button>
            </div>
          </Card>
        </div>

        {/* Right Side: Derived Accounts Pool */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <Card className="border border-[#eaedff] p-6 rounded-3xl bg-white shadow-sm text-left">
            <div className="flex flex-col gap-4">
              <h3 className="font-bold text-[#131b2e] text-base flex items-center gap-2">
                <DollarSign className="text-[#003527]" size={20} /> Transfer Between Configured Accounts
              </h3>
              <p className="text-slate-500 text-xs">
                Move USDC or USDT between the treasury, the configured USDC issuer, the master account, pool accounts, and seeded host/guest accounts that already have secrets configured in the system.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Source Account</label>
                  <select
                    value={transferSource}
                    onChange={(e) => setTransferSource(e.target.value)}
                    className="bg-white border border-[#eaedff] rounded-xl px-3 py-2 text-sm outline-none"
                  >
                    <option value="">Select source account</option>
                    {configuredAccounts.map((account) => (
                      <option key={`source-${account.publicKey}`} value={account.publicKey}>
                        {account.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Destination Account</label>
                  <select
                    value={transferDestination}
                    onChange={(e) => setTransferDestination(e.target.value)}
                    className="bg-white border border-[#eaedff] rounded-xl px-3 py-2 text-sm outline-none"
                  >
                    <option value="">Select destination account</option>
                    {configuredAccounts.map((account) => (
                      <option key={`destination-${account.publicKey}`} value={account.publicKey}>
                        {account.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Asset</label>
                  <select
                    value={transferAsset}
                    onChange={(e) => setTransferAsset(e.target.value as 'USDC' | 'USDT')}
                    className="bg-white border border-[#eaedff] rounded-xl px-3 py-2 text-sm outline-none"
                  >
                    <option value="USDT">USDT</option>
                    <option value="USDC">USDC</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Amount</label>
                  <Input
                    type="number"
                    min="0.0001"
                    step="0.0001"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    className="bg-white border border-[#eaedff] focus-within:border-[#003527] rounded-xl px-3 py-2 w-full text-sm outline-none"
                  />
                </div>
              </div>

              <Button
                onClick={handleTransferBetweenConfiguredAccounts}
                isPending={isTransferring}
                isDisabled={!transferSource || !transferDestination || transferSource === transferDestination}
                className="bg-[#003527] text-white text-xs font-semibold rounded-xl w-full md:w-auto"
                size="sm"
              >
                Transfer Balance
              </Button>
            </div>
          </Card>

          <Card className="border border-[#eaedff] p-6 rounded-3xl bg-white shadow-sm text-left">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-[#131b2e] text-base">
                  Registered Temporary Accounts ({accountsData.length})
                </h3>
                {accountsData.length > 0 && (
                  <Button
                    size="sm"
                    onClick={() => fetchBalances(derivedAccounts)}
                    isPending={isLoadingBalances}
                    className="border border-[#eaedff] bg-white text-slate-700 text-xs font-semibold rounded-xl"
                  >
                    <RefreshCw size={12} className="mr-1" /> Sync Balances
                  </Button>
                )}
              </div>

              {fundingMessage && (
                <Alert 
                  color={fundingMessage.type === 'success' ? 'success' : 'danger'} 
                  className={`p-4 border rounded-2xl ${
                    fundingMessage.type === 'success' 
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  <div className="flex flex-col gap-1 w-full text-left text-xs">
                    <span className="font-bold flex items-center justify-between">
                      <span>{fundingMessage.type === 'success' ? 'Transfer Completed' : 'Transfer Failed'}</span>
                      <button onClick={() => setFundingMessage(null)} className="opacity-60 hover:opacity-100 font-bold ml-2">×</button>
                    </span>
                    <span>{fundingMessage.text}</span>
                  </div>
                </Alert>
              )}

              {accountsData.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-sm border border-dashed border-[#eaedff] rounded-2xl bg-slate-50/50">
                  No derived accounts registered yet. Use the left panel to derive and save coordinates.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table className="mt-2">
                    <Table.ScrollContainer>
                      <Table.Content aria-label="Derived Accounts Status">
                        <Table.Header>
                          <Table.Column isRowHeader>ACCOUNT COORDINATES</Table.Column>
                          <Table.Column>BALANCES</Table.Column>
                          <Table.Column>ACTIONS</Table.Column>
                        </Table.Header>
                        <Table.Body>
                          {accountsData.map((row) => (
                            <Table.Row key={row.publicKey}>
                              <Table.Cell>
                                <div className="flex flex-col gap-1">
                                  <span className="font-mono text-xs text-slate-700">
                                    {row.publicKey.substring(0, 8)}...{row.publicKey.slice(-8)}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <Chip size="sm" color="success" variant="soft" className="text-[10px] h-5">
                                      available
                                    </Chip>
                                    <a
                                      href={`https://stellar.expert/explorer/testnet/account/${row.publicKey}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-[#064e3b] hover:underline text-[10px] flex items-center gap-0.5"
                                    >
                                      Explorer <ExternalLink size={10} />
                                    </a>
                                  </div>
                                </div>
                              </Table.Cell>
                              <Table.Cell>
                                <div className="flex flex-col gap-0.5 text-xs text-slate-600">
                                  <span className="font-semibold">{parseFloat(row.xlmBalance).toFixed(2)} XLM</span>
                                  <span className="text-[#064e3b] font-medium">{parseFloat(row.usdcBalance).toFixed(2)} USDC</span>
                                  <span className="text-indigo-600 font-medium">{parseFloat(row.usdtBalance).toFixed(2)} USDT</span>
                                </div>
                              </Table.Cell>
                              <Table.Cell>
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    onClick={() => handleFundAccount(row.publicKey, 'USDC')}
                                    isPending={fundingAccount === row.publicKey && fundingAsset === 'USDC'}
                                    isDisabled={!!fundingAccount}
                                    className="bg-[#003527] text-white text-[10px] font-semibold h-7 rounded-lg"
                                  >
                                    <DollarSign size={10} /> Fund USDC
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => handleFundAccount(row.publicKey, 'USDT')}
                                    isPending={fundingAccount === row.publicKey && fundingAsset === 'USDT'}
                                    isDisabled={!!fundingAccount}
                                    className="bg-indigo-600 text-white text-[10px] font-semibold h-7 rounded-lg"
                                  >
                                    <DollarSign size={10} /> Fund USDT
                                  </Button>
                                </div>
                              </Table.Cell>
                            </Table.Row>
                          ))}
                        </Table.Body>
                      </Table.Content>
                    </Table.ScrollContainer>
                  </Table>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Test Users Management Section */}
      <section className="flex flex-col gap-6 text-left mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-[#131b2e] flex items-center gap-2">
            <Users className="text-[#003527]" size={22} /> Test User Accounts
          </h2>
          {testUsers.length > 0 && (
            <Button
              size="sm"
              onClick={() => fetchUserBalances(testUsers)}
              isPending={isLoadingUsers}
              className="border border-[#eaedff] bg-white text-slate-700 text-xs font-semibold rounded-xl"
            >
              <RefreshCw size={12} className="mr-1" /> Sync User Balances
            </Button>
          )}
        </div>
        <Card className="border border-[#eaedff] p-6 rounded-3xl bg-white shadow-sm overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="border-b border-[#eaedff] text-slate-400 text-xs font-bold uppercase tracking-wider">
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Coordinates (Public Key)</th>
                <th className="py-3 px-4">Secret Key (Database Persisted)</th>
                <th className="py-3 px-4 text-center">Balances</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {testUsers.map((user) => {
                const roles = [];
                if (user.ownerId) {
                  roles.push({
                    name: 'Host',
                    type: 'owner' as const,
                    key: user.ownerPublicKey,
                    secret: user.ownerSecretKey,
                  });
                }
                if (user.tenantId) {
                  roles.push({
                    name: 'Guest',
                    type: 'tenant' as const,
                    key: user.tenantPublicKey,
                    secret: user.tenantSecretKey,
                  });
                }

                return roles.map((role, idx) => {
                  const balance = role.key ? userBalances[role.key] : null;
                  const secretKey = role.secret || '';

                  return (
                    <tr key={`${user.userId}-${role.type}`} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-4 px-4 font-medium text-slate-800">
                        {idx === 0 ? (
                          <div>
                            <div className="font-semibold text-[#131b2e]">{user.name}</div>
                            <div className="text-xs text-slate-400 font-mono">{user.email}</div>
                          </div>
                        ) : null}
                      </td>
                      <td className="py-4 px-4">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          role.type === 'owner' 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                            : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                        }`}>
                          {role.name}
                        </span>
                      </td>
                      <td className="py-4 px-4 font-mono text-xs max-w-xs truncate">
                        {role.key ? (
                          <div className="flex items-center gap-2">
                            <span className="truncate select-all" title={role.key}>{role.key}</span>
                            <Button
                              size="sm"
                              onClick={() => {
                                navigator.clipboard.writeText(role.key || '');
                                alert('Public key copied!');
                              }}
                              className="border border-[#eaedff] bg-white text-slate-700 text-[10px] h-5 rounded-md px-1.5"
                            >
                              Copy
                            </Button>
                            <a
                              href={`https://stellar.expert/explorer/testnet/account/${role.key}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-indigo-600 hover:underline text-[10px]"
                            >
                              Explorer
                            </a>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Not set</span>
                        )}
                      </td>
                      <td className="py-4 px-4 font-mono text-xs max-w-xs truncate">
                        {secretKey ? (
                          <div className="flex items-center gap-2">
                            <span className="truncate">{secretKey.substring(0, 4)}...{secretKey.substring(secretKey.length - 4)}</span>
                            <Button
                              size="sm"
                              onClick={() => {
                                navigator.clipboard.writeText(secretKey);
                                alert('Secret key copied!');
                              }}
                              className="border border-[#eaedff] bg-white text-slate-700 text-[10px] h-5 rounded-md px-1.5"
                            >
                              Copy
                            </Button>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[10px]">Mock default (Seed)</span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-xs font-mono text-center">
                        {role.key ? (
                          <div className="inline-flex flex-col gap-0.5 text-left">
                            <div><span className="font-semibold text-slate-400">XLM:</span> {balance?.xlm || '...'}</div>
                            <div><span className="font-semibold text-[#003527]">USDC:</span> {balance?.usdc || '...'}</div>
                            <div><span className="font-semibold text-indigo-500">USDT:</span> {balance?.usdt || '...'}</div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">-</span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="flex gap-2 justify-end">
                          {(!role.key || !role.secret) && (
                            <Button
                              size="sm"
                              onClick={() => handleGenerateUserKeys(user.userId, role.type)}
                              className="bg-white border border-[#eaedff] text-[#131b2e] text-[10px] font-semibold h-7 rounded-xl px-2"
                            >
                              Gen Keys
                            </Button>
                          )}
                          {role.key && secretKey && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => handleFundUserAccount(role.key || '', secretKey, 'USDC')}
                                isPending={fundingAccount === role.key && fundingAsset === 'USDC'}
                                isDisabled={!!fundingAccount}
                                className="bg-[#003527] text-white text-[10px] font-semibold h-7 rounded-xl px-2"
                              >
                                Fund USDC
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleFundUserAccount(role.key || '', secretKey, 'USDT')}
                                isPending={fundingAccount === role.key && fundingAsset === 'USDT'}
                                isDisabled={!!fundingAccount}
                                className="bg-indigo-600 text-white text-[10px] font-semibold h-7 rounded-xl px-2"
                              >
                                Fund USDT
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                });
              })}
            </tbody>
          </table>
        </Card>
      </section>
    </div>
  );
}
