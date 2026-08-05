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
2. `supabase/migrations/` の SQL を番号順に SQL Editor へ貼り付けて実行します。
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
| `EMAIL_PROVIDER` | 招待メールの送信元（任意。未設定なら送信しません） |
| `NEXT_PUBLIC_PLACE_SEARCH_PROVIDER` | 店舗・施設検索の提供元（任意。未設定なら検索欄は使えません） |

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

### 5. 動作確認

```bash
./scripts/verify-rls.sh           # RLS と RPC をローカルの PostgreSQL で検証（Supabase 不要）
node scripts/verify-supabase.mjs  # 実 Supabase プロジェクトでの動作確認
```

`verify-rls.sh` は、素の PostgreSQL に Supabase 相当の土台を作って
`supabase/migrations/*.sql` を適用し、公開範囲を91項目確認します。
`verify-supabase.mjs` は、新規登録・確認メール・ログイン・公開範囲・写真・アカウント削除を
実際のプロジェクトに対して順に確認します。

## 画面構成

| 画面 | パス |
| --- | --- |
| ホーム（いまの旅） | `/home` |
| 旅を選ぶ（自分の旅 / 共有旅一覧） | `/workspaces` |
| 日本地図（地方選択） | `/map` |
| 地方地図（都道府県選択） | `/map/[region]` |
| 都道府県地図（市区町村の境界 ＋ 検索・一覧） | `/map/[region]/[pref]` |
| 市区町村詳細（スポット一覧） | `/map/[region]/[pref]/[muni]` |
| スポット詳細 | `/spots/[spotId]` |
| スポット登録・編集 | `/spots/new` `/spots/[spotId]/edit` |
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
- `src/lib/geo/map-insets.json` — 離島を寄せて描く枠（同スクリプトで生成）
- `src/lib/geo/municipalities.json` — 全国 1,894 件の市区町村マスタ（`scripts/build-municipalities.mjs` で生成）
- `src/lib/geo/municipality-paths/{都道府県コード}.json` — 市区町村の境界（`scripts/build-municipality-paths.mjs` で生成）
- `src/lib/geo/regions.ts` — 8地方の区分

政令指定都市の区と東京23区も、それぞれ独立した地域選択の単位として扱っています。

本土から離れた島（沖縄本島・先島諸島・大東諸島・小笠原諸島）は、そのままの位置に描くと
地図が横に広がって本土が小さくなるため、破線の枠に入れて海の余白へ寄せています
（`src/lib/geo/map-insets.json`。画面にも注記を出しています）。
奄美群島と伊豆諸島は実際の位置に描いています。

生成スクリプトの再実行例:

```bash
node scripts/build-prefecture-paths.mjs path/to/japan.geojson src/lib/geo
node scripts/build-municipalities.mjs path/to/latest.csv src/lib/geo/municipalities.json
node scripts/build-municipality-paths.mjs path/to/N03-21_210101.json src/lib/geo/municipality-paths
```

出典データ

- 都道府県境界: [dataofjapan/land](https://github.com/dataofjapan/land) の `japan.geojson`
- 市区町村マスタ: [geolonia/japanese-addresses](https://github.com/geolonia/japanese-addresses)
- 市区町村境界: [smartnews-smri/japan-topography](https://github.com/smartnews-smri/japan-topography)（簡素化1%）

市区町村の境界は都道府県ごとにファイルを分け、開いている県の分だけを
サーバー側で読み込みます（全国で約2MB。端末へは表示中の県の分だけが届きます）。

## 旅ワークスペース

アプリは「自分の旅」と、共有旅ごとの独立した空間に分かれています。

```
自分の旅        … 自分がつくった一人旅すべて
共有旅①②③…    … 参加している共有旅ひとつずつ
```

ホーム・地図・記録・スポットは、選んでいる旅の記録だけを表示します。
共有旅を新しくつくった直後の日本地図は、すべて未訪問から始まります
（自分の旅や他の共有旅の記録は合算しません）。

切り替えはホーム上部か `/workspaces` から行い、選択は Cookie
（`odekake-workspace`）に保存します。マイページだけは、旅をまたいだ
アカウント全体の合計を表示します。

## データ構造と公開範囲

主なテーブルは `profiles` / `trips` / `trip_members` / `spots` / `visit_records` / `visit_photos` /
`categories` / `tags` / `visit_record_tags` / `trip_comments` / `trip_invitations` /
`trip_activities` です。

記録は原則として非公開で、Row Level Security により分離しています。

- **一人旅** — 作成者のみ閲覧・編集できます。
- **共有旅** — `trip_members` に登録されたメンバーのみ閲覧できます。URL を知っていても参加していなければ閲覧できません。
- **訪問記録** — member は自分の記録のみ編集・削除でき、owner は旅行内すべてを管理できます。
- **写真** — 紐づく訪問記録を閲覧できるユーザーのみ参照できます。
- **活動履歴** — 共有旅のメンバーのみ閲覧できます。書き込みはトリガー経由に限っています。

ポリシー内の再帰を避けるため、権限判定は `can_access_trip()` / `is_trip_owner()` /
`can_read_visit()` / `can_read_spot()` / `shares_trip_with()` の SECURITY DEFINER 関数に集約しています。

`viewer` ロールは列挙型と権限判定に用意していますが、初期版では画面上の機能を割り当てていません。

## 写真の保存

Supabase Storage の非公開バケット `photos` に保存します。

```
tmp/{user_id}/{下書きID}/            ← 保存前（一時領域）
users/{user_id}/profile/
trips/{trip_id}/cover/
trips/{trip_id}/visits/{visit_record_id}/
```

- JPEG / PNG / WebP に対応し、長辺 1600px を超える画像はブラウザ側で縮小してから送信します。
- 訪問記録あたり最大 10 枚です。
- アップロード中の表示と、失敗時の再試行に対応しています。
- 保存前の写真を外すと、その場で実ファイルも削除します。保存済みの写真は、保存したときに削除します。

写真は保存ボタンを押す前にアップロードするため、いったん一時領域へ置き、
保存時に本来の場所へ移します。保存せずに画面を離れた写真は一時領域に残るだけで、
12時間を過ぎたものはアプリ起動時（1日1回）にまとめて削除します。

## 入力とエラーの扱い

- エラーは日本語のメッセージに変換して表示します（`src/lib/errors.ts`）。
- 入力エラーが起きても、入力済みの内容は保持されます。
- 主要なフォームは入力内容を `localStorage` に下書き保存し、画面を閉じても復元できます。
- 訪問履歴と旅行の作成は、同じ ID での二重登録を防いでいます。

## 初期版に含めていないもの

仕様書で「後回しでもよい」とされている項目は未実装です。

- レシート読み取り、AI 旅行記
- 外部の店舗検索（`src/lib/places/` に提供元を足せば有効になります）
- 招待メールの送信（`src/lib/email/` に送信元を足せば有効になります）
- SNS 公開、いいね、フォロー、一般公開プロフィール、バッジ
- 訪問回数による地図の濃淡（現在は「未訪問 / 訪問済み」の2段階。回数による塗り分けを後から追加できる構造にしています）

直近の変更内容は [`docs/changes-3.md`](docs/changes-3.md) と
[`docs/changes-2.md`](docs/changes-2.md) に、
そのほかの制限事項は [`docs/notes.md`](docs/notes.md) にまとめています。
