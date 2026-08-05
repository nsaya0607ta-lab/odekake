import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // 画像アップロードを含むフォーム送信のためボディ上限を拡張
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
