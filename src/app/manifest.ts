import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bag Palette｜私だけのカバン見つけパレット",
    short_name: "Bag Palette",
    description:
      "4択のビジュアル選択で好みのカバンを絞り込み、AIがあなたの嗜好プロファイルを言語化・可視化するコスメパレット風バッグ探しアプリ。",
    start_url: "/",
    display: "standalone",
    background_color: "#FFF8F9",
    theme_color: "#E87A90",
    orientation: "portrait",
    icons: [
      {
        src: "/icons/icon-192.svg",
        sizes: "192x192",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
