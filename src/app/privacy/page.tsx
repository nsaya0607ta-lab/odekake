import Link from "next/link";

export const metadata = { title: "プライバシーポリシー | おでかけ記録" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-2xl px-5 py-10">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">プライバシーポリシー</h1>
        <Link href="/login" className="text-sm text-leaf-deep underline underline-offset-4">
          アプリへ戻る
        </Link>
      </div>

      <div className="rough-card space-y-6 p-5 text-sm leading-relaxed text-ink-soft">
        <p>最終更新日: 2026年8月6日</p>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-ink">取得する情報</h2>
          <p>
            アカウント情報、旅行・スポット・訪問履歴、投稿した写真、端末から許可された位置情報などを、サービス提供のために取り扱います。
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-ink">利用目的</h2>
          <p>
            旅行記録の保存・共有、地図表示、スポット検索、本人確認、不正利用の防止、障害調査およびサービス改善に利用します。
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-ink">Google Maps Platform</h2>
          <p>
            店舗・施設検索にはGoogle Places APIを使用します。検索語、選択した場所、検索位置を調整するための座標がGoogleへ送信される場合があります。検索候補などのGoogle マップのコンテンツには、Googleの利用規約とプライバシーポリシーが適用されます。
          </p>
          <p>
            アプリには、選択したスポット名、住所、座標、郵便番号およびPlace IDを保存する場合があります。
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <a
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noreferrer noopener"
              className="text-leaf-deep underline underline-offset-4"
            >
              Googleプライバシーポリシー
            </a>
            <a
              href="https://cloud.google.com/maps-platform/terms"
              target="_blank"
              rel="noreferrer noopener"
              className="text-leaf-deep underline underline-offset-4"
            >
              Google Maps Platform利用規約
            </a>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-ink">外部サービス</h2>
          <p>
            認証・データ保存にはSupabase、アプリ配信にはVercelなどの外部サービスを利用します。各サービスでは、それぞれの規約とプライバシーポリシーに従って情報が処理されます。
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-ink">保存と削除</h2>
          <p>
            利用者はアプリ内で旅行、スポット、訪問履歴を編集または削除できます。法令上または安全上必要な場合を除き、利用目的を超えて情報を保持しません。
          </p>
        </section>
      </div>
    </main>
  );
}
