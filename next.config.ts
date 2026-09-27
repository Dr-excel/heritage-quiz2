import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// 本番ビルドは静的出力（out/）にして Workers Static Assets から配信する。
// 開発時だけ API と画像を wrangler dev（:8787）へ中継する。
const nextConfig: NextConfig = {
  output: isDev ? undefined : "export",
  trailingSlash: false,
  images: { unoptimized: true },
  ...(isDev
    ? {
        async rewrites() {
          return [
            { source: "/api/:path*", destination: "http://localhost:8787/api/:path*" },
            { source: "/img/:path*", destination: "http://localhost:8787/img/:path*" },
          ];
        },
      }
    : {}),
};

export default nextConfig;
