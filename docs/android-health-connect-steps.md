# Android Health Connect 歩数連携

`android-step-sync/` はHealth Connectから今日の合計歩数を読み取り、既存の
`/api/steps/sync`へ送信するAndroidアプリです。Google Play公開は不要です。

## Android Studioで実行

1. Android Studioの **Open** から `android-step-sync` フォルダーを開く。
2. Gradle Syncが完了するまで待つ。
3. API 35のPixel 8エミュレーターを起動し、Runでアプリをインストールする。
4. Web版の「歩数連携」で表示される送信先URLと連携キーを入力する。
5. Health Connectの歩数を許可して「今すぐ同期」を押す。

ローカルのNext.jsへ送る場合は `http://10.0.2.2:3000/api/steps/sync`、
本番ではWeb画面に表示されるHTTPSのURLを使用します。

## テスト歩数

Google公式のHealth Connect Toolbox APKを取得し、Android StudioのTerminalから
`adb install HealthConnectToolbox-*.apk` でエミュレーターへ入れます。ToolboxでStepsを
追加した後、「今すぐ同期」で反映を確認します。

## 直接配布用APK

テスト用は **Build > Build APK(s)**、継続配布する正式版は
**Build > Generate Signed App Bundle or APK > APK** で作成します。署名キーストアは
リポジトリへコミットせず、紛失しない場所へバックアップしてください。同じapplicationIdと
署名鍵なら、利用者は以前のアプリを消さずに上書き更新できます。

## 仕様

- 手動同期と約6時間ごとのWorkManager自動同期
- Health Connect Aggregate APIで端末のローカル日付0時から現在までを集計
- Web版で発行するBearer連携キーで認証
- 同日の歩数は上書きされ、複数回同期してもEXPは重複しない
- 送信先と連携キーはAndroid KeystoreのAES-GCM鍵で暗号化
- 歩数以外のHealth Connect権限は要求しない
