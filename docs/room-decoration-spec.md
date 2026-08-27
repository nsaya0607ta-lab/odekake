# マイルーム機能 実装依頼

このドキュメントは、ChatGPT（または他のAIアシスタント）にこの機能の実装を依頼するための仕様書です。
そのままコピペしてプロンプトとして渡すことを想定しています。

> **v2 での変更点**: 初期案（壁面の棚にアイテムを飾るだけの「デコレーションボード」）から、
> 部屋の間取りを上から見た**見下ろし視点のマイルーム**に方向転換しました。壁掛け棚の実装が
> 既にある場合は、それを置き換える形で作り直してください（残す必要はありません）。

---

## 依頼したいこと

> 以下は Next.js (App Router) + Supabase の犬のお散歩記録アプリ「おでかけ」のリポジトリです。
> ガチャで手に入れたコレクションアイテムを使って、自分だけの部屋を作れる**マイルーム機能**を
> 追加してください。あつまれどうぶつの森やマイクラのハウジングのように、部屋を上から見た
> 間取りの中に、床や壁際へ好きなアイテムを配置できるようにしたいです。操作はドラッグではなく、
> 「アイテムを選ぶ→空いているマスをタップして置く」というマイクラのインベントリ的な
> シンプルな方式にしてください。下記の仕様・既存コードのパターンに沿って実装してください。

---

## 1. プロジェクト概要

- 犬とのお散歩を記録するアプリ。歩数や訪問記録に応じてコイン・経験値を獲得できる。
- コインで「ガチャ」を引くと、おもちゃ・食べもの・インテリア・アクセサリーなどの
  コレクションアイテムが手に入り、「図鑑」に登録される（`src/lib/collection/items.ts`）。
- スタック: Next.js (App Router) / TypeScript / Tailwind CSS / Supabase (Postgres + RLS)。

## 2. 作りたい機能

**マイルーム**：マイページに新設する画面。持っているガチャアイテムを、見下ろし視点の
部屋の間取りに自由に配置して、自分だけの部屋を作れる。

### 見た目・UX

- 部屋を真上から見た間取り（フロアタイル）を描画する。初期案: **6 × 6 マスの正方形の部屋**。
- 部屋の中央付近に、自分の犬（`getCurrentDogSkin` で取得できる現在のスキン）を固定表示し、
  「自分の部屋に自分の犬がいる」生活感を出す（犬自体はマスを専有しない、演出目的の表示）。
- 画面下部にインベントリ風のアイテム一覧を表示する。図鑑と同じ絵柄・レアリティ枠
  （`src/components/collection/collection-ui.tsx` のカード表現）を流用する。
- 操作フロー（ドラッグ&ドロップは使わない。タップだけで完結させる）：
  1. 下部のインベントリからアイテムをタップして選択する。
  2. 床グリッドの空いているマスがハイライトされる。
  3. 置きたいマスをタップすると設置される。
  4. 既に置いてあるマスをタップすると「どける／別のアイテムに差し替え」の操作ができる。
- カテゴリ（toy / food / interior / accessory / other）による置き場所の制限はしない。
  すべて同じ床グリッドに置ける（実装をシンプルに保つため）。
- 1つのアイテムにつき部屋に置けるのは同時に1個まで（在庫管理はしない。図鑑と同じ
  「持っている/持っていない」の状態だけで完結させる）。

### 発展案（初期実装のスコープ外でよい）

- 床材・壁紙を着せ替えできるようにする。
- 複数の部屋（間取りのバリエーション）を持てるようにする。
- フレンドの部屋を見に行ける（`src/app/(app)/mypage/friends/[friendId]/collection/page.tsx`
  と同様のパターンで `.../friends/[friendId]/room` を追加）。

## 3. 参考にすべき既存実装

似た「所持データを配置する」機能として、そうび機能（`user_equipment`）が既にあるので、
これと同じ設計パターンを踏襲してください。

- **DBマイグレーション**: `supabase/migrations/0012_user_equipment.sql`
  - RLS で `select` は本人のみ許可。
  - 書き込み（装着・解除）は `SECURITY DEFINER` の RPC 関数 (`set_equipped_item`) 経由のみ許可し、
    テーブルへの直接 insert/update/delete 権限は与えない。
  - このパターンを踏襲し、`room_items` テーブル + `set_room_item(slot_index, item_id)` /
    `clear_room_item(slot_index)` のような RPC を用意する想定。
- **サーバー側データ取得**: `src/lib/data/equipment.ts`
  ```ts
  export async function getEquipment(supabase: DB, userId: string): Promise<EquipmentMap> {
    const { data, error } = await supabase.from("user_equipment").select("slot, level").eq("user_id", userId);
    ...
  }
  ```
  同様に `getRoomItems(supabase, userId)` を `src/lib/data/room.ts` に作る。
- **APIルート**: `src/app/api/equipment/route.ts` を参考に `src/app/api/room/route.ts` を作る。
- **ページ**: `src/app/(app)/mypage/gear/page.tsx`（サーバーコンポーネントでデータ取得し、
  クライアントコンポーネントに渡す構成）を参考に `src/app/(app)/mypage/room/page.tsx` を追加する。
  犬のスキン表示には `getCurrentDogSkin`（`src/lib/data/dog-skin.ts`）を使う。
- **UIコンポーネント**: `src/components/gear-board.tsx` の構成・状態管理の仕方を参考に
  `src/components/room-board.tsx` を作る。見下ろし視点の床グリッドは、正方形マスを
  CSS Grid で並べ、奥のマスほど手前より若干縮小・上寄せする程度の軽い擬似遠近表現に留め、
  過度な3D表現は避ける（実装コストとメンテ性を優先）。
- **アイテム定義**: `src/lib/collection/items.ts` の `CollectionItem` 型
  （`id`, `name`, `image`, `category`, `series`, `rarity`）をそのまま利用する。
- **カードの見た目**: `src/components/collection/collection-ui.tsx`、
  `src/components/collection/item-art.tsx` にレアリティ枠込みのカード表現があるので流用する。

## 4. データモデル案

```sql
create table if not exists public.room_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  slot_index integer not null check (slot_index between 0 and 35), -- 6×6マス=36マス
  item_id text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, slot_index)
);

alter table public.room_items enable row level security;

create policy room_items_select on public.room_items for select to authenticated
  using (user_id = auth.uid());

grant select on public.room_items to authenticated;

-- 書き込みは RPC 経由のみ。set_equipped_item と同様に SECURITY DEFINER にする。
-- - 所持していないアイテム（図鑑未取得）は置けないようにチェックする
-- - 同じアイテムを既に別スロットに置いている場合は移動として扱う（重複配置しない）
create or replace function public.set_room_item(p_slot_index integer, p_item_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- TODO: user_gacha_items（所持判定）を参照して所持チェック
  -- TODO: 同一 item_id の既存配置があれば削除してから insert
end;
$$;

create or replace function public.clear_room_item(p_slot_index integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.room_items where user_id = auth.uid() and slot_index = p_slot_index;
end;
$$;
```

※ 所持判定に使う実際のテーブル名（`user_gacha_items` 等）は
`src/lib/collection/` 配下や既存マイグレーションを確認して実装時に合わせてください。

## 5. 完了条件

- [ ] `supabase/migrations/` に `room_items` テーブルと RPC を追加するマイグレーションを作成
- [ ] `src/lib/data/room.ts` で配置状況を取得できる
- [ ] `src/app/api/room/route.ts` で配置の更新ができる（未所持アイテムは拒否）
- [ ] `src/app/(app)/mypage/room/page.tsx` + `src/components/room-board.tsx` で
      見下ろし視点の間取り上にタップ操作で配置できるUIが動作する
- [ ] 部屋の中央付近に現在のスキンの犬が表示される
- [ ] マイページ（`src/app/(app)/mypage/page.tsx`）にマイルームへの導線を追加
- [ ] 型チェック・lint が通る（`npm run lint` など、リポジトリの既存スクリプトに従う）
