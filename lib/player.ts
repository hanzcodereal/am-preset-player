export interface Layer {
  id: string;
  name: string;
  type: string;
  start: number;
  end: number;
  slot: boolean;
}

export interface Project {
  title: string;
  width: number;
  height: number;
  fps: number;
  duration: number;
  bg: string;
  layers: Layer[];
}

export type Source = HTMLImageElement | HTMLVideoElement;

const MEDIA_TAGS = ['image', 'video', 'media', 'photo'];

export function parseProject(xml: string): Project | null {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  if (doc.querySelector('parsererror')) return null;
  const scene = doc.querySelector('scene') ?? doc.documentElement;
  const num = (el: Element, keys: string[], d: number) => {
    for (const k of keys) {
      const v = el.getAttribute(k);
      if (v !== null && v !== '' && !Number.isNaN(Number(v))) return Number(v);
    }
    return d;
  };

  const layers: Layer[] = [];
  scene.querySelectorAll('*').forEach((el, i) => {
    const tag = el.tagName.toLowerCase();
    if (tag === 'bookmark' || tag === 'scene') return;
    if (!el.hasAttribute('startTime') && !el.hasAttribute('start')) return;
    const start = num(el, ['startTime', 'start'], 0) / 1000;
    const end = num(el, ['endTime', 'end'], 0) / 1000;
    layers.push({
      id: el.getAttribute('id') ?? `layer-${i}`,
      name: el.getAttribute('name') ?? el.getAttribute('title') ?? `${tag} ${layers.length + 1}`,
      type: tag,
      start,
      end: end > start ? end : start + 1,
      slot: MEDIA_TAGS.includes(tag)
    });
  });

  const total = num(scene, ['totalTime'], 0) / 1000;
  const duration = total || Math.max(1, ...layers.map((l) => l.end));
  const bg = scene.getAttribute('bgcolor') ?? '#000000';

  return {
    title: scene.getAttribute('title') ?? 'Tanpa judul',
    width: num(scene, ['width'], 720),
    height: num(scene, ['height'], 1280),
    fps: num(scene, ['fps'], 30),
    duration,
    bg: /^#[0-9a-f]{6,8}$/i.test(bg) ? bg.slice(0, 7) : '#000000',
    layers
  };
}

export function draw(
  ctx: CanvasRenderingContext2D,
  p: Project,
  t: number,
  repl: Record<string, Source>,
  hidden: Set<string>,
  showSlots: boolean
) {
  ctx.fillStyle = p.bg;
  ctx.fillRect(0, 0, p.width, p.height);

  for (const l of p.layers) {
    if (!l.slot || hidden.has(l.id) || t < l.start || t >= l.end) continue;
    const src = repl[l.id];
    if (src) {
      const sw = src instanceof HTMLVideoElement ? src.videoWidth : src.naturalWidth;
      const sh = src instanceof HTMLVideoElement ? src.videoHeight : src.naturalHeight;
      if (!sw || !sh) continue;
      const k = Math.max(p.width / sw, p.height / sh);
      ctx.drawImage(src, (p.width - sw * k) / 2, (p.height - sh * k) / 2, sw * k, sh * k);
    } else if (showSlots) {
      const m = Math.min(p.width, p.height) * 0.1;
      ctx.strokeStyle = '#22d3ee';
      ctx.setLineDash([12, 10]);
      ctx.lineWidth = 3;
      ctx.strokeRect(m, m, p.width - m * 2, p.height - m * 2);
      ctx.setLineDash([]);
      ctx.fillStyle = '#22d3ee';
      ctx.font = `${Math.round(p.width / 22)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(`Slot: ${l.name}`, p.width / 2, p.height / 2);
    }
  }
}

export const SAMPLE = `<scene title="Preset contoh" width="720" height="1280" fps="30" totalTime="6000" bgcolor="#0b1220">
  <image id="foto-1" name="Foto 1" startTime="0" endTime="3000"/>
  <video id="video-1" name="Video 1" startTime="3000" endTime="6000"/>
</scene>`;
