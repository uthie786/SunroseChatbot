import { after, NextResponse, type NextRequest } from 'next/server';
import { handleEvent } from '@/lib/handler';
import { listIds } from '@/lib/chatwoot';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Chatwoot Agent Bot webhook.
// URL to paste into Chatwoot: https://<your-app>.vercel.app/api/chatwoot?secret=<WEBHOOK_SECRET>
export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret');
  if (!process.env.WEBHOOK_SECRET || secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false }, { status: 400 });

  // Answer Chatwoot straight away, then do the slow work (waiting, Claude) in the background.
  after(async () => {
    try {
      await handleEvent(body);
    } catch (err) {
      console.error('[bot] unhandled error', err);
    }
  });

  return NextResponse.json({ ok: true });
}

// Visit /api/chatwoot in a browser to check the deployment is alive.
// Visit /api/chatwoot?secret=<WEBHOOK_SECRET>&list=ids to see agent, team and inbox IDs.
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret');
  if (req.nextUrl.searchParams.get('list') === 'ids') {
    if (!process.env.WEBHOOK_SECRET || secret !== process.env.WEBHOOK_SECRET) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
    return NextResponse.json(await listIds());
  }
  return NextResponse.json({
    ok: true,
    service: 'sunrose-chatbot',
    mode: process.env.BOT_MODE === 'live' ? 'live' : 'mock',
  });
}
