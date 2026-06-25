'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { MapPin, Compass, Palmtree, Mountain, Building, Gem, Search, Heart } from 'lucide-react';

interface Listing {
  id: string;
  title: string;
  description: string;
  pricePerNightUsdt: string;
  securityDepositUsdt: string;
  city: string;
  country: string;
  images: string[];
}

interface ListingsExplorerProps {
  initialListings: Listing[];
}

export function ListingsExplorer({ initialListings }: ListingsExplorerProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [datesQuery, setDatesQuery] = useState<string>('');
  const [guestsQuery, setGuestsQuery] = useState<string>('');

  // Map listings to categories for realistic in-memory filtering
  const getListingCategory = (listing: Listing): string => {
    const title = listing.title.toLowerCase();
    const desc = listing.description.toLowerCase();
    
    if (title.includes('sanctuary') || title.includes('beach') || desc.includes('beachfront') || title.includes('cliff')) {
      return 'beach';
    }
    if (title.includes('cabin') || title.includes('chalet') || desc.includes('wood') || title.includes('alps')) {
      return 'cabins';
    }
    if (title.includes('loft') || title.includes('shibuya') || title.includes('tokyo') || desc.includes('penthouse')) {
      return 'modern';
    }
    if (title.includes('estate') || title.includes('villa') || title.includes('penthouse')) {
      return 'penthouse';
    }
    return 'modern'; // Default fallback
  };

  // Filter listings based on search query and category
  const filteredListings = useMemo(() => {
    return initialListings.filter((listing) => {
      const matchesSearch = 
        listing.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        listing.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
        listing.country.toLowerCase().includes(searchQuery.toLowerCase());
      
      if (selectedCategory === 'all') {
        return matchesSearch;
      }
      
      const category = getListingCategory(listing);
      return matchesSearch && category === selectedCategory;
    });
  }, [initialListings, selectedCategory, searchQuery]);

  const categories = [
    { id: 'all', name: 'All Stays', icon: Compass },
    { id: 'beach', name: 'Beachfront', icon: Palmtree },
    { id: 'cabins', name: 'Cabins', icon: Mountain },
    { id: 'modern', name: 'Modern', icon: Building },
    { id: 'penthouse', name: 'Penthouses', icon: Gem },
  ];

  return (
    <div className="flex flex-col gap-12">
      {/* Search Bar - Slot Style (Stitch Proposal) */}
      <div className="bg-white/80 backdrop-blur-md p-3 rounded-full shadow-lg border border-[#eaedff] flex flex-col md:flex-row items-center gap-2 max-w-4xl mx-auto w-full transition-all focus-within:border-[#003527] focus-within:ring-1 focus-within:ring-[#003527]">
        <div className="flex-1 w-full px-6 py-2 text-left border-r border-[#eaedff] last:border-0 md:border-r">
          <label className="block text-[10px] text-slate-400 font-semibold uppercase tracking-widest">Where</label>
          <input 
            type="text" 
            placeholder="Search destinations" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent border-none outline-none p-0 text-slate-800 placeholder:text-slate-400 font-medium text-sm focus:ring-0 mt-0.5"
          />
        </div>
        <div className="flex-1 w-full px-6 py-2 text-left border-r border-[#eaedff] last:border-0 md:border-r">
          <label className="block text-[10px] text-slate-400 font-semibold uppercase tracking-widest">When</label>
          <input 
            type="text" 
            placeholder="Add dates" 
            value={datesQuery}
            onChange={(e) => setDatesQuery(e.target.value)}
            className="w-full bg-transparent border-none outline-none p-0 text-slate-800 placeholder:text-slate-400 font-medium text-sm focus:ring-0 mt-0.5"
          />
        </div>
        <div className="flex-1 w-full px-6 py-2 text-left">
          <label className="block text-[10px] text-slate-400 font-semibold uppercase tracking-widest">Guests</label>
          <input 
            type="text" 
            placeholder="Add guests" 
            value={guestsQuery}
            onChange={(e) => setGuestsQuery(e.target.value)}
            className="w-full bg-transparent border-none outline-none p-0 text-slate-800 placeholder:text-slate-400 font-medium text-sm focus:ring-0 mt-0.5"
          />
        </div>
        <button className="bg-[#003527] text-white p-4 rounded-full flex items-center justify-center hover:bg-[#064e3b] active:scale-95 transition-all group shrink-0">
          <Search size={18} />
        </button>
      </div>

      {/* Category Tabs (Stitch Proposal) */}
      <div className="flex justify-start md:justify-center items-center gap-10 overflow-x-auto pb-4 no-scrollbar border-b border-[#eaedff]">
        {categories.map((cat) => {
          const Icon = cat.icon;
          const isSelected = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex flex-col items-center gap-2 group transition-all shrink-0 pb-2 border-b-2 -mb-[18px] cursor-pointer ${
                isSelected 
                  ? 'border-[#003527] text-[#003527] opacity-100' 
                  : 'border-transparent text-slate-500 opacity-60 hover:opacity-100'
              }`}
            >
              <Icon 
                size={22} 
                className={`transition-transform group-hover:scale-110 ${
                  isSelected ? 'text-[#003527]' : 'text-slate-500'
                }`} 
              />
              <span className="text-xs font-semibold tracking-wider">{cat.name}</span>
            </button>
          );
        })}
      </div>

      {/* Curated Escapes Grid */}
      <section className="flex flex-col gap-8">
        <div className="flex justify-between items-end">
          <div>
            <h2 className="text-2xl font-bold text-[#131b2e] tracking-tight">Curated Escapes</h2>
            <p className="text-slate-500 text-sm mt-1">Exceptional properties prepared for autonomous checks.</p>
          </div>
          <span className="text-xs font-bold text-[#003527] uppercase tracking-wider">
            {filteredListings.length} properties found
          </span>
        </div>

        {filteredListings.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {filteredListings.map((item) => (
              <Link key={item.id} href={`/listings/${item.id}`} className="group cursor-pointer">
                <div className="flex flex-col h-full bg-white rounded-3xl overflow-hidden border border-[#eaedff] ambient-lift shadow-sm hover:shadow-md transition-all duration-300">
                  <div className="relative aspect-[4/5] w-full overflow-hidden bg-slate-100">
                    <img
                      src={item.images?.[0] || 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750'}
                      alt={item.title}
                      className="object-cover h-full w-full transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur-md text-[10px] font-bold px-3 py-1 rounded-full text-[#064e3b] border border-[#eaedff] flex items-center gap-1">
                      <MapPin size={10} /> {item.city}, {item.country}
                    </div>
                    <button className="absolute top-4 right-4 bg-white/20 backdrop-blur-md p-2 rounded-full hover:bg-white/40 active:scale-90 transition-all text-white">
                      <Heart size={16} />
                    </button>
                  </div>
                  
                  <div className="p-5 flex flex-col justify-between flex-grow gap-4">
                    <div className="flex flex-col gap-1 text-left">
                      <h3 className="text-base font-bold text-[#131b2e] line-clamp-1 group-hover:text-[#003527] transition-colors">{item.title}</h3>
                      <p className="text-slate-400 text-xs line-clamp-2 leading-relaxed">{item.description}</p>
                    </div>

                    <div className="flex justify-between items-center pt-3 border-t border-[#eaedff]">
                      <div className="flex flex-col text-left">
                        <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Per Night</span>
                        <span className="text-base font-extrabold text-[#131b2e]">
                          {parseFloat(item.pricePerNightUsdt).toFixed(0)} <span className="text-[#064e3b] text-xs font-semibold">USDT</span>
                        </span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Deposit (Locked)</span>
                        <span className="text-xs font-bold text-slate-600">
                          {parseFloat(item.securityDepositUsdt).toFixed(0)} USDT
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-white border border-[#eaedff] rounded-3xl flex flex-col items-center justify-center gap-2">
            <Compass size={40} className="text-slate-300" />
            <h3 className="text-lg font-bold text-[#131b2e]">No properties match search criteria</h3>
            <p className="text-slate-400 text-sm">Try modifying your query or selecting another category.</p>
          </div>
        )}
      </section>
    </div>
  );
}
