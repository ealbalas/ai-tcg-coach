'use client';

import { cardImageUrl, parseCardId, type CardWithParallels } from '@/lib/cardUtils';

export const COLOR_ACTIVE: Record<string, string> = {
  Red: 'bg-red-600 text-white',
  Blue: 'bg-blue-600 text-white',
  Green: 'bg-green-600 text-white',
  Yellow: 'bg-yellow-400 text-gray-900',
  Purple: 'bg-purple-600 text-white',
  Black: 'bg-gray-950 text-white border border-gray-500',
};

export const COLOR_INACTIVE: Record<string, string> = {
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

export function typeBadgeClass(type: string | null): string {
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

export function CardPlaceholder() {
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

export interface CardPopupProps {
  hoveredCard: CardWithParallels | null;
}

export function CardPopup({ hoveredCard }: CardPopupProps) {
  if (!hoveredCard) return null;

  const card = hoveredCard;
  const imgSrc = cardImageUrl(card.image, card.id);
  const parsed = parseCardId(card.id);

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/60 pointer-events-none"
        aria-hidden="true"
      />
      <div
        data-testid="card-popup"
        className="fixed z-50 pointer-events-none"
        style={{
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 280,
          maxHeight: '90vh',
          overflowY: 'hidden',
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
    </>
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
  onHover?: (card: CardWithParallels) => void;
  onLeave?: () => void;
}) {
  const hasEffect = Boolean(card.effect);
  const imgSrc = cardImageUrl(card.image, card.id);
  const parsed = parseCardId(card.id);

  function handleMouseEnter() {
    if (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) return;
    onHover?.(card);
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
