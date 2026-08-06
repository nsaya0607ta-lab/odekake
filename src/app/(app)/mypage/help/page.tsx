import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";

const FAQS = [
  {
    q: "個人旅と共有旅の違いは？",
    a: "個人旅は自分だけの記録です。共有旅はメンバーを招待して、同じ地図・スポット・訪問履歴を一緒に記録できます。",
  },
  {
    q: "場所を登録してから記録するには？",
    a: "「追加」タブから「行った場所を登録」で新しい場所と訪問記録をまとめて登録できます。以前登録した場所には「登録済みの場所に記録」から追加できます。",
  },
  {
    q: "旅行の計画はどこで作れますか？",
    a: "「追加」タブ、またはマイページの「旅行の計画」から作成できます。日程や表紙を設定して、複数の訪問記録をひとつの旅行としてまとめられます。",
  },
  {
    q: "お気に入り・行きたい場所とは？",
    a: "お気に入りは場所の詳細画面でハートを押した場所です。行きたい場所は登録済みでまだ訪問記録がない場所を指します。",
  },
];

export const metadata = { title: "ヘルプ・お問い合わせ | おでかけ記録" };

export default function HelpPage() {
  return (
    <>
      <PageHeader title="ヘルプ・お問い合わせ" backHref="/mypage" />
      <PageBody>
        <section className="space-y-2">
          <h2 className="px-1 text-base font-bold">よくある質問</h2>
          <ul className="space-y-2">
            {FAQS.map((item) => (
              <li key={item.q} className="rough-card p-4">
                <p className="font-semibold">{item.q}</p>
                <p className="mt-1 text-sm leading-relaxed text-ink-soft">{item.a}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="rough-card p-4">
          <p className="font-semibold">お問い合わせ</p>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">
            アプリの使い方や不具合について気になることがあれば、開発者へお知らせください。
          </p>
        </section>
      </PageBody>
    </>
  );
}
