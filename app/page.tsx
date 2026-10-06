'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  AlightMeta,
  ApiResponse,
  AudioResult,
  Catalog,
  CatalogItem,
  XmlResult
} from '@/lib/types';

type TabId = 'katalog' | 'link' | 'drive' | 'tiktok';

const TABS: { id: TabId; label: string }[] = [
  { id: 'katalog', label: 'Katalog' },
  { id: 'link', label: 'Link Alight' },
  { id: 'drive', label: 'Google Drive' },
  { id: 'tiktok', label: 'Audio TikTok' }
];

async function api<T>(path: string, params?: Record<string, string>): Promise<T> {
  const qs = params ? `?${new URLSearchParams(params).toString()}` : '';
  const res = await fetch(`/api/${path}${qs}`);
  const json = (await res.json()) as ApiResponse<T>;
  if (!json.status) throw new Error(json.message);
  return json.result;
}

function saveXml(name: string, xml: string) {
  const blob = new Blob([xml], { type: 'application/xml' });
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = name.toLowerCase().endsWith('.xml') ? name : `${name}.xml`;
  a.click();
  URL.revokeObjectURL(href);
}

function formatSize(size?: number | string): string {
  if (size === undefined || size === '') return '';
  if (typeof size === 'string') return size;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function Facts({ meta, mediaCount }: { meta: AlightMeta; mediaCount: number }) {
  const media = meta.mediaList.length || mediaCount;
  const items: [string, string][] = [
    ['Resolusi', `${meta.width} × ${meta.height}`],
    ['Ekspor', `${meta.exportWidth} × ${meta.exportHeight}`],
    ['FPS', String(meta.fps)],
    ['Durasi', meta.durationFormatted],
    ['Penanda beat', String(meta.bookmarksCount)],
    ['Media', String(media)]
  ];

  return (
    <dl className="facts">
      {items.map(([label, value]) => (
        <div className="fact" key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function XmlCard({ data }: { data: XmlResult }) {
  return (
    <section className="result">
      <h2>{data.metadata?.title ?? data.name}</h2>
      <span className="muted">{data.name}</span>
      {data.metadata && <Facts meta={data.metadata} mediaCount={data.mediaCount} />}
      <div className="actions">
        <button className="btn" onClick={() => saveXml(data.name, data.xml)} disabled={!data.xml}>
          Unduh XML
        </button>
        <button
          className="btn ghost"
          onClick={() => navigator.clipboard.writeText(data.xml)}
          disabled={!data.xml}
        >
          Salin XML
        </button>
      </div>
    </section>
  );
}

function CatalogGroup({ title, items }: { title: string; items: CatalogItem[] }) {
  if (items.length === 0) return null;

  return (
    <>
      <h2 className="group">
        {title} <span className="muted">{items.length}</span>
      </h2>
      <ul className="list">
        {items.map((item) => (
          <li className="row" key={item.name}>
            <span className="row-name">
              {item.name}
              {item.size !== undefined && <span className="row-meta">{formatSize(item.size)}</span>}
            </span>
            <a className="btn ghost small" href={`/api/preset/${encodeURIComponent(item.name)}`}>
              Unduh
            </a>
          </li>
        ))}
      </ul>
    </>
  );
}

function CatalogPanel() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  const load = useCallback(() => {
    setError('');
    api<Catalog>('presets')
      .then(setCatalog)
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(load, [load]);

  const filter = (items: CatalogItem[]) => {
    const q = query.trim().toLowerCase();
    return q ? items.filter((i) => i.name.toLowerCase().includes(q)) : items;
  };

  const presets = useMemo(() => (catalog ? filter(catalog.presets) : []), [catalog, query]);
  const audio = useMemo(() => (catalog ? filter(catalog.audio) : []), [catalog, query]);
  const images = useMemo(() => (catalog ? filter(catalog.images) : []), [catalog, query]);
  const empty = catalog && presets.length + audio.length + images.length === 0;

  return (
    <div className="panel">
      <div className="field">
        <input
          className="input"
          placeholder="Cari preset, audio, atau gambar"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Cari katalog"
        />
      </div>
      {!catalog && !error && <p className="status">Memuat katalog…</p>}
      {error && (
        <p className="error">
          {error}{' '}
          <button className="chip" onClick={load}>
            Coba lagi
          </button>
        </p>
      )}
      {empty && <p className="status">Tidak ada hasil untuk &ldquo;{query}&rdquo;.</p>}
      <CatalogGroup title="Preset" items={presets} />
      <CatalogGroup title="Audio" items={audio} />
      <CatalogGroup title="Gambar" items={images} />
    </div>
  );
}

function LinkPanel({ mode }: { mode: 'link' | 'drive' }) {
  const [url, setUrl] = useState('');
  const [data, setData] = useState<XmlResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [project, setProject] = useState('');

  const run = async (selected?: string) => {
    if (!url.trim()) return;
    setLoading(true);
    setError('');
    if (!selected) setData(null);
    try {
      const params: Record<string, string> = { url: url.trim() };
      if (selected) params.project = selected;
      const result = await api<XmlResult>(mode === 'link' ? 'resolve' : 'drive', params);
      setData(result);
      setProject(selected ?? '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan.');
    } finally {
      setLoading(false);
    }
  };

  const placeholder =
    mode === 'link' ? 'https://alight.link/…' : 'https://drive.google.com/file/d/…/view';
  const hint =
    mode === 'link'
      ? 'Tempel link share dari alight.link atau alightcreative.com.'
      : 'Tempel link Google Drive publik atau ID file-nya.';

  return (
    <div className="panel">
      <div className="field">
        <input
          className="input"
          placeholder={placeholder}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && run()}
          aria-label={mode === 'link' ? 'Link Alight Motion' : 'Link Google Drive'}
        />
        <button className="btn" onClick={() => run()} disabled={loading || !url.trim()}>
          {loading ? 'Memproses…' : 'Ambil preset'}
        </button>
      </div>
      <p className="hint">{hint}</p>
      {error && <p className="error">{error}</p>}
      {data && data.availableProjects.length > 1 && (
        <div className="chips" role="group" aria-label="Pilih proyek">
          {data.availableProjects.map((name) => (
            <button
              key={name}
              className="chip"
              aria-pressed={project === name}
              onClick={() => run(name)}
            >
              {name}
            </button>
          ))}
        </div>
      )}
      {data && <XmlCard data={data} />}
    </div>
  );
}

function TikTokPanel() {
  const [url, setUrl] = useState('');
  const [data, setData] = useState<AudioResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const run = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError('');
    setData(null);
    try {
      setData(await api<AudioResult>('tiktok', { url: url.trim() }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel">
      <div className="field">
        <input
          className="input"
          placeholder="https://www.tiktok.com/@…/video/…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && run()}
          aria-label="Link TikTok"
        />
        <button className="btn" onClick={run} disabled={loading || !url.trim()}>
          {loading ? 'Memproses…' : 'Ambil audio'}
        </button>
      </div>
      <p className="hint">Tempel link video TikTok untuk mengambil backsound-nya.</p>
      {error && <p className="error">{error}</p>}
      {data && (
        <section className="result">
          {data.audioUrl ? (
            <>
              <audio controls src={data.audioUrl} />
              <div className="actions">
                <a className="btn" href={data.audioUrl} target="_blank" rel="noreferrer" download>
                  Unduh audio
                </a>
              </div>
            </>
          ) : (
            <p className="status">Audio tidak ditemukan di video ini.</p>
          )}
        </section>
      )}
    </div>
  );
}

export default function Home() {
  const [tab, setTab] = useState<TabId>('katalog');

  return (
    <main className="page">
      <h1 className="title">AM Preset Player</h1>
      <p className="lead">
        Cari dan unduh preset XML Alight Motion dari katalog, link share, atau Google Drive.
      </p>

      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            className="tab"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'katalog' && <CatalogPanel />}
      {tab === 'link' && <LinkPanel key="link" mode="link" />}
      {tab === 'drive' && <LinkPanel key="drive" mode="drive" />}
      {tab === 'tiktok' && <TikTokPanel />}

      <footer className="foot">
        <p>Data preset berasal dari am.zervida.my.id.</p>
        <p>
          Developer: <strong>hanzz</strong>
        </p>
        <p>
          Suka dengan website ini?{' '}
          <a href="https://saweria.co/hanzreally" target="_blank" rel="noreferrer">
            Donasi lewat Saweria
          </a>
        </p>
      </footer>
    </main>
  );
}
