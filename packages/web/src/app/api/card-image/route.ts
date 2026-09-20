import { type NextRequest, NextResponse } from 'next/server';

const VALID_ID = /^[A-Z0-9]+-[0-9]+(_[pr][0-9]+)?$/i;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const id = request.nextUrl.searchParams.get('id');

  if (!id || !VALID_ID.test(id)) {
    return new NextResponse(null, { status: 400 });
  }

  const urls = [
    `https://en.onepiece-cardgame.com/images/cardlist/card/${id}.png`,
    `https://asia-en.onepiece-cardgame.com/images/cardlist/card/${id}.png`,
  ];

  for (const url of urls) {
    try {
      const upstream = await fetch(url);
      if (upstream.ok) {
        return new NextResponse(upstream.body, {
          headers: {
            'content-type': 'image/png',
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
