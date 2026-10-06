'use client';

import { useEffect, useRef, useState } from 'react';
import { draw, parseProject, SAMPLE, type Project, type Source } from '@/lib/player';
import type { ApiResponse, AudioResult, Catalog, XmlResult } from '@/lib/types';

type Tab = 'proyek' | 'media' | 'audio' | 'layer' | 'ekspor';
const TABS: [Tab, string][] = [
  ['proyek', 'Proyek'],
  ['media', 'Media'],
  ['audio', 'Audio'],
  ['layer', 'Layer'],
  ['ekspor', 'Ekspor']
];

async function api<T>(path: string, url?: string): Promise<T> {
  const res = await fetch(`/api/${path}${url ? `?${new URLSearchParams({ url })}` : ''}`);
  const json = (await res.json()) as ApiResponse<T>;
  if (!json.status) throw new Error(json.message);
  return json.result;
}

const fmt = (s: number) => `${s.toFixed(2)}s`;

export default function Home() {
  const [tab, setTab] = useState<Tab>('proyek');
  const [project, setProject] = useState<Project | null>(null);
  const [replNames, setReplNames] = useState<Record<string, string>>({});
  const [hidden, setHidden] = useState<string[]>([]);
  const [audioName, setAudioName] = useState('');
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(false);
  const [link, setLink] = useState('');
  const [tiktok, setTiktok] = useState('');
  const [drive, setDrive] = useState('');
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [out, setOut] = useState<{ url: string; ext: string } | null>(null);

  const canvas = useRef<HTMLCanvasElement>(null);
  const proj = useRef<Project | null>(null);
  const repl = useRef<Record<string, Source>>({});
  const hid = useRef(new Set<string>());
  const audio = useRef<HTMLAudioElement | null>(null);
  const audioNode = useRef<MediaStreamAudioDestinationNode | null>(null);
  const t = useRef(0);
  const run = useRef(false);
  const looping = useRef(false);
  const rec = useRef<MediaRecorder | null>(null);

  const setRun = (v: boolean) => {
    run.current = v;
    setPlaying(v);
    if (v) {
      if (audio.current) {
        audio.current.currentTime = t.current;
        audio.current.play().catch(() => {});
      }
    } else {
      audio.current?.pause();
      Object.values(repl.current).forEach((s) => s instanceof HTMLVideoElement && s.pause());
    }
  };

  const load = (texts: string[]) => {
    const ps = texts.map(parseProject);
    const main = ps[0];
    if (!main) return setError('File XML tidak valid.');
    ps.slice(1).forEach((p) => p && main.layers.push(...p.layers));
    setRun(false);
    t.current = 0;
    repl.current = {};
    hid.current = new Set();
    setReplNames({});
    setHidden([]);
    setError('');
    setOut(null);
    proj.current = main;
    setProject(main);
  };

  useEffect(() => load([SAMPLE]), []);

  useEffect(() => {
    api<Catalog>('presets')
      .then(setCatalog)
      .catch(() => setCatalog({ presets: [], audio: [], images: [] }));
  }, []);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const p = proj.current;
      const c = canvas.current;
      if (p && c) {
        if (run.current) {
          t.current += (now - last) / 1000;
          if (t.current >= p.duration) {
            if (looping.current && !rec.current) {
              t.current = 0;
              if (audio.current) audio.current.currentTime = 0;
            } else {
              t.current = p.duration;
              setRun(false);
              if (rec.current?.state === 'recording') rec.current.stop();
            }
          }
        }
        for (const l of p.layers) {
          const s = repl.current[l.id];
          if (!(s instanceof HTMLVideoElement)) continue;
          const on = run.current && t.current >= l.start && t.current < l.end;
          const want = t.current - l.start;
          if (Math.abs(s.currentTime - want) > 0.4) s.currentTime = Math.max(0, want);
          if (on && s.paused) s.play().catch(() => {});
          if (!on && !s.paused) s.pause();
        }
        const ctx = c.getContext('2d');
        if (ctx) draw(ctx, p, t.current, repl.current, hid.current, !rec.current);
        setTime(t.current);
      }
      last = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const guard = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan.');
    } finally {
      setBusy(false);
    }
  };

  const pickXml = async (files: FileList | null) => {
    if (files?.length) load(await Promise.all(Array.from(files).slice(0, 2).map((f) => f.text())));
  };

  const pickMedia = (id: string, file?: File) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    let el: Source;
    if (file.type.startsWith('video')) {
      const v = document.createElement('video');
      v.muted = true;
      v.loop = true;
      v.playsInline = true;
      v.src = url;
      el = v;
    } else {
      const i = new Image();
      i.src = url;
      el = i;
    }
    repl.current[id] = el;
    setReplNames((n) => ({ ...n, [id]: file.name }));
  };

  const setAudioSrc = (src: string, name: string) => {
    audio.current = new Audio(src);
    audioNode.current = null;
    setAudioName(name);
  };

  const getFile = async (name: string) => {
    const res = await fetch(`/api/preset/${encodeURIComponent(name)}`);
    if (!res.ok) throw new Error(`"${name}" tidak bisa dimuat.`);
    return res;
  };

  const loadPreset = (name: string) =>
    guard(async () => load([await (await getFile(name)).text()]));

  const loadAudio = (name: string) =>
    guard(async () => setAudioSrc(URL.createObjectURL(await (await getFile(name)).blob()), name));

  const fetchTiktok = () =>
    guard(async () => {
      const r = await api<AudioResult>('tiktok', tiktok.trim());
      if (!r.audioUrl) throw new Error('Audio tidak ditemukan.');
      let src = r.audioUrl;
      try {
        src = URL.createObjectURL(await (await fetch(r.audioUrl)).blob());
      } catch {}
      setAudioSrc(src, 'Audio TikTok');
    });

  const doExport = () => {
    const c = canvas.current;
    const p = proj.current;
    if (!c || !p) return;
    setError('');
    setOut(null);
    setRun(false);
    t.current = 0;
    const stream = c.captureStream(p.fps);
    if (audio.current) {
      if (!audioNode.current) {
        const ac = new AudioContext();
        audioNode.current = ac.createMediaStreamDestination();
        ac.createMediaElementSource(audio.current).connect(audioNode.current);
      }
      audioNode.current.stream.getAudioTracks().forEach((a) => stream.addTrack(a));
    }
    const mime = ['video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'].find((m) =>
      MediaRecorder.isTypeSupported(m)
    );
    const r = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
    const chunks: Blob[] = [];
    r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    r.onstop = () => {
      rec.current = null;
      setExporting(false);
      const ext = r.mimeType.includes('mp4') ? 'mp4' : 'webm';
      setOut({ url: URL.createObjectURL(new Blob(chunks, { type: r.mimeType })), ext });
    };
    rec.current = r;
    setExporting(true);
    r.start(250);
    setRun(true);
  };

  const dur = project?.duration ?? 0;
  const slots = project?.layers.filter((l) => l.slot) ?? [];

  return (
    <div className="app">
      <header className="bar">
        <svg className="logo" viewBox="0 0 64 64" aria-hidden="true">
          <rect width="64" height="64" rx="14" fill="#1fc8ee" />
          <polygon points="24,16 48,32 24,48" fill="#000" />
        </svg>
        <div className="bar-text">
          <strong>AM Preset Player</strong>
          <span>
            {project?.title} · {project?.layers.length ?? 0} layer
          </span>
        </div>
      </header>

      <div className="stage">
        <canvas
          ref={canvas}
          width={project?.width ?? 720}
          height={project?.height ?? 1280}
          style={{ aspectRatio: `${project?.width ?? 9} / ${project?.height ?? 16}` }}
        />
      </div>

      <div className="seek">
        <input
          type="range"
          min={0}
          max={dur}
          step={0.01}
          value={time}
          disabled={exporting}
          onChange={(e) => {
            t.current = Number(e.target.value);
            if (audio.current) audio.current.currentTime = t.current;
          }}
          aria-label="Posisi waktu"
        />
      </div>
      <div className="controls">
        <button
          className="btn"
          disabled={exporting}
          onClick={() => {
            t.current = 0;
            if (audio.current) audio.current.currentTime = 0;
          }}
        >
          ⟲
        </button>
        <button className="btn primary" disabled={exporting} onClick={() => setRun(!playing)}>
          {playing ? 'Jeda' : 'Putar'}
        </button>
        <button
          className={`btn ${loop ? 'on' : ''}`}
          onClick={() => {
            looping.current = !loop;
            setLoop(!loop);
          }}
          aria-pressed={loop}
        >
          ⇄
        </button>
        <span className="time">
          {fmt(time)} / {fmt(dur)}
        </span>
      </div>

      <main className="body">
        {error && <p className="error">{error}</p>}

        {tab === 'proyek' && (
          <>
            <section className="card">
              <h2>Preset XML</h2>
              <label className="drop">
                <strong>Pilih file .xml</strong>
                <span>Boleh 2 file sekaligus (preset + grup/cc).</span>
                <input type="file" accept=".xml,text/xml" multiple hidden onChange={(e) => pickXml(e.target.files)} />
              </label>
              {project && (
                <code className="info">
                  {project.layers.length} layer, {dur.toFixed(1)}s, {project.width}x{project.height}
                </code>
              )}
              <button className="btn wide" onClick={() => load([SAMPLE])}>
                Kembali ke preset contoh
              </button>
            </section>
            <section className="card">
              <h2>Ambil dari link Alight Motion</h2>
              <div className="row">
                <input
                  className="input"
                  placeholder="https://alightcreative.com/am/share/…"
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                />
                <button
                  className="btn"
                  disabled={busy || !link.trim()}
                  onClick={() => guard(async () => load([(await api<XmlResult>('resolve', link.trim())).xml]))}
                >
                  {busy ? '…' : 'Ambil'}
                </button>
              </div>
            </section>
            <section className="card">
              <h2>Google Drive</h2>
              <div className="row">
                <input
                  className="input"
                  placeholder="https://drive.google.com/file/d/…/view"
                  value={drive}
                  onChange={(e) => setDrive(e.target.value)}
                />
                <button
                  className="btn"
                  disabled={busy || !drive.trim()}
                  onClick={() => guard(async () => load([(await api<XmlResult>('drive', drive.trim())).xml]))}
                >
                  {busy ? '…' : 'Ambil'}
                </button>
              </div>
            </section>
            <section className="card">
              <h2>Katalog preset</h2>
              <input className="input full" placeholder="Cari preset" value={query} onChange={(e) => setQuery(e.target.value)} />
              {!catalog && <p className="muted">Memuat katalog…</p>}
              {catalog?.presets
                .filter((i) => i.name.toLowerCase().includes(query.trim().toLowerCase()))
                .map((i) => (
                  <button className="item" key={i.name} disabled={busy} onClick={() => loadPreset(i.name)}>
                    <span>{i.name}</span>
                    <span className="btn small">Buka</span>
                  </button>
                ))}
            </section>
            <p className="foot">
              Developer: <strong>hanzz</strong> ·{' '}
              <a href="https://saweria.co/hanzreally" target="_blank" rel="noreferrer">
                Donasi lewat Saweria
              </a>
            </p>
          </>
        )}

        {tab === 'media' && (
          <section className="card">
            <h2>Ganti media</h2>
            {slots.length === 0 && <p className="muted">Slot media tidak terdeteksi di preset ini.</p>}
            {slots.map((l) => (
              <label className="item" key={l.id}>
                <span>
                  {l.name}
                  <small>{replNames[l.id] ?? `${l.type} · ${fmt(l.start)}–${fmt(l.end)}`}</small>
                </span>
                <span className="btn small">Ganti</span>
                <input type="file" accept="image/*,video/*" hidden onChange={(e) => pickMedia(l.id, e.target.files?.[0])} />
              </label>
            ))}
          </section>
        )}

        {tab === 'audio' && (
          <section className="card">
            <h2>Audio</h2>
            <label className="drop">
              <strong>{audioName || 'Pilih file audio'}</strong>
              <input
                type="file"
                accept="audio/*"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setAudioSrc(URL.createObjectURL(f), f.name);
                }}
              />
            </label>
            <div className="row">
              <input className="input" placeholder="Link TikTok untuk backsound" value={tiktok} onChange={(e) => setTiktok(e.target.value)} />
              <button className="btn" disabled={busy || !tiktok.trim()} onClick={fetchTiktok}>
                {busy ? '…' : 'Ambil'}
              </button>
            </div>
            {catalog?.audio.map((i) => (
              <button className="item" key={i.name} disabled={busy} onClick={() => loadAudio(i.name)}>
                <span>{i.name}</span>
                <span className="btn small">Pakai</span>
              </button>
            ))}
          </section>
        )}

        {tab === 'layer' && (
          <section className="card">
            <h2>Layer</h2>
            {project?.layers.map((l) => (
              <label className="item" key={l.id}>
                <span>
                  {l.name}
                  <small>
                    {l.type} · {fmt(l.start)}–{fmt(l.end)}
                  </small>
                </span>
                <input
                  type="checkbox"
                  checked={!hidden.includes(l.id)}
                  onChange={(e) => {
                    e.target.checked ? hid.current.delete(l.id) : hid.current.add(l.id);
                    setHidden(Array.from(hid.current));
                  }}
                />
              </label>
            ))}
          </section>
        )}

        {tab === 'ekspor' && (
          <section className="card">
            <h2>Ekspor video</h2>
            <p className="muted">
              Video dirender langsung dari kanvas sebesar {project?.width}x{project?.height} dan direkam
              selama durasi preset ({fmt(dur)}). Biarkan tab ini tetap terbuka sampai selesai.
            </p>
            <button className="btn primary wide" disabled={exporting || !project} onClick={doExport}>
              {exporting ? `Merekam… ${Math.round((time / (dur || 1)) * 100)}%` : 'Mulai ekspor'}
            </button>
            {out && (
              <a className="btn wide" href={out.url} download={`${project?.title ?? 'preset'}.${out.ext}`}>
                Simpan video (.{out.ext})
              </a>
            )}
          </section>
        )}
      </main>

      <nav className="nav" role="tablist">
        {TABS.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
