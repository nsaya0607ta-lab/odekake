import type { NextConfig } from "next";

/**
 * 全ページに付ける保護のヘッダー。
 *
 * ログイン状態を Cookie で持ち、訪問場所という個人的な記録を扱うため、
 * 別サイトの iframe に埋め込まれてクリックを盗まれないようにしておく。
 */
const securityHeaders = [
  // 他サイトからの埋め込みを禁止（クリックジャッキング対策）
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  // 中身から MIME を推測させない
  { key: "X-Content-Type-Options", value: "nosniff" },
  // 外部サイトへは参照元のパスを渡さない（記録のURLが漏れないように）
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // 使っていない端末機能は既定で拒否する（位置情報は場所の指定で使う）
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
];

const nextConfig: NextConfig = {
  experimental: {
    // 画像アップロードを含むフォーム送信のためボディ上限を拡張
    serverActions: { bodySizeLimit: "4mb" },
  },
  images: {
    // ナビゲーションアイコン（自作のローカルSVG）を next/image で扱えるようにする
    dangerouslyAllowSVG: true,
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // 運営お知らせのHTML添付は、自ページ内のsandbox付きiframeに埋め込んで表示する。
      // /api/photo だけは「他サイトからの埋め込みは禁止・自分自身からの埋め込みだけ許可」に緩める
      // （後に定義した方が同じキーを上書きするため、対象パスにはこちらが適用される）
      {
        source: "/api/photo/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
