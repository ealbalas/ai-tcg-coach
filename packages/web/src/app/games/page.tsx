'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { listGames, uploadGame, type GameSummary } from '@/lib/api';
import { isLoggedIn, logout, getEmail } from '@/lib/auth';

function statusBadge(status: string) {
  if (status === 'done') {
    return <span className="text-xs bg-violet-900 text-violet-300 px-2 py-0.5 rounded-full">AI Coached</span>;
  }
  if (status === 'heuristic_complete') {
    return <span className="text-xs bg-green-900 text-green-300 px-2 py-0.5 rounded-full">Coached</span>;
  }
  if (status === 'analyzing') {
    return <span className="text-xs bg-blue-900 text-blue-300 px-2 py-0.5 rounded-full">Analyzing...</span>;
  }
  if (status === 'pending') {
    return <span className="text-xs bg-yellow-900 text-yellow-300 px-2 py-0.5 rounded-full">Pending</span>;
  }
  if (status === 'error') {
    return <span className="text-xs bg-red-900 text-red-300 px-2 py-0.5 rounded-full">Error</span>;
  }
  return <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">{status}</span>;
}

function resultBadge(result: string) {
  if (result === 'win') return <span className="text-green-400 font-medium">Win</span>;
  if (result === 'loss') return <span className="text-red-400 font-medium">Loss</span>;
  return <span className="text-gray-400">Unknown</span>;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

export default function GamesPage() {
  const router = useRouter();
  const [games, setGames] = useState<GameSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace('/');
      return;
    }
    fetchGames();
  }, [router]);

  async function fetchGames() {
    try {
      const data = await listGames();
      setGames(data.games);
    } catch {
      // token may be expired
    } finally {
      setLoading(false);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError('');
    setUploading(true);
    try {
      await uploadGame(file);
      await fetchGames();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function handleLogout() {
    logout();
    router.push('/');
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-800 bg-gray-900">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">AI TCG Coach</h1>
          <div className="flex items-center gap-4">
            <Link href="/cards" className="text-sm text-gray-400 hover:text-white transition-colors">
              Card Database
            </Link>
            <span className="text-sm text-gray-400">{getEmail()}</span>
            <button onClick={handleLogout} className="text-sm text-gray-400 hover:text-white transition-colors">
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Game History</h2>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {uploading ? 'Uploading...' : 'Upload a game'}
            </button>
          </div>
        </div>

        {uploadError && (
          <div className="mb-4 text-red-400 text-sm bg-red-950 border border-red-800 rounded-lg px-4 py-3">
            {uploadError}
          </div>
        )}

        {uploading && (
          <div className="mb-4 text-blue-400 text-sm bg-blue-950 border border-blue-800 rounded-lg px-4 py-3">
            Parsing log and running heuristic analysis...
          </div>
        )}

        {loading ? (
          <div className="text-gray-400 text-center py-12">Loading...</div>
        ) : games.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-lg mb-2">No games uploaded yet</p>
            <p className="text-sm">Upload a .txt log file from OPTCGSim to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {games.map((game) => (
              <Link key={game.id} href={`/games/${game.id}`}>
                <div className="bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-xl px-5 py-4 transition-colors cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div>
                        <div className="text-sm font-medium text-white">
                          {game.my_leader_card_id ?? 'Unknown'} vs {game.opp_leader_card_id ?? 'Unknown'}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {formatDate(game.uploaded_at)}
                          {game.went_first != null && (
                            <span className="ml-2">- Went {game.went_first ? 'first' : 'second'}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {resultBadge(game.result)}
                      {statusBadge(game.coaching_status)}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
