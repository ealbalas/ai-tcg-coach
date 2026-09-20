'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getCards, type CardEntry } from '@/lib/api';
import { isLoggedIn } from '@/lib/auth';
import { filterCards } from '@/lib/cardFilter';
import { cardImageUrl, groupCardsByBase, parseCardId, type CardWithParallels } from '@/lib/cardUtils';
import {
  CardPopup,
  CardTile,
  CardPlaceholder,
  typeBadgeClass,
  COLOR_ACTIVE,
  COLOR_INACTIVE,
} from './components';

const TYPE_FILTERS = ['All', 'Leader', 'Character', 'Event', 'Stage', 'DON!!'];
const COLORS = ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Black'];

function CardDetailModal({ card, onClose }: { card: CardWithParallels; onClose: () => void }) {
  const [activeId, setActiveId] = useState<string>(card.id);

  const allVersions: { card: CardEntry; label: string }[] = [
    { card, label: 'Base' },
    ...card.parallels.map((p, i) => ({ card: p, label: `P${i + 1}` })),
  ];

  const activeVersion = allVersions.find(({ card: v }) => v.id === activeId)?.card ?? card;
  const activeImgSrc = cardImageUrl(activeVersion.image, activeVersion.id);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 rounded-2xl border border-gray-700 max-w-lg w-full p-4 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-white font-bold text-base leading-tight">{card.name}</h3>
            {(() => {
              const parsed = parseCardId(card.id);
              return parsed ? (
                <p className="text-gray-500 text-xs font-mono mt-0.5">
                  {parsed.set} #{parsed.num}
                </p>
              ) : null;
            })()}
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors text-lg leading-none flex-shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Main image */}
        <div className="flex gap-4">
          <div className="flex-1 rounded-lg overflow-hidden bg-gray-800 aspect-[7/10] max-w-[200px]">
            {activeImgSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={activeImgSrc} alt={card.name} className="w-full h-full object-cover" />
            ) : (
              <CardPlaceholder />
            )}
          </div>

          {/* Parallel thumbnails - only shown when there are parallels */}
          {card.parallels.length > 0 && (
            <div className="flex flex-col gap-2 overflow-y-auto max-h-64">
              {allVersions.map(({ card: v, label }) => {
                const src = cardImageUrl(v.image, v.id);
                const isActive = activeId === v.id;
                return (
                  <button
                    key={v.id}
                    onClick={() => setActiveId(v.id)}
                    className={`relative rounded-lg overflow-hidden border-2 transition-colors flex-shrink-0 w-16 aspect-[7/10] ${
                      isActive ? 'border-blue-500' : 'border-gray-700 hover:border-gray-500'
                    }`}
                  >
                    {src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={src} alt={label} className="w-full h-full object-cover" />
                    ) : (
                      <CardPlaceholder />
                    )}
                    <span className="absolute bottom-0 left-0 right-0 text-center text-[9px] bg-black/70 text-white py-0.5">
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Card details */}
        <div className="flex flex-wrap gap-1.5 text-xs">
          {card.type && (
            <span className={`px-2 py-0.5 rounded-full font-medium ${typeBadgeClass(card.type)}`}>
              {card.type}
            </span>
          )}
          {card.attribute && (
            <span className="px-2 py-0.5 rounded-full bg-gray-700 text-gray-300">
              {card.attribute}
            </span>
          )}
          {card.cost != null && (
            <span className="px-2 py-0.5 rounded bg-gray-800 text-gray-300 font-mono">
              Cost {card.cost}
            </span>
          )}
          {card.power != null && (
            <span className="px-2 py-0.5 rounded bg-gray-800 text-gray-300 font-mono">
              {(card.power / 1000).toFixed(0)}k
            </span>
          )}
          {card.color && (
            <span className="px-2 py-0.5 rounded bg-gray-800 text-gray-300">
              {card.color}
            </span>
          )}
        </div>

        {card.effect && (
          <p className="text-gray-300 text-xs leading-relaxed border-t border-gray-800 pt-3">
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
  const [selectedCard, setSelectedCard] = useState<CardWithParallels | null>(null);
  const [hoveredCard, setHoveredCard] = useState<CardWithParallels | null>(null);

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

  const groupedCards = useMemo(() => groupCardsByBase(allCards), [allCards]);

  const filtered = useMemo(
    () => filterCards(groupedCards, debouncedQuery, selectedType, selectedColor),
    [groupedCards, debouncedQuery, selectedType, selectedColor],
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

  function handleCardHover(card: CardWithParallels) {
    setHoveredCard(card);
  }

  function handleCardLeave() {
    setHoveredCard(null);
  }

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
              <CardTile
                key={card.id}
                card={card}
                onClick={() => setSelectedCard(card)}
                onHover={handleCardHover}
                onLeave={handleCardLeave}
              />
            ))}
          </div>
        )}
      </main>

      <CardPopup hoveredCard={hoveredCard} />

      {selectedCard && (
        <CardDetailModal card={selectedCard} onClose={() => setSelectedCard(null)} />
      )}
    </div>
  );
}
