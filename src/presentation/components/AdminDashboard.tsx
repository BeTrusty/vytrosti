'use client';

import React, { useState } from 'react';
import { Card, Button, Chip, Input, Table, Alert } from '@heroui/react';
import { runSeedingAction, triggerPollerAction, resolveDisputeAction, createUserAction } from '@/application/actions/admin';
import { 
  LayoutDashboard, 
  RefreshCw, 
  Calendar, 
  Key, 
  AlertTriangle, 
  BookOpen, 
  Layers, 
  Settings, 
  Home, 
  SlidersHorizontal,
  Users
} from 'lucide-react';
import Link from 'next/link';

export interface DashboardReservation {
  id: string;
  checkIn: string;
  checkOut: string;
  subtotalUsdt: string;
  securityDepositUsdt: string;
  platformFeeUsdt: string;
  status: string;
  listing: {
    title: string;
  };
}

export interface DashboardAccount {
  id: string;
  publicKey: string;
  status: string;
  lastHorizonCursor: string | null;
  lastPolledAt: string | null;
}

export interface DashboardDispute {
  id: string;
  reservationId: string;
  claimedAmountUsdt: string;
  reason: string;
  status: string;
  resolutionDetails: string | null;
}

export interface DashboardLedgerAccount {
  accountPath: string;
  balance: string;
}

export interface DashboardLedgerLine {
  id: string;
  accountPath: string;
  amount: string;
  direction: 'debit' | 'credit';
}

export interface DashboardLedgerEntry {
  id: string;
  description: string;
  referenceId: string | null;
  postedAt: string;
  lines: DashboardLedgerLine[];
}

export interface DashboardUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  ownerId: string | null;
  tenantId: string | null;
}

export interface DashboardOwner {
  id: string;
  stellarPublicKey: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
  listings: {
    id: string;
    title: string;
    bookingsCount: number;
  }[];
  totalBookingsReceived: number;
}

export interface DashboardTenant {
  id: string;
  stellarPublicKey: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
  reservations: {
    id: string;
    status: string;
    subtotalUsdt: string;
    listingTitle: string;
  }[];
}

export interface DashboardListing {
  id: string;
  title: string;
  pricePerNightUsdt: string;
  securityDepositUsdt: string;
  city: string;
  country: string;
}

interface AdminDashboardProps {
  initialData: {
    listingsCount: number;
    listings: DashboardListing[];
    reservations: DashboardReservation[];
    wallets: DashboardAccount[]; // internally referenced as wallets in DB, but displayed as accounts
    disputes: DashboardDispute[];
    ledgerAccounts: DashboardLedgerAccount[];
    ledgerEntries: DashboardLedgerEntry[];
    users: DashboardUser[];
    owners: DashboardOwner[];
    tenants: DashboardTenant[];
  };
}

type TabType = 'overview' | 'users' | 'listings' | 'bookings' | 'accounts' | 'ledger' | 'disputes' | 'settings';

export function AdminDashboard({ initialData }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [pollerResults, setPollerResults] = useState<string | null>(null);

  // Dispute resolution form state
  const [resolvingDisputeId, setResolvingDisputeId] = useState<string | null>(null);
  const [tenantShare, setTenantShare] = useState('');
  const [ownerShare, setOwnerShare] = useState('');

  // User registration form state
  const [userNameInput, setUserNameInput] = useState('');
  const [userEmailInput, setUserEmailInput] = useState('');
  const [userRoleInput, setUserRoleInput] = useState<'owner' | 'tenant' | 'both'>('tenant');
  const [stellarKeyInput, setStellarKeyInput] = useState('');

  const handleRegisterUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userNameInput || !userEmailInput || !stellarKeyInput) return;
    setLoading(true);
    const result = await createUserAction({
      name: userNameInput,
      email: userEmailInput,
      role: userRoleInput,
      stellarPublicKey: stellarKeyInput,
    });
    setLoading(false);
    if (result.success) {
      setUserNameInput('');
      setUserEmailInput('');
      setStellarKeyInput('');
      alert('User and roles coordinates registered successfully!');
      window.location.reload();
    } else {
      alert(result.error || 'Failed to register user');
    }
  };

  const handleTriggerPoller = async () => {
    setLoading(true);
    const result = await triggerPollerAction();
    setLoading(false);
    if (result.success && result.data) {
      setPollerResults(`Scanned: processed ${result.data.processedCount} transfers, swept ${result.data.sweptCount} deposits.`);
      setTimeout(() => setPollerResults(null), 5000);
    } else {
      alert(result.error || 'Ledger scanning failed');
    }
  };

  const handleSeedDatabase = async () => {
    setSeeding(true);
    const result = await runSeedingAction();
    setSeeding(false);
    if (result.success) {
      alert(result.message || 'Database seeded successfully!');
      window.location.reload();
    } else {
      alert(result.error || 'Seeding failed');
    }
  };

  const handleResolveDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvingDisputeId) return;
    setLoading(true);
    const result = await resolveDisputeAction({
      disputeId: resolvingDisputeId,
      tenantShareStr: tenantShare,
      ownerShareStr: ownerShare,
    });
    setLoading(false);
    if (result.success) {
      setResolvingDisputeId(null);
      setTenantShare('');
      setOwnerShare('');
      alert('Dispute resolved and funds distributed.');
      window.location.reload();
    } else {
      alert(result.error || 'Resolution failed');
    }
  };

  // KPI Calculations
  const totalVolume = initialData.reservations
    .filter(r => r.status !== 'pending_payment' && r.status !== 'cancelled')
    .reduce((acc, r) => acc + parseFloat(r.subtotalUsdt), 0);

  const activeStays = initialData.reservations.filter(r => r.status === 'active' || r.status === 'escrowed').length;
  const resolutionRate = initialData.disputes.length > 0 
    ? ((initialData.disputes.filter(d => d.status !== 'active').length / initialData.disputes.length) * 100).toFixed(0)
    : '100';

  // Sidebar navigation configuration
  const sidebarItems = [
    { id: 'overview' as TabType, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'users' as TabType, label: 'Users & Roles', icon: Users },
    { id: 'listings' as TabType, label: 'Listings', icon: Home },
    { id: 'bookings' as TabType, label: 'Bookings', icon: Calendar },
    { id: 'accounts' as TabType, label: 'Account Pool', icon: Key },
    { id: 'ledger' as TabType, label: 'Protocol Ledger', icon: BookOpen },
    { id: 'disputes' as TabType, label: 'Disputes', icon: AlertTriangle },
    { id: 'settings' as TabType, label: 'Settings', icon: Settings },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start text-left">
      {/* Left Sidebar Navigation (Stitch Proposal) */}
      <div className="lg:col-span-3 bg-[#f2f3ff] border border-[#eaedff] p-4 rounded-3xl flex flex-col gap-2 shrink-0">
        <div className="px-2 py-3 border-b border-[#eaedff] mb-4">
          <h1 className="font-bold text-2xl text-[#003527] tracking-tight">vytrosti</h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Backoffice Portal</p>
        </div>
        <nav className="flex flex-col gap-1">
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setResolvingDisputeId(null);
                }}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#003527] text-white'
                    : 'text-slate-600 hover:bg-[#eaedff] hover:text-[#003527]'
                }`}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="pt-4 border-t border-[#eaedff] mt-4 flex flex-col gap-2">
          {initialData.listingsCount === 0 && (
            <Button 
              onClick={handleSeedDatabase} 
              isPending={seeding} 
              className="w-full font-semibold text-[#003527] bg-[#eaedff] hover:bg-[#e2e7ff] rounded-xl text-xs py-2"
            >
              Seed Sample Assets
            </Button>
          )}
          <Button 
            onClick={handleTriggerPoller} 
            isPending={loading} 
            className="w-full bg-[#003527] text-white font-semibold flex items-center justify-center gap-1.5 rounded-xl text-xs py-2"
          >
            <RefreshCw size={14} /> Scan Ledger
          </Button>
        </div>
      </div>

      {/* Right Content Area */}
      <div className="lg:col-span-9 flex flex-col gap-6 w-full">
        {/* Header Panel */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white border border-[#eaedff] p-6 rounded-3xl shadow-sm">
          <div>
            <h2 className="text-2xl font-extrabold text-[#131b2e] tracking-tight capitalize">
              {sidebarItems.find(i => i.id === activeTab)?.label}
            </h2>
            <p className="text-slate-400 text-xs mt-1">
              {activeTab === 'overview' && 'Executive overview, stats summary, and general volume tracking.'}
              {activeTab === 'users' && 'Manage system users, register hosts (owners) and guests (tenants), and configure their Stellar coordinates.'}
              {activeTab === 'listings' && 'Property asset registries managed by property hosts.'}
              {activeTab === 'bookings' && 'Reservations, stays timelines, and rent payments ledger verification.'}
              {activeTab === 'accounts' && 'Coordinates pool allocated to bookings for memo-free verification.'}
              {activeTab === 'ledger' && 'Immutable audit journal and balance sheets of the platform.'}
              {activeTab === 'disputes' && 'Deposit claims and arbitration resolutions.'}
              {activeTab === 'settings' && 'Platform parameters, contract targets, and network coordinates.'}
            </p>
          </div>
        </div>

        {pollerResults && (
          <Alert color="success" className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl">
            {pollerResults}
          </Alert>
        )}

        {/* Tab Panels */}
        <div className="min-h-[400px]">
          {/* USERS & ROLES PANEL */}
          {activeTab === 'users' && (
            <div className="flex flex-col gap-8">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                {/* Registries Column */}
                <div className="lg:col-span-8 flex flex-col gap-8">
                  {/* Users Registry */}
                  <Card className="ambient-lift border border-[#eaedff] p-6 rounded-3xl bg-white">
                    <div className="flex flex-col gap-4 text-left">
                      <h3 className="font-bold text-[#131b2e] text-base flex items-center gap-2">
                        <Users className="text-[#003527]" size={20} /> Registered Users Registry
                      </h3>
                      <Table className="mt-2">
                        <Table.ScrollContainer>
                          <Table.Content aria-label="System Users List">
                            <Table.Header>
                              <Table.Column isRowHeader>USER NAME</Table.Column>
                              <Table.Column>EMAIL</Table.Column>
                              <Table.Column>ACTIVE ROLES</Table.Column>
                              <Table.Column>CREATED AT</Table.Column>
                            </Table.Header>
                            <Table.Body>
                              {initialData.users.map((user) => {
                                const roles: string[] = [];
                                if (user.ownerId) roles.push('Host');
                                if (user.tenantId) roles.push('Guest');
                                if (user.email.includes('admin')) roles.push('Admin');
                                return (
                                  <Table.Row key={user.id}>
                                    <Table.Cell className="font-bold text-slate-800">{user.name}</Table.Cell>
                                    <Table.Cell className="text-slate-600 text-xs">{user.email}</Table.Cell>
                                    <Table.Cell>
                                      <div className="flex gap-1.5 flex-wrap">
                                        {roles.map(role => (
                                          <Chip 
                                            key={role}
                                            size="sm" 
                                            color={role === 'Admin' ? 'danger' : role === 'Host' ? 'success' : 'default'} 
                                            variant="soft"
                                            className="font-semibold text-[10px]"
                                          >
                                            {role}
                                          </Chip>
                                        ))}
                                      </div>
                                    </Table.Cell>
                                    <Table.Cell className="text-slate-400 text-xs">
                                      {new Date(user.createdAt).toLocaleDateString()}
                                    </Table.Cell>
                                  </Table.Row>
                                );
                              })}
                            </Table.Body>
                          </Table.Content>
                        </Table.ScrollContainer>
                      </Table>
                    </div>
                  </Card>

                  {/* Hosts Registry */}
                  <Card className="ambient-lift border border-[#eaedff] p-6 rounded-3xl bg-white">
                    <div className="flex flex-col gap-4 text-left">
                      <h3 className="font-bold text-[#131b2e] text-base flex items-center gap-2">
                        <Home className="text-[#003527]" size={20} /> Hosts (Owners) Registry
                      </h3>
                      <Table className="mt-2">
                        <Table.ScrollContainer>
                          <Table.Content aria-label="Hosts List">
                            <Table.Header>
                              <Table.Column isRowHeader>HOST NAME</Table.Column>
                              <Table.Column>ACCOUNT COORDINATES</Table.Column>
                              <Table.Column>LISTINGS</Table.Column>
                              <Table.Column>BOOKINGS RECEIVED</Table.Column>
                            </Table.Header>
                            <Table.Body>
                              {initialData.owners.map((owner) => (
                                <Table.Row key={owner.id}>
                                  <Table.Cell>
                                    <div className="flex flex-col">
                                      <span className="font-bold text-slate-800 text-sm">{owner.user.name}</span>
                                      <span className="text-slate-400 text-[10px]">{owner.user.email}</span>
                                    </div>
                                  </Table.Cell>
                                  <Table.Cell className="font-mono text-[10px] text-slate-500 max-w-[140px] truncate">
                                    {owner.stellarPublicKey}
                                  </Table.Cell>
                                  <Table.Cell>
                                    <div className="flex flex-col gap-0.5 max-w-[180px]">
                                      <span className="text-xs font-semibold text-slate-700">{owner.listings.length} properties</span>
                                      {owner.listings.map(l => (
                                        <span key={l.id} className="text-[10px] text-slate-400 truncate" title={l.title}>
                                          • {l.title}
                                        </span>
                                      ))}
                                    </div>
                                  </Table.Cell>
                                  <Table.Cell className="font-bold text-slate-800 text-center">{owner.totalBookingsReceived}</Table.Cell>
                                </Table.Row>
                              ))}
                            </Table.Body>
                          </Table.Content>
                        </Table.ScrollContainer>
                      </Table>
                    </div>
                  </Card>

                  {/* Guests Registry */}
                  <Card className="ambient-lift border border-[#eaedff] p-6 rounded-3xl bg-white">
                    <div className="flex flex-col gap-4 text-left">
                      <h3 className="font-bold text-[#131b2e] text-base flex items-center gap-2">
                        <Calendar className="text-[#003527]" size={20} /> Guests (Tenants) Registry
                      </h3>
                      <Table className="mt-2">
                        <Table.ScrollContainer>
                          <Table.Content aria-label="Guests List">
                            <Table.Header>
                              <Table.Column isRowHeader>GUEST NAME</Table.Column>
                              <Table.Column>ACCOUNT COORDINATES</Table.Column>
                              <Table.Column>RESERVATIONS MADE</Table.Column>
                            </Table.Header>
                            <Table.Body>
                              {initialData.tenants.map((tenant) => (
                                <Table.Row key={tenant.id}>
                                  <Table.Cell>
                                    <div className="flex flex-col">
                                      <span className="font-bold text-slate-800 text-sm">{tenant.user.name}</span>
                                      <span className="text-slate-400 text-[10px]">{tenant.user.email}</span>
                                    </div>
                                  </Table.Cell>
                                  <Table.Cell className="font-mono text-[10px] text-slate-500 max-w-[140px] truncate">
                                    {tenant.stellarPublicKey}
                                  </Table.Cell>
                                  <Table.Cell>
                                    <div className="flex flex-col gap-0.5">
                                      <span className="text-xs font-semibold text-slate-700">{tenant.reservations.length} bookings</span>
                                      {tenant.reservations.map(r => (
                                        <span key={r.id} className="text-[10px] text-slate-400">
                                          • {r.listingTitle} ({r.status.replace('_', ' ')})
                                        </span>
                                      ))}
                                    </div>
                                  </Table.Cell>
                                </Table.Row>
                              ))}
                            </Table.Body>
                          </Table.Content>
                        </Table.ScrollContainer>
                      </Table>
                    </div>
                  </Card>
                </div>

                {/* Form Column */}
                <div className="lg:col-span-4">
                  <Card className="ambient-lift border border-[#eaedff] p-6 rounded-3xl bg-white sticky top-24">
                    <form onSubmit={handleRegisterUser} className="flex flex-col gap-4 text-left">
                      <div>
                        <h3 className="font-bold text-[#131b2e] text-base">Register User & Roles</h3>
                        <p className="text-slate-400 text-xs mt-1">Add a new user and assign their Host/Guest roles on the protocol.</p>
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Full Name</label>
                        <Input
                          type="text"
                          placeholder="e.g. Sebastian Valerius"
                          value={userNameInput}
                          onChange={(e) => setUserNameInput(e.target.value)}
                          required
                          className="bg-white border border-[#eaedff] focus-within:border-[#003527] rounded-xl px-3 py-2 w-full text-sm outline-none"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Email Address</label>
                        <Input
                          type="email"
                          placeholder="e.g. sebastian@vytrosti.net"
                          value={userEmailInput}
                          onChange={(e) => setUserEmailInput(e.target.value)}
                          required
                          className="bg-white border border-[#eaedff] focus-within:border-[#003527] rounded-xl px-3 py-2 w-full text-sm outline-none"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Protocol Role</label>
                        <select
                          value={userRoleInput}
                          onChange={(e) => setUserRoleInput(e.target.value as 'owner' | 'tenant' | 'both')}
                          className="bg-white border border-[#eaedff] focus:border-[#003527] focus:ring-1 focus:ring-[#003527] rounded-xl px-3 py-2 w-full text-sm outline-none font-medium text-slate-800"
                        >
                          <option value="tenant">Guest (Tenant)</option>
                          <option value="owner">Host (Owner)</option>
                          <option value="both">Both (Host & Guest)</option>
                        </select>
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Stellar Account Coordinates</label>
                        <Input
                          type="text"
                          placeholder="G..."
                          value={stellarKeyInput}
                          onChange={(e) => setStellarKeyInput(e.target.value)}
                          required
                          className="bg-white border border-[#eaedff] focus-within:border-[#003527] rounded-xl px-3 py-2 w-full text-sm font-mono"
                        />
                      </div>

                      <Button
                        type="submit"
                        isPending={loading}
                        className="w-full bg-[#003527] text-white font-bold rounded-xl mt-2 py-2"
                      >
                        Register Coordinates
                      </Button>
                    </form>
                  </Card>
                </div>

              </div>
            </div>
          )}

          {/* OVERVIEW PANEL */}
          {activeTab === 'overview' && (
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="ambient-lift border border-[#eaedff] p-6 rounded-2xl bg-white">
                  <div className="flex flex-col gap-2 text-left">
                    <span className="text-slate-400 font-semibold text-[10px] uppercase tracking-widest">Total Stays Volume</span>
                    <h3 className="text-3xl font-extrabold text-[#131b2e]">{totalVolume.toFixed(2)} USDC</h3>
                    <p className="text-slate-400 text-xs mt-2">Sum of rent payments of all active or completed bookings.</p>
                  </div>
                </Card>
                <Card className="ambient-lift border border-[#eaedff] p-6 rounded-2xl bg-white">
                  <div className="flex flex-col gap-2 text-left">
                    <span className="text-slate-400 font-semibold text-[10px] uppercase tracking-widest">Active Stays</span>
                    <h3 className="text-3xl font-extrabold text-[#131b2e]">{activeStays}</h3>
                    <p className="text-slate-400 text-xs mt-2">Bookings currently secured in smart deposits.</p>
                  </div>
                </Card>
                <Card className="ambient-lift border border-[#eaedff] p-6 rounded-2xl bg-white">
                  <div className="flex flex-col gap-2 text-left">
                    <span className="text-slate-400 font-semibold text-[10px] uppercase tracking-widest">Dispute Resolution Rate</span>
                    <h3 className="text-3xl font-extrabold text-[#131b2e]">{resolutionRate}%</h3>
                    <p className="text-slate-400 text-xs mt-2">Percentage of claims settled by platform admins.</p>
                  </div>
                </Card>
              </div>

              {/* Quick stats list */}
              <Card className="ambient-lift border border-[#eaedff] p-6 rounded-3xl bg-white">
                <div className="flex flex-col gap-4 text-left">
                  <h3 className="font-bold text-[#131b2e] text-base">Platform Activity Summary</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm mt-2">
                    <div className="flex flex-col">
                      <span className="text-slate-400 font-semibold text-xs">Total Properties</span>
                      <span className="text-[#131b2e] font-bold text-lg mt-0.5">{initialData.listingsCount}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-slate-400 font-semibold text-xs">Total Reservations</span>
                      <span className="text-[#131b2e] font-bold text-lg mt-0.5">{initialData.reservations.length}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-slate-400 font-semibold text-xs">Active Disputes</span>
                      <span className="text-red-600 font-bold text-lg mt-0.5">
                        {initialData.disputes.filter(d => d.status === 'active').length}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-slate-400 font-semibold text-xs">Ledger Entries Count</span>
                      <span className="text-slate-800 font-bold text-lg mt-0.5">{initialData.ledgerEntries.length}</span>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* LISTINGS PANEL */}
          {activeTab === 'listings' && (
            <Card className="ambient-lift border border-[#eaedff] p-6 rounded-3xl bg-white">
              <div className="flex flex-col gap-4 text-left">
                <h3 className="font-bold text-[#131b2e] text-base flex items-center gap-2">
                  <SlidersHorizontal className="text-[#003527]" size={20} /> Property Registries
                </h3>
                <Table className="mt-4">
                  <Table.ScrollContainer>
                    <Table.Content aria-label="Properties List">
                      <Table.Header>
                        <Table.Column isRowHeader>PROPERTY TITLE</Table.Column>
                        <Table.Column>CITY</Table.Column>
                        <Table.Column>COUNTRY</Table.Column>
                        <Table.Column>PRICE PER NIGHT</Table.Column>
                        <Table.Column>SECURITY DEPOSIT</Table.Column>
                      </Table.Header>
                      <Table.Body>
                        {initialData.listings.map((listing) => (
                          <Table.Row key={listing.id}>
                            <Table.Cell className="font-bold text-slate-800">{listing.title}</Table.Cell>
                            <Table.Cell className="text-slate-600 text-xs">{listing.city}</Table.Cell>
                            <Table.Cell className="text-slate-600 text-xs">{listing.country}</Table.Cell>
                            <Table.Cell className="font-semibold text-slate-800">{parseFloat(listing.pricePerNightUsdt).toFixed(2)} USDC</Table.Cell>
                            <Table.Cell className="text-slate-500 font-mono text-xs">{parseFloat(listing.securityDepositUsdt).toFixed(2)} USDC</Table.Cell>
                          </Table.Row>
                        ))}
                      </Table.Body>
                    </Table.Content>
                  </Table.ScrollContainer>
                </Table>
              </div>
            </Card>
          )}

          {/* BOOKINGS PANEL */}
          {activeTab === 'bookings' && (
            <Card className="ambient-lift border border-[#eaedff] p-6 rounded-3xl bg-white">
              <div className="flex flex-col gap-4 text-left">
                <h3 className="font-bold text-[#131b2e] text-base flex items-center gap-2">
                  <Calendar className="text-[#003527]" size={20} /> Active Reservations
                </h3>
                <Table className="mt-4">
                  <Table.ScrollContainer>
                    <Table.Content aria-label="Reservations List">
                      <Table.Header>
                        <Table.Column isRowHeader>ID</Table.Column>
                        <Table.Column>PROPERTY</Table.Column>
                        <Table.Column>STAY DATES</Table.Column>
                        <Table.Column>RENT DUE</Table.Column>
                        <Table.Column>DEPOSIT</Table.Column>
                        <Table.Column>STATUS</Table.Column>
                        <Table.Column>ACTION</Table.Column>
                      </Table.Header>
                      <Table.Body>
                        {initialData.reservations.map((res) => (
                          <Table.Row key={res.id}>
                            <Table.Cell className="font-semibold text-[#003527]">#{res.id.substring(0, 8)}</Table.Cell>
                            <Table.Cell className="font-bold text-slate-800">{res.listing.title}</Table.Cell>
                            <Table.Cell className="text-xs text-slate-500">
                              {new Date(res.checkIn).toLocaleDateString()} - {new Date(res.checkOut).toLocaleDateString()}
                            </Table.Cell>
                            <Table.Cell className="font-bold text-slate-800">{parseFloat(res.subtotalUsdt).toFixed(2)} USDC</Table.Cell>
                            <Table.Cell className="text-xs text-slate-600 font-mono">{parseFloat(res.securityDepositUsdt).toFixed(2)} USDC</Table.Cell>
                            <Table.Cell>
                              <Chip 
                                size="sm" 
                                color={res.status === 'completed' ? 'success' : res.status === 'disputed' ? 'danger' : 'default'} 
                                variant="soft"
                                className="font-semibold"
                              >
                                {res.status.replace('_', ' ')}
                              </Chip>
                            </Table.Cell>
                            <Table.Cell>
                              <Link href={`/reservations/${res.id}`}>
                                <Button size="sm" className="text-[#003527] bg-[#eaedff] hover:bg-[#e2e7ff] rounded-lg text-xs font-semibold">
                                  Open
                                </Button>
                              </Link>
                            </Table.Cell>
                          </Table.Row>
                        ))}
                      </Table.Body>
                    </Table.Content>
                  </Table.ScrollContainer>
                </Table>
              </div>
            </Card>
          )}

          {/* ACCOUNTS PANEL */}
          {activeTab === 'accounts' && (
            <Card className="ambient-lift border border-[#eaedff] p-6 rounded-3xl bg-white">
              <div className="flex flex-col gap-4 text-left">
                <h3 className="font-bold text-[#131b2e] text-base flex items-center gap-2">
                  <Key className="text-[#003527]" size={20} /> Ephemeral Account Coordinates Pool
                </h3>
                <p className="text-slate-500 text-xs">These temporary protocol accounts are leased to individual bookings for memo-free validation of payments.</p>
                <Table className="mt-4">
                  <Table.ScrollContainer>
                    <Table.Content aria-label="Account Pool Status">
                      <Table.Header>
                        <Table.Column isRowHeader>ACCOUNT COORDINATES</Table.Column>
                        <Table.Column>ACCOUNT STATUS</Table.Column>
                        <Table.Column>LAST SCANNED AT</Table.Column>
                        <Table.Column>HORIZON LEDGER CURSOR</Table.Column>
                      </Table.Header>
                      <Table.Body>
                        {initialData.wallets.map((wallet) => (
                          <Table.Row key={wallet.id}>
                            <Table.Cell className="font-mono text-xs text-slate-700">{wallet.publicKey}</Table.Cell>
                            <Table.Cell>
                              <Chip 
                                size="sm" 
                                color={wallet.status === 'available' ? 'success' : wallet.status === 'assigned' ? 'warning' : 'default'}
                                variant="soft"
                                className="font-semibold"
                              >
                                {wallet.status}
                              </Chip>
                            </Table.Cell>
                            <Table.Cell className="text-xs text-slate-500">
                              {wallet.lastPolledAt ? new Date(wallet.lastPolledAt).toLocaleTimeString() : 'Never'}
                            </Table.Cell>
                            <Table.Cell className="font-mono text-xs text-slate-400">{wallet.lastHorizonCursor || '0'}</Table.Cell>
                          </Table.Row>
                        ))}
                      </Table.Body>
                    </Table.Content>
                  </Table.ScrollContainer>
                </Table>
              </div>
            </Card>
          )}

          {/* LEDGER PANEL */}
          {activeTab === 'ledger' && (
            <div className="flex flex-col gap-8">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
                {/* Account Balances (Summary) */}
                <div className="md:col-span-5">
                  <Card className="ambient-lift border border-[#eaedff] p-6 rounded-3xl bg-white">
                    <div className="flex flex-col gap-4 text-left">
                      <h4 className="font-bold text-[#131b2e] text-base flex items-center gap-1.5">
                        <Layers size={18} className="text-[#003527]" /> Account Balances
                      </h4>
                      <Table className="mt-2">
                        <Table.ScrollContainer>
                          <Table.Content aria-label="Ledger Account Balances">
                            <Table.Header>
                              <Table.Column isRowHeader>ACCOUNT PATH</Table.Column>
                              <Table.Column className="text-right">BALANCE</Table.Column>
                            </Table.Header>
                            <Table.Body>
                              {initialData.ledgerAccounts.map((acc) => (
                                <Table.Row key={acc.accountPath}>
                                  <Table.Cell className="text-xs font-semibold text-slate-600 truncate max-w-[170px]">
                                    {acc.accountPath}
                                  </Table.Cell>
                                  <Table.Cell className="font-mono text-xs text-right font-bold text-slate-800">
                                    {parseFloat(acc.balance).toFixed(2)} USDC
                                  </Table.Cell>
                                </Table.Row>
                              ))}
                            </Table.Body>
                          </Table.Content>
                        </Table.ScrollContainer>
                      </Table>
                    </div>
                  </Card>
                </div>

                {/* General Ledger Journal (Entries) */}
                <div className="md:col-span-7">
                  <Card className="ambient-lift border border-[#eaedff] p-6 rounded-3xl bg-white">
                    <div className="flex flex-col gap-4 text-left">
                      <h4 className="font-bold text-[#131b2e] text-base flex items-center gap-1.5">
                        <BookOpen size={18} className="text-[#003527]" /> General Ledger Journal
                      </h4>
                      <p className="text-slate-500 text-xs">Immutable double-entry audit trail. Every entry is balanced (sum of debits equals sum of credits).</p>
                      <div className="flex flex-col gap-6 mt-4 max-h-[600px] overflow-y-auto pr-1">
                        {initialData.ledgerEntries.map((entry) => (
                          <div key={entry.id} className="border border-[#eaedff] bg-slate-50/50 rounded-2xl p-4 flex flex-col gap-3">
                            <div className="flex justify-between items-start border-b border-slate-100 pb-2">
                              <div>
                                <span className="text-[10px] text-slate-400 font-semibold uppercase">{new Date(entry.postedAt).toLocaleString()}</span>
                                <h5 className="font-bold text-sm text-[#131b2e] mt-0.5">{entry.description}</h5>
                              </div>
                              <span className="text-[10px] text-[#003527] font-semibold font-mono">Ref: #{entry.referenceId?.substring(0, 8)}</span>
                            </div>
                            <div className="flex flex-col gap-1.5 text-xs">
                              {entry.lines.map((line) => (
                                <div key={line.id} className="flex justify-between font-mono">
                                  <span className={line.direction === 'credit' ? 'pl-4 text-slate-400' : 'text-slate-800 font-semibold'}>
                                    {line.accountPath}
                                  </span>
                                  <span className={line.direction === 'debit' ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}>
                                    {line.direction === 'debit' ? '+' : '-'}{parseFloat(line.amount).toFixed(2)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </Card>
                </div>
              </div>
            </div>
          )}

          {/* DISPUTES PANEL */}
          {activeTab === 'disputes' && (
            <Card className="ambient-lift border border-[#eaedff] p-6 rounded-3xl bg-white">
              <div className="flex flex-col gap-4 text-left">
                <h3 className="font-bold text-[#131b2e] text-lg flex items-center gap-2">
                  <AlertTriangle className="text-red-600" size={20} /> Stay Disputes Arbitration
                </h3>
                <p className="text-slate-500 text-xs">Review and settle deposit claims by splitting the escrowed security deposit between Tenant and Host.</p>

                {resolvingDisputeId ? (
                  <form onSubmit={handleResolveDispute} className="mt-4 border border-[#eaedff] p-6 rounded-2xl flex flex-col gap-4 max-w-xl bg-slate-50/50">
                    <h4 className="font-bold text-[#131b2e]">Arbitrate Dispute</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-slate-700">Refund to Tenant (USDC)</label>
                        <Input
                          type="number"
                          value={tenantShare}
                          onChange={(e) => setTenantShare(e.target.value)}
                          required
                          className="bg-white border border-[#eaedff] focus-within:border-[#003527] rounded-xl px-3 py-2 w-full text-sm outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-slate-700">Award to Host (USDC)</label>
                        <Input
                          type="number"
                          value={ownerShare}
                          onChange={(e) => setOwnerShare(e.target.value)}
                          required
                          className="bg-white border border-[#eaedff] focus-within:border-[#003527] rounded-xl px-3 py-2 w-full text-sm outline-none"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end mt-2">
                      <Button size="sm" className="bg-slate-200 text-slate-700 rounded-lg text-xs" onClick={() => setResolvingDisputeId(null)}>Cancel</Button>
                      <Button size="sm" type="submit" className="bg-[#003527] text-white rounded-lg text-xs" isPending={loading}>Resolve Dispute</Button>
                    </div>
                  </form>
                ) : (
                  <Table className="mt-4">
                    <Table.ScrollContainer>
                      <Table.Content aria-label="Disputes arbitration table">
                        <Table.Header>
                          <Table.Column isRowHeader>RESERVATION ID</Table.Column>
                          <Table.Column>CLAIM AMOUNT</Table.Column>
                          <Table.Column>CLAIM REASON</Table.Column>
                          <Table.Column>CLAIM STATUS</Table.Column>
                          <Table.Column>RESOLUTION DETAILS</Table.Column>
                          <Table.Column>ACTION</Table.Column>
                        </Table.Header>
                        <Table.Body>
                          {initialData.disputes.map((dispute) => (
                            <Table.Row key={dispute.id}>
                              <Table.Cell className="font-semibold text-[#003527]">#{dispute.reservationId.substring(0, 8)}</Table.Cell>
                              <Table.Cell className="font-bold text-slate-800">{parseFloat(dispute.claimedAmountUsdt).toFixed(2)} USDC</Table.Cell>
                              <Table.Cell className="text-xs text-slate-600 max-w-[200px] truncate">{dispute.reason}</Table.Cell>
                              <Table.Cell>
                                <Chip size="sm" color={dispute.status === 'active' ? 'danger' : 'success'} variant="soft" className="font-semibold">
                                  {dispute.status}
                                </Chip>
                              </Table.Cell>
                              <Table.Cell className="text-xs text-slate-500 italic max-w-[200px] truncate">
                                {dispute.resolutionDetails || 'Awaiting Settlement'}
                              </Table.Cell>
                              <Table.Cell>
                                {dispute.status === 'active' ? (
                                  <Button 
                                    onClick={() => {
                                      setResolvingDisputeId(dispute.id);
                                      setTenantShare(dispute.claimedAmountUsdt);
                                      setOwnerShare('0');
                                    }} 
                                    size="sm" 
                                    className="bg-red-50 text-red-700 hover:bg-red-100 rounded-lg text-xs font-semibold"
                                  >
                                    Arbitrate
                                  </Button>
                                ) : (
                                  <span className="text-xs text-slate-400">Settled</span>
                                )}
                              </Table.Cell>
                            </Table.Row>
                          ))}
                        </Table.Body>
                      </Table.Content>
                    </Table.ScrollContainer>
                  </Table>
                )}
              </div>
            </Card>
          )}

          {/* SETTINGS PANEL */}
          {activeTab === 'settings' && (
            <div className="flex flex-col gap-6">
              <Card className="ambient-lift border border-[#eaedff] p-6 rounded-3xl bg-white">
                <div className="flex flex-col gap-4 text-left">
                  <h3 className="font-bold text-[#131b2e] text-base">Protocol Environment Settings</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm mt-2">
                    <div className="flex flex-col border-b border-[#eaedff] pb-3">
                      <span className="text-slate-400 font-semibold text-xs">Stellar Network Option</span>
                      <span className="text-slate-800 font-mono text-xs mt-1">testnet</span>
                    </div>
                    <div className="flex flex-col border-b border-[#eaedff] pb-3">
                      <span className="text-slate-400 font-semibold text-xs">Stellar Horizon Endpoint</span>
                      <span className="text-slate-800 font-mono text-xs mt-1">https://horizon-testnet.stellar.org</span>
                    </div>
                    <div className="flex flex-col border-b border-[#eaedff] pb-3">
                      <span className="text-slate-400 font-semibold text-xs">USDC Asset Coordinates</span>
                      <span className="text-slate-800 font-mono text-[10px] break-all mt-1">USDC (configured via STELLAR_USDC_ASSET_ISSUER)</span>
                    </div>
                    <div className="flex flex-col border-b border-[#eaedff] pb-3">
                      <span className="text-slate-400 font-semibold text-xs">Trustless Work API Target</span>
                      <span className="text-slate-800 font-mono text-xs mt-1">Configured via TRUSTLESS_API_URL</span>
                    </div>
                    <div className="flex flex-col border-b border-[#eaedff] pb-3">
                      <span className="text-slate-400 font-semibold text-xs">Platform Treasury Account Coordinates</span>
                      <span className="text-slate-800 font-mono text-xs mt-1">Configured via STELLAR_TREASURY_PUBLIC_KEY</span>
                    </div>
                    <div className="flex flex-col border-b border-[#eaedff] pb-3">
                      <span className="text-slate-400 font-semibold text-xs">Account Secret Encryption Key (AES-256)</span>
                      <span className="text-emerald-700 font-semibold text-xs mt-1">●● Active (64 Hex chars validated)</span>
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="ambient-lift border border-[#eaedff] p-6 rounded-3xl bg-white">
                <div className="flex flex-col gap-3 text-left">
                  <h3 className="font-bold text-[#131b2e] text-base">Development tools</h3>
                  <p className="text-slate-500 text-xs">System-level diagnostic operations for development environments.</p>
                  <div className="flex gap-4 mt-2">
                    <Button 
                      onClick={handleSeedDatabase} 
                      isPending={seeding}
                      className="bg-red-50 text-red-700 hover:bg-red-100 rounded-xl text-xs font-bold"
                    >
                      Reset & Re-Seed Database
                    </Button>
                    <Link href="/testnet">
                      <Button
                        className="bg-slate-50 text-[#003527] border border-[#eaedff] hover:bg-slate-100 rounded-xl text-xs font-bold"
                      >
                        Stellar Testnet Setup
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
