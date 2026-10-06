import { NextResponse, type NextRequest } from 'next/server';
import { getTikTokAudio } from '@/lib/alight';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url') ?? '';
  const data = await getTikTokAudio(url.trim());
  return NextResponse.json(data, { status: data.status ? 200 : 400 });
}
