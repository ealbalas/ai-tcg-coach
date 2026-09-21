'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { getReplay, type ReplayResponse } from '@/lib/api';
import { isLoggedIn } from '@/lib/auth';
import { ReplayBoard } from './ReplayBoard';

export default function ReplayPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [replay, setReplay] = useState<ReplayResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace('/');
      return;
    }
    getReplay(id)
      .then(setReplay)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        Loading replay...
      </div>
    );
  }

  if (error || !replay) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error || 'Replay not available'}</p>
          <Link href={`/games/${id}`} className="text-blue-400 hover:underline">
            Back to game
          </Link>
        </div>
      </div>
    );
  }

  if (replay.turns.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 mb-4">No turns recorded for this game.</p>
          <Link href={`/games/${id}`} className="text-blue-400 hover:underline">
            Back to game
          </Link>
        </div>
      </div>
    );
  }

  const totalTurns = replay.turns.length;
  const currentTurn = replay.turns[currentTurnIndex];

  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-800 bg-gray-900">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link
            href={`/games/${id}`}
            className="text-gray-400 hover:text-white transition-colors text-sm"
          >
            - Back to game
          </Link>
          <h1 className="text-xl font-bold text-white">Game Replay</h1>
          <div className="flex items-center gap-2 ml-auto text-sm text-gray-400">
            <span className="text-blue-400 font-medium">{replay.player1Username}</span>
            <span>vs</span>
            <span className="text-red-400 font-medium">{replay.player2Username}</span>
            {replay.winner && (
              <span className="ml-2 px-2 py-0.5 bg-green-900 border border-green-700 text-green-300 rounded-full text-xs">
                Winner: {replay.winner}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Turn selector */}
        <div className="mb-4 flex items-center gap-3 overflow-x-auto pb-2">
          {replay.turns.map((t, i) => (
            <button
              key={i}
              onClick={() => setCurrentTurnIndex(i)}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                i === currentTurnIndex
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              T{t.turn} P{t.activePlayer}
            </button>
          ))}
        </div>

        <ReplayBoard
          turn={currentTurn}
          currentTurnIndex={currentTurnIndex}
          totalTurns={totalTurns}
          onPrev={() => setCurrentTurnIndex((i) => Math.max(0, i - 1))}
          onNext={() => setCurrentTurnIndex((i) => Math.min(totalTurns - 1, i + 1))}
        />
      </main>
    </div>
  );
}
