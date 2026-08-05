# おでかけ記録

訪れた都道府県・市区町村・スポットを記録し、日本地図から振り返るスマートフォン向けのライフログアプリです。
一人旅と、友人と共同で記録する共有旅を分けて管理できます。

- フロントエンド: Next.js 15（App Router）/ TypeScript / Tailwind CSS v4
- バックエンド: Supabase（Database / Auth / Storage / Row Level Security）
- 公開想定: Vercel

## セットアップ

### 1. 依存関係

```bash
npm install
```

### 2. Supabase プロジェクトの用意

1. [supabase.com](https://supabase.com) でプロジェクトを作成します。
2. `supabase/migrations/0001_init.sql` を SQL Editor に貼り付けて実行します。
   テーブル、RLS ポリシー、ストレージバケット `photos`、RPC がまとめて作成されます。
   Supabase CLI を使う場合は `supabase db push` でも適用できます。
3. **Authentication → Providers → Email** を有効にし、`Confirm email` をオンにします。
4. **Authentication → URL Configuration → Redirect URLs** に `{サイトURL}/auth/callback` を追加します。

### 3. 環境変数

`.env.example` をコピーして `.env.local` を作成します。

```bash
cp .env.example .env.local
```

| 変数 | 用途 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase プロジェクトの URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon（公開）キー |
| `NEXT_PUBLIC_SITE_URL` | 確認メールやパスワード再設定リンクの戻り先 |

サービスロールキーはクライアント側でもサーバー側でも使用しません。アカウント削除は
`delete_own_account()`（SECURITY DEFINER の RPC）経由で行います。

環境変数が未設定のまま起動した場合は `/setup` に手順が表示されます。

### 4. 開発サーバー

```bash
npm run dev        # http://localhost:3000
npm run typecheck  # 型チェック
npm run lint       # ESLint
npm run build      # 本番ビルド
```

## 画面構成

| 画面 | パス |
| --- | --- |
| ホーム（あなたの旅） | `/home` |
| 日本地図（地方選択） | `/map` |
| 地方地図（都道府県選択） | `/map/[region]` |
| 都道府県詳細（市区町村選択） | `/map/[region]/[pref]` |
| 市区町村詳細（スポット一覧） | `/map/[region]/[pref]/[muni]` |
| スポット詳細 | `/spots/[spotId]` |
| スポット登録 | `/spots/new` |
| 訪問履歴の追加・編集 | `/visits/new` `/visits/[visitId]/edit` |
| 旅行の作成・詳細・設定 | `/trips/new` `/trips/[tripId]` `/trips/[tripId]/settings` |
| 共有旅への参加 | `/join/[code]` `/invitations` |
| 記録（タイムライン / 旅行 / スポット / カレンダー） | `/records` |
| マイページ | `/mypage` `/mypage/profile` `/mypage/account` |

ログイン後の主要画面には、画面下部に「ホーム / 地図 / 追加 / 記録 / マイページ」の固定ナビゲーションを表示します。
「追加」は中央に配置しています。

## 地図データ

画像を貼り付けるのではなく、地理データから生成した SVG パスを使用しています。

- `src/lib/geo/prefecture-paths.json` — 47都道府県の輪郭（`scripts/build-prefecture-paths.mjs` で生成）
- `src/lib/geo/municipalities.json` — 全国 1,894 件の市区町村マスタ（`scripts/build-municipalities.mjs` で生成）
- `src/lib/geo/regions.ts` — 8地方の区分

政令指定都市の区と東京23区も、それぞれ独立した地域選択の単位として扱っています。
沖縄県は本土から離れているため、地図上では左上へ移動して表示しています（画面にも注記を出しています）。

生成スクリプトの再実行例:

```bash
node scripts/build-prefecture-paths.mjs path/to/japan.geojson src/lib/geo/prefecture-paths.json
node scripts/build-municipalities.mjs path/to/latest.csv src/lib/geo/municipalities.json
```

出典データ

- 都道府県境界: [dataofjapan/land](https://github.com/dataofjapan/land) の `japan.geojson`
- 市区町村マスタ: [geolonia/japanese-addresses](https://github.com/geolonia/japanese-addresses)

## データ構造と公開範囲

主なテーブルは `profiles` / `trips` / `trip_members` / `spots` / `visit_records` / `visit_photos` /
`categories` / `tags` / `visit_record_tags` / `trip_comments` / `trip_invitations` です。

記録は原則として非公開で、Row Level Security により分離しています。

- **一人旅** — 作成者のみ閲覧・編集できます。
- **共有旅** — `trip_members` に登録されたメンバーのみ閲覧できます。URL を知っていても参加していなければ閲覧できません。
- **訪問記録** — member は自分の記録のみ編集・削除でき、owner は旅行内すべてを管理できます。
- **写真** — 紐づく訪問記録を閲覧できるユーザーのみ参照できます。

ポリシー内の再帰を避けるため、権限判定は `can_access_trip()` / `is_trip_owner()` /
`can_read_visit()` / `can_read_spot()` / `shares_trip_with()` の SECURITY DEFINER 関数に集約しています。

`viewer` ロールは列挙型と権限判定に用意していますが、初期版では画面上の機能を割り当てていません。

## 写真の保存

Supabase Storage の非公開バケット `photos` に保存します。

```
users/{user_id}/profile/
trips/{trip_id}/cover/
trips/{trip_id}/visits/{visit_record_id}/
```

- JPEG / PNG / WebP に対応し、長辺 1600px を超える画像はブラウザ側で縮小してから送信します。
- 訪問記録あたり最大 10 枚です。
- アップロード中の表示と、失敗時の再試行に対応しています。
- 写真を外すと Storage 上の実ファイルも削除します。

写真は保存ボタンを押す前にアップロードするため、訪問記録の ID をクライアント側で先に発行しています
（同じ画面を開き直しても同じ ID を使うため、写真の重複や記録の二重登録が起きません）。

## 入力とエラーの扱い

- エラーは日本語のメッセージに変換して表示します（`src/lib/errors.ts`）。
- 入力エラーが起きても、入力済みの内容は保持されます。
- 主要なフォームは入力内容を `localStorage` に下書き保存し、画面を閉じても復元できます。
- 訪問履歴と旅行の作成は、同じ ID での二重登録を防いでいます。

## 初期版に含めていないもの

仕様書で「後回しでもよい」とされている項目は未実装です。

- 現在地からの登録、外部の店舗検索、レシート読み取り、AI 旅行記
- SNS 公開、いいね、フォロー、一般公開プロフィール、バッジ
- 訪問回数による地図の濃淡（現在は「未訪問 / 訪問済み」の2段階。回数による塗り分けを後から追加できる構造にしています）

そのほかの制限事項は [`docs/notes.md`](docs/notes.md) にまとめています。
