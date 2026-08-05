import Link from "next/link";

export const metadata = { title: "利用規約 | おでかけ記録" };

export default function TermsPage() {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-2xl px-5 py-10">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">利用規約</h1>
        <Link href="/login" className="text-sm text-leaf-deep underline underline-offset-4">
          アプリへ戻る
        </Link>
      </div>

      <div className="rough-card space-y-6 p-5 text-sm leading-relaxed text-ink-soft">
        <p>最終更新日: 2026年8月6日</p>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-ink">サービスについて</h2>
          <p>
            おでかけ記録は、旅行、スポットおよび訪問履歴を保存し、共有旅の参加者と記録を共有できるサービスです。
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-ink">利用者の責任</h2>
          <p>
            利用者は、登録する文章、写真その他の情報について必要な権利を有し、第三者の権利や法令を侵害しないものとします。アカウント情報と招待コードは適切に管理してください。
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-ink">禁止事項</h2>
          <p>
            不正アクセス、サービスの妨害、他人へのなりすまし、違法または有害な情報の登録、外部APIへの過剰な自動アクセスなどを禁止します。
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-ink">Google Maps Platform</h2>
          <p>
            スポット検索にはGoogle Maps Platformを使用します。Google マップのコンテンツの利用には、Google Maps Platformの利用規約およびGoogleのプライバシーポリシーが適用されます。
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <a
              href="https://cloud.google.com/maps-platform/terms"
              target="_blank"
              rel="noreferrer noopener"
              className="text-leaf-deep underline underline-offset-4"
            >
              Google Maps Platform利用規約
            </a>
            <a
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noreferrer noopener"
              className="text-leaf-deep underline underline-offset-4"
            >
              Googleプライバシーポリシー
            </a>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-ink">サービスの変更・停止</h2>
          <p>
            保守、障害、安全確保または仕様変更のため、サービスの全部または一部を変更・停止する場合があります。重要な変更は、可能な範囲でアプリ内などに表示します。
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-ink">免責</h2>
          <p>
            外部サービスから取得する店舗情報、住所、営業時間などの正確性や最新性を保証するものではありません。重要な情報は公式サイトや施設へ確認してください。
          </p>
        </section>
      </div>
    </main>
  );
}
