import type { ImageInfo } from "@/lib/types";

// 写真とクレジット表記（ライセンス上、作者とライセンスの表示が必須）
export function Photo({ image, priority = false }: { image: ImageInfo; priority?: boolean }) {
  return (
    <figure className="overflow-hidden rounded-xl border border-border bg-surface-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image.url}
        alt={image.alt}
        width={image.width}
        height={image.height}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        className="block w-full h-auto max-h-[40vh] object-cover"
      />
      <figcaption className="px-3 py-1.5 text-[11px] leading-snug text-muted">
        写真：
        <a href={image.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">
          {image.credit}
        </a>
        {" / "}
        {image.licenseUrl ? (
          <a href={image.licenseUrl} target="_blank" rel="noopener noreferrer license" className="underline">
            {image.license}
          </a>
        ) : (
          image.license
        )}
      </figcaption>
    </figure>
  );
}
