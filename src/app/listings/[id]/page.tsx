import React from 'react';
import { db } from '@/infrastructure/db/client';
import { listings } from '@/infrastructure/db/schema';
import { eq } from 'drizzle-orm';
import { BookingForm } from '@/presentation/components/BookingForm';
import { Chip } from '@heroui/react';
import { MapPin, Shield, Info, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface ListingPageProps {
  params: Promise<{ id: string }>;
}

// Fallback listings matching seed listings
const FALLBACK_LISTS = [
  {
    id: '1',
    title: 'Uluwatu Sanctuary',
    description: 'A beachfront sanctuary in Bali. Minimalist brutalist villa surrounded by tropical greenery and an infinity pool.',
    pricePerNightUsdt: '450.0000',
    securityDepositUsdt: '500.0000',
    city: 'Bali',
    country: 'Indonesia',
    images: ['https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80'],
    address: 'Jalan Pura Uluwatu 88',
  },
  {
    id: '2',
    title: 'Neo-Tokyo Loft',
    description: 'Stunning glass penthouse in Shibuya with floor-to-ceiling windows overlooking the neon Tokyo skyline.',
    pricePerNightUsdt: '820.0000',
    securityDepositUsdt: '900.0000',
    city: 'Tokyo',
    country: 'Japan',
    images: ['https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80'],
    address: 'Shibuya Crossing Suite 404',
  },
  {
    id: '3',
    title: 'Alpina Peak Cabin',
    description: 'Ultra-modern A-frame cabin in Zermatt. Panoramic mountain views, custom fireplace, and hot tub.',
    pricePerNightUsdt: '690.0000',
    securityDepositUsdt: '800.0000',
    city: 'Zermatt',
    country: 'Switzerland',
    images: ['https://images.unsplash.com/photo-1518780664697-55e3ad937233?auto=format&fit=crop&w=800&q=80'],
    address: 'Route des Alpinistes 22',
  },
  {
    id: '4',
    title: 'Azure Cliff Estate',
    description: 'Luxurious cliffside villa on the Amalfi Coast. Clean architectural lines, private deck, and emerald sea views.',
    pricePerNightUsdt: '1200.0000',
    securityDepositUsdt: '1500.0000',
    city: 'Positano',
    country: 'Italy',
    images: ['https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80'],
    address: 'Via Cristoforo Colombo 15',
  }
];

export default async function ListingPage({ params }: ListingPageProps) {
  const { id } = await params;
  
  let listing = null;

  try {
    listing = await db.query.listings.findFirst({
      where: eq(listings.id, id),
    });
  } catch (error) {
    console.warn('Listing query failed, trying fallback list:', error);
  }

  // If no DB result, locate in static fallbacks
  if (!listing) {
    listing = FALLBACK_LISTS.find(l => l.id === id);
  }

  if (!listing) {
    return (
      <div className="max-w-xl mx-auto px-6 py-24 text-center">
        <h2 className="text-2xl font-bold text-slate-800">Property Not Found</h2>
        <p className="text-slate-500 mt-2">The property you are trying to view does not exist.</p>
        <Link href="/" className="text-[#003527] font-semibold inline-flex items-center gap-1.5 mt-6 hover:underline">
          <ArrowLeft size={16} /> Back to Search
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 flex flex-col gap-8 text-left">
      {/* Back Link */}
      <div>
        <Link href="/" className="text-slate-400 hover:text-slate-600 transition-colors inline-flex items-center gap-1.5 text-sm">
          <ArrowLeft size={16} /> Back to explore
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Left Side: Images & Info */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="rounded-3xl overflow-hidden bg-slate-100 border border-[#eaedff] ambient-lift">
            <img
              src={listing.images?.[0] || 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750'}
              alt={listing.title}
              className="object-cover w-full h-[450px]"
            />
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Chip size="sm" color="success" variant="soft" className="text-[#064e3b] font-semibold">
                <span className="flex items-center gap-1">
                  <MapPin size={12} className="text-[#064e3b]" /> {listing.city}, {listing.country}
                </span>
              </Chip>
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-[#131b2e] tracking-tight">{listing.title}</h1>
            <p className="text-slate-600 leading-relaxed text-sm md:text-base">{listing.description}</p>
            
            <div className="text-xs text-slate-400 flex items-center gap-1 mt-1">
              <Info size={14} className="text-slate-400" /> Exact coordinates: {listing.address}
            </div>
          </div>

          <hr className="border-[#eaedff]" />

          {/* Host Card (Stitch Proposal) */}
          <div className="bg-[#f2f3ff] p-4 rounded-2xl border border-[#eaedff] flex items-center gap-4 max-w-sm mr-auto w-full">
            <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-200 shrink-0">
              <img 
                className="w-full h-full object-cover" 
                src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&q=80" 
                alt="Host Portrait"
              />
            </div>
            <div className="text-left">
              <p className="text-[10px] font-bold text-[#003527] uppercase tracking-widest">Verified Host</p>
              <p className="text-sm font-semibold text-slate-800">Sebastian Valerius</p>
            </div>
          </div>

          <hr className="border-[#eaedff]" />

          {/* Secure Trust info */}
          <div className="bg-[#f2f3ff]/40 border border-[#eaedff] rounded-3xl p-6 flex gap-4 items-start">
            <Shield className="text-[#003527] flex-shrink-0 mt-0.5" size={24} />
            <div className="flex flex-col gap-1.5 text-left">
              <h4 className="font-semibold text-[#131b2e] text-sm">Escrow Secure Booking</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Rent is held by the platform treasury and only released to the owner upon checkout. The security deposit goes directly into a decentralized smart contract via **Trustless Work** where it is held safely on Stellar.
              </p>
            </div>
          </div>
        </div>

        {/* Right Side: booking widgets */}
        <div className="lg:col-span-5">
          <div className="sticky top-24">
            <BookingForm
              listingId={listing.id}
              pricePerNightUsdt={listing.pricePerNightUsdt}
              securityDepositUsdt={listing.securityDepositUsdt}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
