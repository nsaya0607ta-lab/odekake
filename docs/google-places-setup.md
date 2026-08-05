# Google Places API（New）設定

スポット登録画面の「店舗検索」を有効にするための設定です。

## 1. Google Cloudで準備

1. Google Cloud Consoleでプロジェクトを作成または選択する
2. 請求先アカウントを関連付ける
3. **Places API（New）** を有効化する
4. APIキーを作成する
5. APIキーの「APIの制限」を **Places API（New）だけ** にする
6. 使用量の上限、予算通知を設定する

このアプリはGoogleへのリクエストをNext.jsのサーバー経由で送ります。APIキーをブラウザへ公開する `NEXT_PUBLIC_` 変数には入れないでください。

## 2. Vercelへ登録

Vercelのプロジェクト `odekake` で、Environment Variablesに次を追加します。

```text
Name: GOOGLE_PLACES_API_KEY
Value: Google Cloudで作成したAPIキー
Environments: Production / Preview / Development
```

保存後に本番をRedeployします。

## 3. 動作確認

1. アプリへログインする
2. 「追加」→「新しいスポット」を開く
3. 「店舗検索」で2文字以上入力する
4. 候補を選ぶ
5. スポット名、住所、郵便番号、座標、市区町村が自動入力されることを確認する

## 料金を抑える実装

- 入力停止から450ms後に検索
- 候補は最大5件
- 日本国内に限定
- セッショントークンを使用
- 詳細取得は住所・座標・郵便番号だけ
- 電話番号、営業時間、公式URLなど上位料金の項目は自動取得しない

## セキュリティ

- APIキーはサーバー専用環境変数に保存
- 検索APIはログイン必須
- Google側ではPlaces API（New）以外を利用できないように制限
- Google Cloudのクォータと予算通知を設定
