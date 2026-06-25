import React from 'react';
import { db } from '@/infrastructure/db/client';
import { Button } from '@heroui/react';
import Link from 'next/link';
import { Sparkles, Compass } from 'lucide-react';
import { ListingsExplorer } from '@/presentation/components/ListingsExplorer';

export const revalidate = 0; // Dynamic rendering

const STATIC_FALLBACK_LISTINGS = [
  {
    id: '1',
    title: 'Uluwatu Sanctuary',
    description: 'A beachfront sanctuary in Bali. Minimalist brutalist villa surrounded by tropical greenery and an infinity pool.',
    pricePerNightUsdt: '450.0000',
    securityDepositUsdt: '500.0000',
    city: 'Bali',
    country: 'Indonesia',
    images: ['https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80']
  },
  {
    id: '2',
    title: 'Neo-Tokyo Loft',
    description: 'Stunning glass penthouse in Shibuya with floor-to-ceiling windows overlooking the neon Tokyo skyline.',
    pricePerNightUsdt: '820.0000',
    securityDepositUsdt: '900.0000',
    city: 'Tokyo',
    country: 'Japan',
    images: ['https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80']
  },
  {
    id: '3',
    title: 'Alpina Peak Cabin',
    description: 'Ultra-modern A-frame cabin in Zermatt. Panoramic mountain views, custom fireplace, and hot tub.',
    pricePerNightUsdt: '690.0000',
    securityDepositUsdt: '800.0000',
    city: 'Zermatt',
    country: 'Switzerland',
    images: ['https://images.unsplash.com/photo-1518780664697-55e3ad937233?auto=format&fit=crop&w=800&q=80']
  },
  {
    id: '4',
    title: 'Azure Cliff Estate',
    description: 'Luxurious cliffside villa on the Amalfi Coast. Clean architectural lines, private deck, and emerald sea views.',
    pricePerNightUsdt: '1200.0000',
    securityDepositUsdt: '1500.0000',
    city: 'Positano',
    country: 'Italy',
    images: ['https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80']
  }
];

export default async function HomePage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let propertyListings: any[] = [];
  try {
    propertyListings = await db.query.listings.findMany();
  } catch (error) {
    console.warn('Database connection failed, falling back to static mock data in HomePage:', error);
  }

  const listToRender = propertyListings.length > 0 ? propertyListings : STATIC_FALLBACK_LISTINGS;

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 flex flex-col gap-24">
      {/* Hero Section */}
      <section className="text-center flex flex-col items-center gap-6 max-w-3xl mx-auto mt-6">
        <div className="inline-flex items-center gap-1.5 bg-[#f2f3ff] border border-[#eaedff] text-[#003527] text-xs font-semibold px-3 py-1 rounded-full">
          <Sparkles size={12} className="text-[#064e3b]" /> The Digital Permanence Protocol
        </div>
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-[#131b2e] leading-[1.1]">
          Travel beyond borders,<br />
          <span className="text-[#064e3b]">pay with stability.</span>
        </h1>
        <p className="text-base md:text-lg text-slate-500 max-w-2xl leading-relaxed">
          Luxury vacation rentals secured by the Vitrosti Protocol. Middle-term stays, settled in USDT over Stellar, with security deposits locked in decentralized smart contracts via Trustless Work.
        </p>
        <div className="flex gap-4 mt-2">
          <Link href="#explore">
            <Button className="bg-[#003527] text-white font-semibold rounded-xl" size="lg">
              Explore Stays
            </Button>
          </Link>
          <Link href="/admin">
            <Button className="border border-[#eaedff] bg-white text-slate-700 font-semibold rounded-xl" size="lg">
              Admin Portal
            </Button>
          </Link>
        </div>
      </section>

      {/* Listings Explorer (Interactive search & category filtering) */}
      <section id="explore" className="scroll-mt-24">
        <ListingsExplorer initialListings={listToRender} />
      </section>

      {/* Protocol Description ("How it Works") */}
      <section className="bg-[#eaedff]/30 border border-[#eaedff] rounded-3xl p-8 md:p-12 flex flex-col gap-10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-1/3 h-full opacity-5 pointer-events-none flex items-center justify-end pr-8">
          <Compass size={320} className="text-[#003527]" />
        </div>

        <div className="max-w-xl relative z-10 text-left">
          <span className="text-xs font-bold text-[#003527] uppercase tracking-widest block mb-2">The Protocol</span>
          <h2 className="text-2xl md:text-3xl font-bold text-[#131b2e] tracking-tight">Redefining Rental Trust</h2>
          <p className="text-slate-500 text-sm mt-2 leading-relaxed">
            We replace manual travel trust with mathematical on-chain guarantees. No hidden commissions, no central custodians, fully auditable double-entry accounting.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10 text-left">
          <div className="flex flex-col gap-4 bg-white/60 p-6 rounded-2xl border border-[#eaedff]">
            <div className="h-10 w-10 rounded-full bg-[#f2f3ff] text-[#003527] flex items-center justify-center font-bold text-sm border border-[#eaedff]">1</div>
            <h4 className="font-bold text-[#131b2e] text-base">Select & Reserve</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Browse our hand-picked collection of premium global properties verified for quality and digital accessibility coordinates.
            </p>
          </div>
          <div className="flex flex-col gap-4 bg-white/60 p-6 rounded-2xl border border-[#eaedff]">
            <div className="h-10 w-10 rounded-full bg-[#003527] text-white flex items-center justify-center font-bold text-sm">2</div>
            <h4 className="font-bold text-[#131b2e] text-base">Pay with Stability</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Settle payment via temporary pool accounts on the protocol. Rent stays safe, and deposit is locked in a decentralized contract.
            </p>
          </div>
          <div className="flex flex-col gap-4 bg-white/60 p-6 rounded-2xl border border-[#eaedff]">
            <div className="h-10 w-10 rounded-full bg-[#f2f3ff] text-[#003527] flex items-center justify-center font-bold text-sm border border-[#eaedff]">3</div>
            <h4 className="font-bold text-[#131b2e] text-base">Automatic Settlement</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Checking out triggers automatic payout to the host and returns the deposit. If there is damage, a dispute is resolved trustlessly by admins.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
