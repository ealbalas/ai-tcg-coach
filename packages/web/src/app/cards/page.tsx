'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getCards, type CardEntry } from '@/lib/api';
import { isLoggedIn } from '@/lib/auth';
import { filterCards } from '@/lib/cardFilter';

const TYPE_FILTERS = ['All', 'Leader', 'Character', 'Event', 'Stage', 'DON!!'];
const COLORS = ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Black'];

const COLOR_ACTIVE: Record<string, string> = {
  Red: 'bg-red-600 text-white',
  Blue: 'bg-blue-600 text-white',
  Green: 'bg-green-600 text-white',
  Yellow: 'bg-yellow-400 text-gray-900',
  Purple: 'bg-purple-600 text-white',
  Black: 'bg-gray-950 text-white border border-gray-500',
};

const COLOR_INACTIVE: Record<string, string> = {
  Red: 'bg-red-900/40 text-red-300 hover:bg-red-900/70',
  Blue: 'bg-blue-900/40 text-blue-300 hover:bg-blue-900/70',
  Green: 'bg-green-900/40 text-green-300 hover:bg-green-900/70',
  Yellow: 'bg-yellow-900/40 text-yellow-300 hover:bg-yellow-900/70',
  Purple: 'bg-purple-900/40 text-purple-300 hover:bg-purple-900/70',
  Black: 'bg-gray-800 text-gray-400 hover:bg-gray-700 border border-gray-700',
};

const COLOR_DOT: Record<string, string> = {
  red: 'bg-red-500',
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  yellow: 'bg-yellow-400',
  purple: 'bg-purple-500',
  black: 'bg-gray-900 border border-gray-500',
};

function typeBadgeClass(type: string | null): string {
  switch (type?.toLowerCase()) {
    case 'leader':    return 'bg-yellow-900 text-yellow-300';
    case 'character': return 'bg-blue-900 text-blue-300';
    case 'event':     return 'bg-purple-900 text-purple-300';
    case 'stage':     return 'bg-green-900 text-green-300';
    case 'don!!':     return 'bg-red-900 text-red-300';
    default:          return 'bg-gray-700 text-gray-300';
  }
}

function ColorDots({ color }: { color: string | null }) {
  if (!color) return null;
  const parts = color.split('/').map((c) => c.trim().toLowerCase());
  return (
    <div className="flex items-center gap-0.5">
      {parts.map((c, i) => (
        <div
          key={i}
          className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${COLOR_DOT[c] ?? 'bg-gray-500'}`}
          title={c}
        />
      ))}
    </div>
  );
}

function CardPlaceholder() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-gray-800 to-gray-900">
      <svg viewBox="0 0 70 100" className="w-1/2 h-1/2 opacity-20" fill="none">
        <rect x="5" y="5" width="60" height="90" rx="6" stroke="currentColor" strokeWidth="2" />
        <circle cx="35" cy="40" r="16" stroke="currentColor" strokeWidth="2" />
        <path d="M35 24 L35 56 M19 40 L51 40" stroke="currentColor" strokeWidth="2" />
        <path d="M12 68 h46 M12 76 h30" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function CardTile({ card }: { card: CardEntry }) {
  const hasEffect = Boolean(card.effect);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-gray-600 transition-colors flex flex-col" style={{ aspectRatio: '7/10' }}>
      {/* Image - top 60% */}
      <div className="relative flex-none overflow-hidden" style={{ height: '60%' }}>
        {card.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={card.image}
            alt={card.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <CardPlaceholder />
        )}
      </div>

      {/* Info - bottom 40% */}
      <div className="flex flex-col p-2 gap-1 overflow-hidden" style={{ height: '40%' }}>
        {/* Name */}
        <p className="font-semibold text-white text-xs leading-tight truncate" title={card.name}>
          {card.name}
        </p>

        {/* Type + attribute badges */}
        <div className="flex items-center gap-1 flex-wrap">
          {card.type && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium leading-none ${typeBadgeClass(card.type)}`}>
              {card.type}
            </span>
          )}
          {card.attribute && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-700 text-gray-300 leading-none">
              {card.attribute}
            </span>
          )}
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-1.5">
          {card.cost != null && (
            <span className="text-[10px] bg-gray-800 text-gray-300 px-1.5 py-0.5 rounded font-mono leading-none">
              {card.cost}
            </span>
          )}
          {card.power != null && (
            <span className="text-[10px] bg-gray-800 text-gray-300 px-1.5 py-0.5 rounded font-mono leading-none">
              {(card.power / 1000).toFixed(0)}k
            </span>
          )}
          <ColorDots color={card.color} />
        </div>

        {/* Effect text - truncated with native hover tooltip for full text */}
        {hasEffect && (
          <p
            className="text-[10px] text-gray-400 leading-tight line-clamp-2 overflow-hidden"
            title={card.effect ?? undefined}
          >
            {card.effect}
          </p>
        )}
      </div>
    </div>
  );
}

function SkeletonTile() {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden animate-pulse flex flex-col" style={{ aspectRatio: '7/10' }}>
      <div className="bg-gray-800" style={{ height: '60%' }} />
      <div className="p-2 flex flex-col gap-2" style={{ height: '40%' }}>
        <div className="h-2.5 bg-gray-800 rounded w-3/4" />
        <div className="h-2 bg-gray-800 rounded w-1/2" />
        <div className="h-2 bg-gray-800 rounded w-2/3" />
        <div className="h-2 bg-gray-800 rounded w-full" />
        <div className="h-2 bg-gray-800 rounded w-5/6" />
      </div>
    </div>
  );
}

export default function CardsPage() {
  const router = useRouter();
  const [allCards, setAllCards] = useState<CardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedType, setSelectedType] = useState('All');
  const [selectedColor, setSelectedColor] = useState('All Colors');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace('/');
      return;
    }
    getCards()
      .then((data) => setAllCards(data.cards))
      .catch(() => setAllCards([]))
      .finally(() => setLoading(false));
  }, [router]);

  const filtered = useMemo(
    () => filterCards(allCards, debouncedQuery, selectedType, selectedColor),
    [allCards, debouncedQuery, selectedType, selectedColor],
  );

  function clearFilters() {
    setQuery('');
    setDebouncedQuery('');
    setSelectedType('All');
    setSelectedColor('All Colors');
  }

  const hasActiveFilters =
    selectedType !== 'All' || selectedColor !== 'All Colors' || debouncedQuery !== '';

  const filterSummaryParts: string[] = [];
  if (selectedType !== 'All') filterSummaryParts.push(selectedType);
  if (selectedColor !== 'All Colors') filterSummaryParts.push(selectedColor);
  if (debouncedQuery) filterSummaryParts.push(`"${debouncedQuery}"`);

  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-800 bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">AI TCG Coach</h1>
          <nav className="flex items-center gap-4">
            <Link href="/games" className="text-sm text-gray-400 hover:text-white transition-colors">
              Game History
            </Link>
            <span className="text-sm text-white font-medium">Card Database</span>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold mb-6">Card Database</h2>

        {/* Search */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search by card name..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full sm:max-w-sm bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        {/* Type filters */}
        <div className="mb-3 flex flex-wrap gap-2">
          {TYPE_FILTERS.map((type) => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
                selectedType === type
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        {/* Color filters */}
        <div className="mb-6 flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedColor('All Colors')}
            className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
              selectedColor === 'All Colors'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
            }`}
          >
            All Colors
          </button>
          {COLORS.map((color) => (
            <button
              key={color}
              onClick={() => setSelectedColor(color)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
                selectedColor === color
                  ? `${COLOR_ACTIVE[color]} ring-2 ring-white/30`
                  : COLOR_INACTIVE[color]
              }`}
            >
              {color}
            </button>
          ))}
        </div>

        {/* Active filter summary */}
        {!loading && (
          <div className="mb-4 text-sm text-gray-400">
            Showing {filtered.length.toLocaleString()} card{filtered.length !== 1 ? 's' : ''}
            {filterSummaryParts.length > 0 && (
              <span className="text-gray-500"> · {filterSummaryParts.join(' · ')}</span>
            )}
          </div>
        )}

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {Array.from({ length: 15 }).map((_, i) => (
              <SkeletonTile key={i} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-lg mb-2">No cards found</p>
            <p className="text-sm mb-4">Try adjusting your search or filters</p>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-sm px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {filtered.map((card) => (
              <CardTile key={card.id} card={card} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
