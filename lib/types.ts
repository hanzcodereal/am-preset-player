export interface MediaItem {
  uri: string | null;
  filename: string | null;
  type: string | null;
  width?: number;
  height?: number;
}

export interface AlightMeta {
  title: string;
  width: number;
  height: number;
  exportWidth: number;
  exportHeight: number;
  fps: number;
  totalTimeMs: number;
  durationFormatted: string;
  backgroundColor: string;
  bookmarksCount: number;
  mediaList: MediaItem[];
}

export interface CatalogItem {
  name: string;
  size?: number | string;
}

export interface Catalog {
  presets: CatalogItem[];
  audio: CatalogItem[];
  images: CatalogItem[];
}

export interface XmlResult {
  name: string;
  xml: string;
  metadata: AlightMeta | null;
  availableProjects: string[];
  mediaCount: number;
}

export interface AudioResult {
  originalUrl: string;
  audioUrl: string | null;
}

export type ApiResponse<T> =
  | { status: true; result: T }
  | { status: false; message: string };
