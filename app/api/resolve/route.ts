import { NextResponse, type NextRequest } from 'next/server';
import { resolveAlightLink } from '@/lib/alight';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url') ?? '';
  const project = req.nextUrl.searchParams.get('project') ?? undefined;
  const data = await resolveAlightLink(url.trim(), project);
  return NextResponse.json(data, { status: data.status ? 200 : 400 });
    }
