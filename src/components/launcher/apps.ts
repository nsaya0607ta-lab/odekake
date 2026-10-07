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
