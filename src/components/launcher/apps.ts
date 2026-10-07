/**
 * ホームを左にスワイプすると出る「アプリの画面」（iPhone のホーム画面のような一覧）に並べるアプリとフォルダ。
 * - art は public/ の絵。"coin" はコインの絵、"paw" は肉球の足あとの絵（どちらもその場で描く）
 * - cover の絵はアイコンいっぱいに、それ以外は色の地の上に少し小さく置く
 * - 並び順は利用者が「ホーム画面を編集」で入れかえられる（この端末に覚える）
 */

export type LauncherArt = string | "coin" | "paw";

export type LauncherApp = {
  kind: "app";
  id: string;
  name: string;
  href: string;
  art: LauncherArt;
  /** アイコンの地（CSS の background） */
  bg: string;
  /** 絵をアイコンいっぱいに広げる */
  cover?: boolean;
  /** 絵の大きさ（アイコンに対する割合）。cover でないとき */
  artScale?: number;
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

export type LauncherOptions = { sns: boolean; memoryGame: boolean };

export function launcherItems({ sns, memoryGame }: LauncherOptions): LauncherItem[] {
  const games: LauncherApp[] = [
    app({ id: "item-catch", name: "アイテムキャッチ", href: "/games/item-catch", art: "/games/item-catch/menu-icon-v2.webp", bg: "linear-gradient(160deg,#fff7e2,#f7d9a0)", artScale: 0.86, keywords: ["あいてむきゃっち", "キャッチ", "ゲーム"], shortcuts: [{ label: "遊ぶ", href: "/games/item-catch" }, { label: "ダンボール図鑑", href: "/games/item-catch/dambourle" }] }),
    app({ id: "osanpo-run", name: "おさんぽフレンチー", href: "/games/osanpo-run", art: "/games/osanpo-run/menu-icon.webp", bg: "#2c3355", cover: true, keywords: ["おさんぽ", "ラン", "走る", "ゲーム", "青コイン"], shortcuts: [{ label: "遊ぶ", href: "/games/osanpo-run" }] }),
    app({ id: "wanko-bowling", name: "わんこボウリング", href: "/games/wanko-bowling", art: "/games/wanko-bowling/menu-icon-v2.webp", bg: "linear-gradient(160deg,#fff0ea,#f5c3b2)", artScale: 0.86, keywords: ["ぼうりんぐ", "ボウリング", "ゲーム"], shortcuts: [{ label: "遊ぶ", href: "/games/wanko-bowling" }] }),
    app({ id: "snack-trail", name: "わんこのおやつ道", href: "/games/snack-trail", art: "/games/snack-trail/menu-icon-preview.webp", bg: "#cfe9b8", cover: true, keywords: ["おやつ", "すなっく", "ゲーム"], shortcuts: [{ label: "遊ぶ", href: "/games/snack-trail" }] }),
  ];
  if (memoryGame) {
    games.push(app({ id: "memory-game", name: "しん犬すいじゃく", href: "/memory-game-preview", art: "/collection/items/duck-plush.webp", bg: "linear-gradient(160deg,#eef6ff,#c8dff5)", artScale: 0.8, keywords: ["しんけいすいじゃく", "めもりー", "ゲーム"] }));
  }

  const odekake: LauncherApp[] = [
    app({ id: "shared-trips", name: "共有旅", href: "/shared-trips", art: "/splash/balloon.webp", bg: "linear-gradient(170deg,#d9eefc,#f6e6ef)", artScale: 0.74, keywords: ["きょうゆう", "たび", "旅行", "みんな"] }),
    app({ id: "favorites", name: "お気に入り", href: "/mypage/favorites", art: "/splash/photo-field.webp", bg: "#cfe7a8", cover: true, keywords: ["おきにいり", "スポット", "すき"] }),
    app({ id: "wishlist", name: "行きたい", href: "/mypage/wishlist", art: "/splash/signpost.webp", bg: "linear-gradient(170deg,#f3f8ee,#d8eac6)", artScale: 0.82, keywords: ["いきたい", "また行きたい", "ウィッシュ"] }),
    app({ id: "step-sync", name: "歩数の連携", href: "/mypage/step-sync", art: "paw", bg: "linear-gradient(170deg,#fff8ee,#f3dfc4)", keywords: ["ほすう", "れんけい", "ショートカット", "歩数"] }),
  ];

  const items: LauncherItem[] = [
    { kind: "folder", id: "folder-games", name: "ミニゲーム", apps: games, keywords: ["げーむ", "あそぶ", "ゲーム"] },
    app({ id: "gacha", name: "ガチャ", href: "/mypage/coins", art: "/splash/gacha-machine.webp", bg: "linear-gradient(165deg,#fff1f5,#f6c7d7)", artScale: 0.8, keywords: ["がちゃ", "カプセル", "コイン"], shortcuts: [{ label: "ガチャを引く", href: "/mypage/coins" }, { label: "図鑑を見る", href: "/collection" }] }),
    app({ id: "room", name: "マイルーム", href: "/room", art: "/splash/house.webp", bg: "linear-gradient(170deg,#ecf6e4,#c3e2ae)", artScale: 0.8, keywords: ["まいるーむ", "へや", "部屋", "家具"], shortcuts: [{ label: "おへやに行く", href: "/room" }] }),
    app({ id: "collection", name: "図鑑", href: "/collection", art: "/launcher/collection.webp", bg: "#f4ecd9", cover: true, keywords: ["ずかん", "コレクション", "アイテム"] }),
    app({ id: "friends", name: "フレンド", href: "/mypage/friends", art: "/icons/header/friends.webp", bg: "linear-gradient(165deg,#fff4ea,#ffd9bd)", artScale: 0.86, keywords: ["ふれんど", "ともだち", "友だち"], shortcuts: [{ label: "フレンドを見る", href: "/mypage/friends" }] }),
    app({ id: "notices", name: "お知らせ", href: "/notices", art: "/launcher/notice.webp", bg: "#f6eedd", cover: true, badge: "notices", keywords: ["おしらせ", "ニュース", "通知"] }),
    app({ id: "shop", name: "ショップ", href: "/shop", art: "/icons/navigation/shop.svg", bg: "linear-gradient(165deg,#fffaf0,#f2dfc2)", artScale: 0.7, keywords: ["しょっぷ", "背景", "はいけい", "かう"], shortcuts: [{ label: "背景を見る", href: "/shop" }, { label: "ホームのカード", href: "/shop#cards" }] }),
    app({ id: "guide", name: "ルールブック", href: "/guide", art: "/icons/header/guide.webp", bg: "linear-gradient(165deg,#f2f8ec,#d2e7c1)", artScale: 0.82, keywords: ["るーるぶっく", "あそびかた", "ヘルプ", "せつめい"] }),
    app({ id: "map", name: "地図", href: "/map", art: "/icons/navigation/map.webp", bg: "linear-gradient(165deg,#eef7fd,#c9e3f4)", artScale: 0.8, keywords: ["ちず", "マップ", "日本"] }),
    app({ id: "records", name: "記録", href: "/records", art: "/icons/navigation/records.webp", bg: "linear-gradient(165deg,#fbf8f1,#e6dfcd)", artScale: 0.78, keywords: ["きろく", "訪問", "履歴"] }),
    app({ id: "add", name: "追加", href: "/add", art: "/icons/navigation/add.webp", bg: "linear-gradient(165deg,#f1f9ec,#cfe8c1)", artScale: 0.78, keywords: ["ついか", "記録する", "訪問"], shortcuts: [{ label: "行った場所を記録", href: "/add" }] }),
  ];
  if (sns) items.push(app({ id: "sns", name: "SNS", href: "/sns", art: "/icons/navigation/sns.svg", bg: "linear-gradient(165deg,#eef8fd,#c6e3f2)", artScale: 0.68, keywords: ["えすえぬえす", "写真", "しゃしん", "投稿"] }));
  items.push(
    { kind: "folder", id: "folder-odekake", name: "おでかけ", apps: odekake, keywords: ["おでかけ", "旅"] },
    app({ id: "mypage", name: "マイページ", href: "/mypage", art: "/icons/navigation/mypage.webp", bg: "linear-gradient(165deg,#fdf6f1,#efd8cc)", artScale: 0.78, keywords: ["まいぺーじ", "プロフィール", "設定"] }),
    app({ id: "dog-skin", name: "犬のすがた", href: "/mypage/dog-skin", art: "/splash/items/frenchie-plush.webp", bg: "linear-gradient(165deg,#f6f2fd,#d9cff2)", artScale: 0.82, keywords: ["いぬ", "すがた", "スキン", "フレブル"] }),
    app({ id: "coin-history", name: "コインの記録", href: "/mypage/coin-history", art: "coin", bg: "linear-gradient(165deg,#fff9e6,#f6dfa0)", keywords: ["こいん", "りれき", "履歴", "青コイン"] }),
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
