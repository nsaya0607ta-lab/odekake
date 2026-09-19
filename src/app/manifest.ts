import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "おでかけ記録",
    short_name: "おでかけ記録",
    description: "訪れた場所を日本地図から振り返る、おでかけの記録帳です。",
    lang: "ja",
    start_url: "/",
    display: "standalone",
    background_color: "#fbf8f1",
    theme_color: "#fbf8f1",
    shortcuts: [
      {
        name: "行った場所をかんたん登録",
        short_name: "場所を登録",
        description: "現在地の周辺から行った場所を選んで登録します。",
        url: "/quick-visit",
        icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
