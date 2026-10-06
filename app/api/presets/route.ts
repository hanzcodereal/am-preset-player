import { NextResponse } from 'next/server';
import { listPresets } from '@/lib/alight';

export const dynamic = 'force-dynamic';

export async function GET() {
  const data = await listPresets();
  return NextResponse.json(data, { status: data.status ? 200 : 502 });
}
