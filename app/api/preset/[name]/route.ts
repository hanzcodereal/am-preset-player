import { NextResponse } from 'next/server';
import { fetchPresetFile } from '@/lib/alight';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const fileName = decodeURIComponent(name);

  try {
    const upstream = await fetchPresetFile(fileName);
    const body = await upstream.arrayBuffer();
    const safeName = fileName.replace(/[^\w.\- ]/g, '_');

    return new NextResponse(body, {
      headers: {
        'Content-Type': upstream.headers.get('content-type') ?? 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${safeName}"`
      }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'File tidak ditemukan.';
    return NextResponse.json({ status: false, message }, { status: 404 });
  }
  }
