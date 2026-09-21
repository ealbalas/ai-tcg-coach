import { type NextRequest, NextResponse } from 'next/server';

const VALID_ID = /^[A-Z0-9]+-[0-9]+(_[pr][0-9]+)?$/i;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const id = request.nextUrl.searchParams.get('id');

  if (!id || !VALID_ID.test(id)) {
    return new NextResponse(null, { status: 400 });
  }

  const set = /^([A-Z0-9]+)-/i.exec(id)?.[1] ?? id;

  const sources = [
    { url: `https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/one-piece/${set}/${id}_EN.webp`, type: 'image/webp' },
    { url: `https://en.onepiece-cardgame.com/images/cardlist/card/${id}.png`, type: 'image/png' },
    { url: `https://asia-en.onepiece-cardgame.com/images/cardlist/card/${id}.png`, type: 'image/png' },
  ];

  for (const { url, type } of sources) {
    try {
      const upstream = await fetch(url);
      if (upstream.ok) {
        return new NextResponse(upstream.body, {
          headers: {
            'content-type': type,
            'cache-control': 'public, max-age=86400',
          },
        });
      }
    } catch {
      // try next URL
    }
  }
  return new NextResponse(null, { status: 404 });
}
