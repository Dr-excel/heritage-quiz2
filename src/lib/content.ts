// ビルド時に読み込むコンテンツ（遺産マスタと画像クレジット）
import imagesJson from "../../content/images.json";
import sitesJson from "../../content/sites.json";
import type { ImageInfo } from "./types";

export type SiteMeta = {
  id: string;
  ja: string;
  en: string;
  country: string;
  cat: "C" | "N" | "M";
  year: number;
};

export type ImageMeta = {
  key: string;
  width: number;
  height: number;
  credit: string;
  license: string;
  licenseUrl: string | null;
  sourceUrl: string;
};

export const SITES = sitesJson as SiteMeta[];
export const IMAGES = imagesJson as Record<string, ImageMeta>;

export function siteImage(siteId: string): ImageInfo | null {
  const img = IMAGES[siteId];
  const site = SITES.find((s) => s.id === siteId);
  if (!img || !site) return null;
  return {
    url: `/img/${img.key}`,
    width: img.width,
    height: img.height,
    alt: site.ja,
    credit: img.credit,
    license: img.license,
    licenseUrl: img.licenseUrl,
    sourceUrl: img.sourceUrl,
  };
}
