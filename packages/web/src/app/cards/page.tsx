'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getCards, type CardEntry } from '@/lib/api';
import { isLoggedIn } from '@/lib/auth';

const TYPE_FILTERS = ['All', 'Leader', 'Character', 'Event', 'Stage', 'DON!!'];

function typeBadgeClass(type: string | null): string {
  switch (type?.toLowerCase()) {
    case 'leader': return 'bg-yellow-900 text-yellow-300';
    case 'character': return 'bg-blue-900 text-blue-300';
    case 'event': return 'bg-purple-900 text-purple-300';
    case 'stage': return 'bg-green-900 text-green-300';
    case 'don!!': return 'bg-red-900 text-red-300';
    default: return 'bg-gray-700 text-gray-300';
  }
}

function CardRow({ card }: { card: CardEntry }) {
  const [expanded, setExpanded] = useState(false);
  const hasEffect = card.effect && card.effect.length > 0;
  const effectPreview = card.effect && card.effect.length > 80
    ? card.effect.slice(0, 80) + '...'
    : card.effect;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl px-3 py-3 hover:border-gray-700 transition-colors">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-[56px] h-[78px] rounded overflow-hidden bg-gray-800">
          {card.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={card.image}
              alt={card.name}
              width={56}
              height={78}
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="w-full h-full bg-gray-700" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-white text-sm">{card.name}</span>
                {card.type && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeBadgeClass(card.type)}`}>
                    {card.type}
                  </span>
                )}
              </div>
              <span className="font-mono text-xs text-gray-500 mt-0.5 block">{card.id}</span>
            </div>

            <div className="flex items-center gap-4 text-sm flex-shrink-0">
              {card.cost != null && (
                <div className="text-center">
                  <div className="text-xs text-gray-500">Cost</div>
                  <div className="text-white font-mono">{card.cost}</div>
                </div>
              )}
              {card.power != null && (
                <div className="text-center">
                  <div className="text-xs text-gray-500">Power</div>
                  <div className="text-white font-mono">{card.power.toLocaleString()}</div>
                </div>
              )}
              {card.color && (
                <div className="text-center">
                  <div className="text-xs text-gray-500">Color</div>
                  <div className="text-white text-xs">{card.color}</div>
                </div>
              )}
              {card.attribute && (
                <div className="text-center">
                  <div className="text-xs text-gray-500">Attr</div>
                  <div className="text-white text-xs">{card.attribute}</div>
                </div>
              )}
            </div>
          </div>

          {hasEffect && (
            <div className="mt-2 text-xs text-gray-400">
              {expanded ? card.effect : effectPreview}
              {card.effect && card.effect.length > 80 && (
                <button
                  onClick={() => setExpanded((v) => !v)}
                  className="ml-1 text-blue-400 hover:text-blue-300 transition-colors"
                >
                  {expanded ? 'less' : 'more'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CardsPage() {
  const router = useRouter();
  const [allCards, setAllCards] = useState<CardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [selectedType, setSelectedType] = useState('All');

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

  const filtered = useMemo(() => {
    let result = allCards;
    if (query) {
      const lower = query.toLowerCase();
      result = result.filter((c) => c.name.toLowerCase().includes(lower));
    }
    if (selectedType !== 'All') {
      const lower = selectedType.toLowerCase();
      result = result.filter((c) => c.type != null && c.type.toLowerCase() === lower);
    }
    return result;
  }, [allCards, query, selectedType]);

  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-800 bg-gray-900">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">AI TCG Coach</h1>
          <nav className="flex items-center gap-4">
            <Link href="/games" className="text-sm text-gray-400 hover:text-white transition-colors">
              Game History
            </Link>
            <span className="text-sm text-white font-medium">Card Database</span>
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-1">Card Database</h2>
          <p className="text-sm text-gray-400">
            {loading ? 'Loading...' : `${filtered.length.toLocaleString()} card${filtered.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="text"
            placeholder="Search by card name..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
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

        {loading ? (
          <div className="text-gray-400 text-center py-16">Loading cards...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-lg mb-2">No cards found</p>
            <p className="text-sm">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((card) => (
              <CardRow key={card.id} card={card} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
