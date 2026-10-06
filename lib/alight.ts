import type {
  AlightMeta,
  ApiResponse,
  AudioResult,
  Catalog,
  CatalogItem,
  XmlResult
} from './types';

export const BASE_URL = 'https://am.zervida.my.id';

const HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  Referer: `${BASE_URL}/runtime/preset.html`,
  Origin: BASE_URL
};

class UpstreamError extends Error {}

async function upstream(path: string, params?: Record<string, string>): Promise<Response> {
  const url = new URL(path, BASE_URL);
  if (params) {
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  }

  const res = await fetch(url, {
    headers: HEADERS,
    cache: 'no-store',
    signal: AbortSignal.timeout(30000)
  });

  if (!res.ok) {
    let message = `Server sumber merespons ${res.status}.`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {}
    throw new UpstreamError(message);
  }

  return res;
}

async function upstreamJson<T extends { error?: string }>(
  path: string,
  params?: Record<string, string>
): Promise<T> {
  const res = await upstream(path, params);
  const data = (await res.json()) as T;
  if (data.error) throw new UpstreamError(data.error);
  return data;
}

function fail(err: unknown, fallback: string): { status: false; message: string } {
  const message = err instanceof Error && err.message ? err.message : fallback;
  return { status: false, message };
}

export function parseAlightXml(xml: string): AlightMeta | null {
  if (!xml || typeof xml !== 'string') return null;

  const meta: AlightMeta = {
    title: 'Tanpa judul',
    width: 1080,
    height: 1920,
    exportWidth: 1080,
    exportHeight: 1920,
    fps: 30,
    totalTimeMs: 0,
    durationFormatted: '00:00',
    backgroundColor: '#000000',
    bookmarksCount: 0,
    mediaList: []
  };

  const attr = (source: string, key: string): string | null => {
    const m = source.match(new RegExp(`${key}=["']([^"']+)["']`, 'i'));
    return m ? m[1] : null;
  };

  const scene = xml.match(/<scene\s+([^>]+)>/i);
  if (scene) {
    const attrs = scene[1];
    meta.title = attr(attrs, 'title') ?? meta.title;
    meta.width = parseInt(attr(attrs, 'width') ?? '1080', 10);
    meta.height = parseInt(attr(attrs, 'height') ?? '1920', 10);
    meta.exportWidth = parseInt(attr(attrs, 'exportWidth') ?? String(meta.width), 10);
    meta.exportHeight = parseInt(attr(attrs, 'exportHeight') ?? String(meta.height), 10);
    meta.fps = parseFloat(attr(attrs, 'fps') ?? '30');
    meta.totalTimeMs = parseInt(attr(attrs, 'totalTime') ?? '0', 10);
    meta.backgroundColor = attr(attrs, 'bgcolor') ?? meta.backgroundColor;

    if (meta.totalTimeMs > 0) {
      const total = Math.floor(meta.totalTimeMs / 1000);
      const min = String(Math.floor(total / 60)).padStart(2, '0');
      const sec = String(total % 60).padStart(2, '0');
      meta.durationFormatted = `${min}:${sec}`;
    }
  }

  meta.bookmarksCount = (xml.match(/<bookmark\s+t=["'](\d+)["']/gi) ?? []).length;

  const mediaRegex = /<media\s+([^>]+)\/>/gi;
  let match: RegExpExecArray | null;
  while ((match = mediaRegex.exec(xml)) !== null) {
    const attrs = match[1];
    const w = attr(attrs, 'width');
    const h = attr(attrs, 'height');
    meta.mediaList.push({
      uri: attr(attrs, 'uri'),
      filename: attr(attrs, 'filename') ?? attr(attrs, 'title'),
      type: attr(attrs, 'type'),
      width: w ? parseInt(w, 10) : undefined,
      height: h ? parseInt(h, 10) : undefined
    });
  }

  return meta;
}

function normalizeProjects(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  return list.map((item) => {
    if (typeof item === 'string') return item;
    if (item && typeof item === 'object') {
      const o = item as Record<string, unknown>;
      return String(o.name ?? o.title ?? o.id ?? JSON.stringify(item));
    }
    return String(item);
  });
}

function normalizeItems(list: unknown): CatalogItem[] {
  if (!Array.isArray(list)) return [];
  return list.map((item) => {
    const o = (item ?? {}) as Record<string, unknown>;
    return {
      name: String(o.name ?? ''),
      size: typeof o.size === 'number' || typeof o.size === 'string' ? o.size : undefined
    };
  });
}

export async function listPresets(): Promise<ApiResponse<Catalog>> {
  try {
    const data = await upstreamJson<{
      error?: string;
      presets?: unknown;
      audio?: unknown;
      images?: unknown;
    }>('/api/presets');

    return {
      status: true,
      result: {
        presets: normalizeItems(data.presets),
        audio: normalizeItems(data.audio),
        images: normalizeItems(data.images)
      }
    };
  } catch (err) {
    return fail(err, 'Katalog preset tidak bisa dimuat.');
  }
}

export async function fetchPresetFile(name: string): Promise<Response> {
  return upstream(`/preset/${encodeURIComponent(name)}`);
}

export async function resolveAlightLink(
  url: string,
  project?: string
): Promise<ApiResponse<XmlResult>> {
  try {
    if (!url) throw new UpstreamError('Link Alight Motion wajib diisi.');

    const params: Record<string, string> = { url };
    if (project) params.project = project;

    const data = await upstreamJson<{
      error?: string;
      xml?: string;
      xmlName?: string;
      projects?: unknown;
      media?: unknown;
    }>('/api/project-xml', params);

    return {
      status: true,
      result: {
        name: data.xmlName ?? 'project.xml',
        xml: data.xml ?? '',
        metadata: data.xml ? parseAlightXml(data.xml) : null,
        availableProjects: normalizeProjects(data.projects),
        mediaCount: Array.isArray(data.media) ? data.media.length : 0
      }
    };
  } catch (err) {
    return fail(err, 'Link Alight Motion tidak bisa dibuka.');
  }
}

export async function fetchDrivePreset(url: string): Promise<ApiResponse<XmlResult>> {
  try {
    if (!url) throw new UpstreamError('Link Google Drive wajib diisi.');

    const data = await upstreamJson<{ error?: string; xml?: string; name?: string }>(
      '/api/drive-xml',
      { url }
    );

    return {
      status: true,
      result: {
        name: data.name ?? 'drive_preset.xml',
        xml: data.xml ?? '',
        metadata: data.xml ? parseAlightXml(data.xml) : null,
        availableProjects: [],
        mediaCount: 0
      }
    };
  } catch (err) {
    return fail(err, 'Preset dari Google Drive tidak bisa diambil.');
  }
}

export async function getTikTokAudio(url: string): Promise<ApiResponse<AudioResult>> {
  try {
    if (!url) throw new UpstreamError('Link TikTok wajib diisi.');

    const data = await upstreamJson<{ error?: string; media?: string }>('/api/tiktok', { url });

    return {
      status: true,
      result: { originalUrl: url, audioUrl: data.media ?? null }
    };
  } catch (err) {
    return fail(err, 'Audio TikTok tidak bisa diambil.');
  }
}
