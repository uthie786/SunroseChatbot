import { after, NextResponse, type NextRequest } from 'next/server';
import { handleEvent } from '@/lib/handler';

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
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'sunrose-chatbot',
    mode: process.env.BOT_MODE === 'live' ? 'live' : 'mock',
  });
}
