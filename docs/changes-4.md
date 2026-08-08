# 共有旅の廃止と、自分の旅の名前変更（第4版）

「共有旅に関係するところを全部消す」「個人旅の名前を変更できるようにする」という
ご指示にしたがって実装しました。共有旅は画面・コード・データベースのすべてから
削除し、ホームに出る名前を自分で決められるようにしています。

- [1. 削除したもの](#1-削除したもの)
- [2. 残したもの・変わる見え方](#2-残したもの変わる見え方)
- [3. 自分の旅の名前](#3-自分の旅の名前)
- [4. データベースの移行](#4-データベースの移行)
- [5. 適用の手順](#5-適用の手順)
- [6. 確認したこと](#6-確認したこと)

---

## 1. 削除したもの

### 画面

| 画面 | パス |
| --- | --- |
| 招待のお知らせ | `/invitations` |
| 招待リンクからの参加 | `/join/[code]` |
| 旅を選ぶ（ワークスペース切替） | `/workspaces` |
| 新しい共有旅 | `/trips/new/shared` |

旅行の設定画面からは「招待コード」「メールアドレスで招待」「招待の状況」「メンバー」の
各セクションを、旅行の詳細画面からは「参加メンバー」「みんなの動き」「コメント」
「この旅行から退出」を外しました。ホームのベル（招待のお知らせ）と
「旅を切替」ボタン、マイページの「共有旅の招待」も無くなっています。

`/trips/new/personal` は `/trips/new` に統合しました（種類がひとつになったため）。

### サーバーアクション

`inviteMemberAction` / `resendInvitationAction` / `cancelInvitationAction` /
`regenerateInviteCodeAction` / `removeMemberAction` / `leaveTripAction` /
`joinTripAction` / `acceptInvitationAction` / `addTripCommentAction` /
`deleteTripCommentAction` と、ワークスペース切替の `switchWorkspaceAction` /
`setCurrentWorkspace` を削除しました。

### メール送信

`src/lib/email/`（Resend の送信元を含む）をディレクトリごと削除しました。
招待がなくなったため、アプリからメールを送る用途がありません。
`EMAIL_PROVIDER` / `RESEND_API_KEY` / `EMAIL_FROM` / `EMAIL_REPLY_TO` の設定は
不要になります（確認メールとパスワード再設定は、これまでどおり Supabase Auth が送ります）。

### データベース

`trip_members` / `trip_invitations` / `trip_comments` / `trip_activities` の4テーブルと、
`trips.trip_type` / `trips.invite_code` の2列、`trip_type` / `trip_role` /
`invitation_status` / `trip_activity_action` の4つの列挙型、
`join_trip_by_code()` / `shares_trip_with()` / `is_shared_trip()` /
`has_pending_trip_invitation()` / `log_trip_activity()` と活動履歴のトリガー一式を削除しました。

`can_access_trip()` は名前と引数をそのままに、中身を「持ち主かどうか」だけの判定に
差し替えています（多くのポリシーとストレージの権限判定がこの関数を通るため）。

## 2. 残したもの・変わる見え方

旅行・訪問記録・スポット・写真・タグは、これまでどおりすべて残ります。

見え方で変わるのは次の3点です。

| これまで | これから |
| --- | --- |
| ホーム上部で旅を切り替える | 切り替えはなく、常に自分の記録すべてを表示 |
| タイムラインに「一人旅 / 共有旅」のバッジ | どの旅行の記録かを旅行名で表示 |
| スポット詳細に「◯◯さんの記録」 | 自分の記録しかないため省略 |

地図・記録・スポットの集計対象は「自分の旅行すべて」になり、マイページの合計と一致します。

## 3. 自分の旅の名前

ホームと記録画面の上に出る名前を変更できるようにしました。

- 保存先は `profiles.space_name`（30文字以内）
- 変更は **マイページ →「プロフィールを編集」→「自分の旅の名前」**
- 空にすると既定の「自分の旅」に戻ります
- ホームからは、あいさつ文の右にある「名前を変える」からも開けます

## 4. データベースの移行

`supabase/migrations/0008_remove_shared_trips.sql` が次の順で処理します。

1. 活動履歴のトリガーと、旅行作成時にメンバーを登録するトリガーを外す
2. `trips.trip_type` / `trips.invite_code` を落とす
3. **他の人の旅行に書いた自分の記録を、書いた本人の旅行へ移す**
4. 共有旅の4テーブルを削除する
5. `can_access_trip()` と `profiles` / `trips` の select ポリシーを差し替える
6. 共有旅のための関数を削除する
7. 使われなくなった列挙型を削除する
8. `profiles.space_name` を追加する

**3 が重要です。** 共有旅として作られた旅行は持ち主の個人の旅行になりますが、
自分が持ち主でない旅行に書いた記録は、そのままだと誰からも見えなくなります。
そこで、書いた本人がいちばん最初に作った旅行へ付け替えます（旅行を1つも
持っていない場合は「自分のおでかけ」を作ります）。

削除されて戻せないのは、招待・メンバー・コメント・活動履歴の4つです。
旅行・訪問記録・写真は削除しません。

## 5. 適用の手順

1. Supabase の SQL Editor に `supabase/migrations/0008_remove_shared_trips.sql` を
   貼り付けて実行します（`supabase db push` でも構いません）。
2. アプリをデプロイします。
3. Vercel などに `EMAIL_PROVIDER` / `RESEND_API_KEY` / `EMAIL_FROM` /
   `EMAIL_REPLY_TO` を設定していれば、削除して構いません（残っていても無視されます）。

SQL とデプロイの順序は、先に SQL を当てるほうが安全です
（新しいコードは `trip_type` 列を読み書きしないため、先に列が消えていても動きます）。

## 6. 確認したこと

```bash
npm run typecheck    # 通過
npm run lint         # 通過
npm run build        # 通過
./scripts/verify-rls.sh   # 73項目すべて成功
```

`supabase/tests/01_rls.test.sql` は共有旅の項目を落とし、代わりに

- 共有旅のテーブル・列・RPC が残っていないこと
- 旅行・記録・スポット・写真・プロフィールが他の利用者から一切見えないこと
- 自分の旅の名前を変更でき、空白だけの名前は保存できないこと

を確かめる項目を足しています。

`scripts/verify-supabase.mjs`（実プロジェクトでの確認）も、共有旅の節を
「別アカウントの記録が混ざらないこと」の確認に置き換えました。

### 冪等性の確認について

`scripts/verify-rls.sh` はこれまで全マイグレーションを2回適用していましたが、
0008 が列を落とすため、そのあとで 0001 / 0002 を流し直すことはできません
（存在しない列を参照する関数の作成で失敗します）。Supabase は適用済みの
マイグレーションを再実行しないため、最後のマイグレーションだけを二度流して
壊れないことを確かめる形に変更しました。
