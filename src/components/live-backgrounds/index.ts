/**
 * 動く・変わる背景の一覧。描く部品は、その背景を使うときにだけ読みこむ（ほかの人のページを重くしない）。
 */
import type { AppBackgroundId } from "@/lib/app-backgrounds";
import type { LiveMount } from "./engine";

export const LIVE_LOADERS: Partial<Record<AppBackgroundId, () => Promise<{ mount: LiveMount }>>> = {
  "paw-trail": () => import("./paw-trail"),
  bubbles: () => import("./bubbles"),
  goldfish: () => import("./goldfish"),
  jelly: () => import("./jelly"),
  "aurora-night": () => import("./aurora-night"),
  weather: () => import("./weather"),
  garden: () => import("./garden"),
  seasons: () => import("./seasons"),
  fireworks: () => import("./fireworks"),
  "paper-planes": () => import("./paper-planes"),
  "cloud-sea": () => import("./cloud-sea"),
  "dog-parade": () => import("./dog-parade"),
};

export const isLiveBackground = (id: AppBackgroundId) => id in LIVE_LOADERS;
