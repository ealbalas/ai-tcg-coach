'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getCards, type CardEntry } from '@/lib/api';
import { isLoggedIn } from '@/lib/auth';
import { filterCards } from '@/lib/cardFilter';
import { cardImageUrl, groupCardsByBase, parseCardId, type CardWithParallels } from '@/lib/cardUtils';

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

export interface PopupPosition {
  top: number;
  left: number;
}

export interface CardPopupProps {
  hoveredCard: CardWithParallels | null;
  position: PopupPosition | null;
}

export function CardPopup({ hoveredCard, position }: CardPopupProps) {
  if (!hoveredCard || !position) return null;

  const card = hoveredCard;
  const imgSrc = cardImageUrl(card.image, card.id);
  const parsed = parseCardId(card.id);

  return (
    <div
      data-testid="card-popup"
      className="fixed z-50 pointer-events-none"
      style={{
        top: position.top,
        left: position.left,
        width: 280,
      }}
    >
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden flex flex-col gap-3 p-3">
        {/* Full card image */}
        <div className="rounded-lg overflow-hidden bg-gray-800" style={{ aspectRatio: '7/10', width: '100%' }}>
          {imgSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imgSrc} alt={card.name} className="w-full h-full object-cover" />
          ) : (
            <CardPlaceholder />
          )}
        </div>

        {/* Card name + set badge */}
        <div>
          <p className="text-white font-bold text-sm leading-tight">{card.name}</p>
          {parsed && (
            <p className="text-gray-500 text-xs font-mono mt-0.5">
              {parsed.set} <span className="text-gray-600">· #{parsed.num}</span>
            </p>
          )}
        </div>

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
              Cost {card.cost}
            </span>
          )}
          {card.power != null && (
            <span className="text-[10px] bg-gray-800 text-gray-300 px-1.5 py-0.5 rounded font-mono leading-none">
              {(card.power / 1000).toFixed(0)}k
            </span>
          )}
          <ColorDots color={card.color} />
        </div>

        {/* Full effect text - not truncated */}
        {card.effect && (
          <p data-testid="popup-effect" className="text-xs text-gray-300 leading-relaxed whitespace-pre-line">
            {card.effect}
          </p>
        )}

        {/* Parallel thumbnails */}
        {card.parallels.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap border-t border-gray-800 pt-2">
            {card.parallels.map((p) => {
              const src = cardImageUrl(p.image, p.id);
              return (
                <div key={p.id} className="w-10 rounded overflow-hidden bg-gray-800 flex-shrink-0" style={{ aspectRatio: '7/10' }}>
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={src} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <CardPlaceholder />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function CardTile({
  card,
  onClick,
  onHover,
  onLeave,
}: {
  card: CardWithParallels;
  onClick: () => void;
  onHover?: (card: CardWithParallels, rect: DOMRect) => void;
  onLeave?: () => void;
}) {
  const hasEffect = Boolean(card.effect);
  const imgSrc = cardImageUrl(card.image, card.id);
  const parsed = parseCardId(card.id);

  function handleMouseEnter(e: React.MouseEvent<HTMLDivElement>) {
    if (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) return;
    onHover?.(card, (e.currentTarget as HTMLDivElement).getBoundingClientRect());
  }

  return (
    <div
      data-testid="card-tile"
      className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-gray-600 transition-colors flex flex-col cursor-pointer"
      style={{ aspectRatio: '7/10' }}
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={onLeave}
    >
      {/* Image - top 60% */}
      <div className="relative flex-none overflow-hidden" style={{ height: '60%' }}>
        {imgSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imgSrc}
            alt={card.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <CardPlaceholder />
        )}
        {card.parallels.length > 0 && (
          <div className="absolute top-1.5 right-1.5 bg-black/70 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">
            P{card.parallels.length}
          </div>
        )}
      </div>

      {/* Info - bottom 40% */}
      <div className="flex flex-col p-2 gap-1 overflow-hidden" style={{ height: '40%' }}>
        {/* Name */}
        <p className="font-semibold text-white text-xs leading-tight truncate" title={card.name}>
          {card.name}
        </p>

        {/* Set + number */}
        {parsed && (
          <p className="text-[10px] text-gray-500 leading-none font-mono">
            {parsed.set} <span className="text-gray-600">#{parsed.num}</span>
          </p>
        )}

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

const POPUP_WIDTH = 280;
const POPUP_APPROX_HEIGHT = 520;

function computePopupPosition(rect: DOMRect): PopupPosition {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;

  const isRightSide = rect.left / vw > 0.6;
  const rawLeft = isRightSide ? rect.left - POPUP_WIDTH - 8 : rect.right + 8;
  const left = Math.max(8, Math.min(rawLeft, vw - POPUP_WIDTH - 8));

  const rawTop = rect.top;
  const top = Math.max(8, Math.min(rawTop, vh - POPUP_APPROX_HEIGHT - 8));

  return { top, left };
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
  const [popupPos, setPopupPos] = useState<PopupPosition | null>(null);

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

  function handleCardHover(card: CardWithParallels, rect: DOMRect) {
    setHoveredCard(card);
    setPopupPos(computePopupPosition(rect));
  }

  function handleCardLeave() {
    setHoveredCard(null);
    setPopupPos(null);
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

      <CardPopup hoveredCard={hoveredCard} position={popupPos} />

      {selectedCard && (
        <CardDetailModal card={selectedCard} onClose={() => setSelectedCard(null)} />
      )}
    </div>
  );
}
