import { NextResponse, type NextRequest } from 'next/server';
import { fetchDrivePreset } from '@/lib/alight';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url') ?? '';
  const data = await fetchDrivePreset(url.trim());
  return NextResponse.json(data, { status: data.status ? 200 : 400 });
}
