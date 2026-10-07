/**
 * ホームを左にスワイプすると出る「アプリの画面」（iPhone のホーム画面のような一覧）に並べるアプリとフォルダ。
 * - アイコンは public/launcher/icons/<id>.webp（色の地・絵・影・ふちの光まで焼きこんだ1枚の絵。角の形も透明でぬいてある）
 * - 並び順と、かくしたアプリは、利用者が「ホーム画面を編集」で変えられる（この端末に覚える）
 */

export type LauncherApp = {
  kind: "app";
  id: string;
  name: string;
  href: string;
  /** 開くときに広がる色（アイコンの地の色。上→下） */
  tint: [string, string];
  /** さがすときに引っかかる言葉（ひらがな・別名） */
  keywords: string[];
  /** 長押しのメニュー（すぐにできること） */
  shortcuts?: { label: string; href: string }[];
  /** 外のサイト（確認なしで、別の画面で開く） */
  external?: boolean;
  /** 赤い数字のバッジ */
  badge?: "notices";
};

export type LauncherFolder = { kind: "folder"; id: string; name: string; apps: LauncherApp[]; keywords: string[] };
export type LauncherItem = LauncherApp | LauncherFolder;

const app = (a: Omit<LauncherApp, "kind">): LauncherApp => ({ kind: "app", ...a });

/** アプリのアイコンの絵 */
export const iconSrc = (id: string) => `/launcher/icons/${id}.webp`;

export type LauncherOptions = { sns: boolean; memoryGame: boolean };

export function launcherItems({ sns, memoryGame }: LauncherOptions): LauncherItem[] {
  const games: LauncherApp[] = [
    app({ id: "item-catch", name: "アイテムキャッチ", href: "/games/item-catch", tint: ["#ffd57e", "#ff9640"], keywords: ["あいてむきゃっち", "キャッチ", "ゲーム"], shortcuts: [{ label: "遊ぶ", href: "/games/item-catch" }, { label: "ダンボール図鑑", href: "/games/item-catch/dambourle" }] }),
    app({ id: "osanpo-run", name: "おさんぽフレンチー", href: "/games/osanpo-run", tint: ["#5b5f8e", "#2c3355"], keywords: ["おさんぽ", "ラン", "走る", "ゲーム", "青コイン"], shortcuts: [{ label: "遊ぶ", href: "/games/osanpo-run" }] }),
    app({ id: "wanko-bowling", name: "わんこボウリング", href: "/games/wanko-bowling", tint: ["#8ec5ff", "#3f6fe6"], keywords: ["ぼうりんぐ", "ボウリング", "ゲーム"], shortcuts: [{ label: "遊ぶ", href: "/games/wanko-bowling" }] }),
    app({ id: "snack-trail", name: "わんこのおやつ道", href: "/games/snack-trail", tint: ["#cfe9b8", "#8cc56a"], keywords: ["おやつ", "すなっく", "ゲーム"], shortcuts: [{ label: "遊ぶ", href: "/games/snack-trail" }] }),
  ];
  if (memoryGame) {
    games.push(app({ id: "memory-game", name: "しん犬すいじゃく", href: "/memory-game-preview", tint: ["#a6eef4", "#2fb2cf"], keywords: ["しんけいすいじゃく", "めもりー", "ゲーム"] }));
  }

  const odekake: LauncherApp[] = [
    app({ id: "shared-trips", name: "共有旅", href: "/shared-trips", tint: ["#ffe1b0", "#ff92a6"], keywords: ["きょうゆう", "たび", "旅行", "みんな"] }),
    app({ id: "favorites", name: "お気に入り", href: "/mypage/favorites", tint: ["#ff9fb3", "#ee4468"], keywords: ["おきにいり", "スポット", "すき"] }),
    app({ id: "wishlist", name: "行きたい", href: "/mypage/wishlist", tint: ["#c8f0a8", "#4fb06a"], keywords: ["いきたい", "また行きたい", "ウィッシュ"] }),
    app({ id: "step-sync", name: "歩数の連携", href: "/mypage/step-sync", tint: ["#ffcf92", "#f0863a"], keywords: ["ほすう", "れんけい", "ショートカット", "歩数"] }),
  ];

  const items: LauncherItem[] = [
    { kind: "folder", id: "folder-games", name: "ミニゲーム", apps: games, keywords: ["げーむ", "あそぶ", "ゲーム"] },
    app({ id: "gacha", name: "ガチャ", href: "/mypage/coins", tint: ["#ffc0d6", "#ec6496"], keywords: ["がちゃ", "カプセル", "コイン"], shortcuts: [{ label: "ガチャを引く", href: "/mypage/coins" }, { label: "図鑑を見る", href: "/collection" }] }),
    app({ id: "room", name: "マイルーム", href: "/room", tint: ["#b8e6ff", "#4c9fea"], keywords: ["まいるーむ", "へや", "部屋", "家具"], shortcuts: [{ label: "おへやに行く", href: "/room" }] }),
    app({ id: "collection", name: "図鑑", href: "/collection", tint: ["#c9b9ff", "#7655e6"], keywords: ["ずかん", "コレクション", "アイテム"] }),
    app({ id: "friends", name: "フレンド", href: "/mypage/friends", tint: ["#ffcfae", "#f97a57"], keywords: ["ふれんど", "ともだち", "友だち"], shortcuts: [{ label: "フレンドを見る", href: "/mypage/friends" }] }),
    app({ id: "notices", name: "お知らせ", href: "/notices", tint: ["#ffeb8a", "#ffb11f"], badge: "notices", keywords: ["おしらせ", "ニュース", "通知"] }),
    app({ id: "shop", name: "ショップ", href: "/shop", tint: ["#8de6d6", "#1fa08b"], keywords: ["しょっぷ", "背景", "はいけい", "かう"], shortcuts: [{ label: "背景を見る", href: "/shop" }, { label: "ホームのカード", href: "/shop#cards" }] }),
    app({ id: "guide", name: "ルールブック", href: "/guide", tint: ["#f6e2c0", "#c99258"], keywords: ["るーるぶっく", "あそびかた", "ヘルプ", "せつめい"] }),
    app({ id: "map", name: "地図", href: "/map", tint: ["#9fe3f6", "#2b8fc6"], keywords: ["ちず", "マップ", "日本"] }),
    app({ id: "records", name: "記録", href: "/records", tint: ["#d8f292", "#7cbd36"], keywords: ["きろく", "訪問", "履歴"] }),
    app({ id: "add", name: "追加", href: "/add", tint: ["#8ff0b6", "#1fae68"], keywords: ["ついか", "記録する", "訪問"], shortcuts: [{ label: "行った場所を記録", href: "/add" }] }),
  ];
  if (sns) items.push(app({ id: "sns", name: "SNS", href: "/sns", tint: ["#ffb5cf", "#9d68f4"], keywords: ["えすえぬえす", "写真", "しゃしん", "投稿"] }));
  items.push(
    { kind: "folder", id: "folder-odekake", name: "おでかけ", apps: odekake, keywords: ["おでかけ", "旅"] },
    app({ id: "mypage", name: "マイページ", href: "/mypage", tint: ["#ffffff", "#eae2d4"], keywords: ["まいぺーじ", "プロフィール", "設定"] }),
    app({ id: "dog-skin", name: "犬のすがた", href: "/mypage/dog-skin", tint: ["#ddd2ff", "#9a84ee"], keywords: ["いぬ", "すがた", "スキン", "フレブル"] }),
    app({ id: "coin-history", name: "コインの記録", href: "/mypage/coin-history", tint: ["#6f86ee", "#2d3a9c"], keywords: ["こいん", "りれき", "履歴", "青コイン"] }),
    app({ id: "google", name: "Google", href: "https://www.google.com/", external: true, tint: ["#ffffff", "#f1f3f4"], keywords: ["ぐーぐる", "検索", "けんさく", "グーグル"] }),
    app({ id: "chatgpt", name: "ChatGPT", href: "https://chatgpt.com/", external: true, tint: ["#2b2b2b", "#000000"], keywords: ["ちゃっとじーぴーてぃー", "チャットGPT", "AI", "えーあい"] }),
    app({ id: "claude", name: "Claude", href: "https://claude.ai/", external: true, tint: ["#f5f4ee", "#e9e6da"], keywords: ["くろーど", "クロード", "AI", "えーあい"] }),
    app({ id: "instagram", name: "Instagram", href: "https://www.instagram.com/", external: true, tint: ["#e1306c", "#833ab4"], keywords: ["いんすたぐらむ", "インスタ", "いんすた", "写真"] }),
  );
  return items;
}

/** フォルダの中も含めて、アプリを1列に（さがすとき用） */
export function flattenApps(items: readonly LauncherItem[]): LauncherApp[] {
  return items.flatMap((item) => (item.kind === "folder" ? item.apps : [item]));
}

/** 覚えている並び順を当てはめる（知らない id は捨て、新しいアプリは後ろに足す） */
export function applyOrder(items: LauncherItem[], order: readonly string[] | null): LauncherItem[] {
  if (!order) return items;
  const byId = new Map(items.map((item) => [item.id, item]));
  const sorted = order.flatMap((id) => {
    const item = byId.get(id);
    if (!item) return [];
    byId.delete(id);
    return [item];
  });
  return [...sorted, ...byId.values()];
}

export const ORDER_KEY = "odekake_launcher_order_v1";

/** かくしたアプリ（id の並び）をこの端末に覚えるキー */
export const HIDDEN_KEY = "odekake_launcher_hidden_v1";

/** かくしたアプリをのぞく（フォルダの中のアプリも。中がからになったフォルダも出さない） */
export function applyHidden(items: readonly LauncherItem[], hidden: ReadonlySet<string>): LauncherItem[] {
  if (!hidden.size) return [...items];
  return items.flatMap((item): LauncherItem[] => {
    if (hidden.has(item.id)) return [];
    if (item.kind === "app") return [item];
    const apps = item.apps.filter((a) => !hidden.has(a.id));
    return apps.length ? [{ ...item, apps }] : [];
  });
}

/**
 * 並びとフォルダ（グループ）を、この端末に覚える形。
 * アプリは id の文字、フォルダは { id, name, apps }。利用者がアプリどうしを重ねて作ったフォルダも、ここに入る。
 */
export type StoredEntry = string | { id: string; name: string; apps: string[] };
export const LAYOUT_KEY = "odekake_launcher_layout_v1";

export function toStored(items: readonly LauncherItem[]): StoredEntry[] {
  return items.map((item) => (item.kind === "app" ? item.id : { id: item.id, name: item.name, apps: item.apps.map((a) => a.id) }));
}

/** フォルダの名前（はじめにつける名前。あとから変えられる） */
export function folderNameFor(apps: readonly LauncherApp[]): string {
  const all = (word: string) => apps.every((a) => a.keywords.includes(word) || a.name.includes(word));
  if (all("ゲーム")) return "ゲーム";
  if (apps.every((a) => a.href.startsWith("/mypage"))) return "マイページ";
  return "フォルダ";
}

/**
 * 覚えている並び・フォルダを、いまのアプリに当てはめる。
 * - 知らない id は捨てる。中がからになったフォルダは出さない
 * - 覚えていないアプリ（あとから増えたもの）は、もとのフォルダがあればその中へ、なければいちばんうしろへ
 */
export function buildItems(base: readonly LauncherItem[], stored: readonly StoredEntry[] | null): LauncherItem[] {
  if (!stored) return [...base];
  const apps = new Map(flattenApps(base).map((a) => [a.id, a]));
  const baseFolders = new Map(base.flatMap((item) => (item.kind === "folder" ? [[item.id, item] as const] : [])));
  const used = new Set<string>();
  const take = (id: string) => {
    const a = apps.get(id);
    if (!a || used.has(id)) return null;
    used.add(id);
    return a;
  };
  const result: LauncherItem[] = [];
  for (const entry of stored) {
    if (typeof entry === "string") {
      const folder = baseFolders.get(entry);
      if (folder) {
        // 前の形（並び順だけ）で覚えていたフォルダ
        const inside = folder.apps.flatMap((a) => take(a.id) ?? []);
        if (inside.length) result.push({ ...folder, apps: inside });
        continue;
      }
      const a = take(entry);
      if (a) result.push(a);
      continue;
    }
    if (!entry || typeof entry.id !== "string" || !Array.isArray(entry.apps)) continue;
    const inside = entry.apps.flatMap((id) => (typeof id === "string" ? take(id) ?? [] : []));
    if (!inside.length) continue;
    const name = typeof entry.name === "string" && entry.name.trim() ? entry.name.trim().slice(0, 20) : folderNameFor(inside);
    result.push({ kind: "folder", id: entry.id, name, apps: inside, keywords: baseFolders.get(entry.id)?.keywords ?? [] });
  }
  for (const item of base) {
    const rest = item.kind === "folder" ? item.apps : [item];
    for (const a of rest) {
      if (used.has(a.id)) continue;
      used.add(a.id);
      const home = item.kind === "folder" ? result.find((r): r is LauncherFolder => r.kind === "folder" && r.id === item.id) : undefined;
      if (home) home.apps = [...home.apps, a];
      else if (item.kind === "folder") result.push({ ...item, apps: [a] });
      else result.push(a);
    }
  }
  return result;
}
