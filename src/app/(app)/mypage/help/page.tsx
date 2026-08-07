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
    q: "お気に入り・また行きたい場所とは？",
    a: "どちらも訪問の記録に付けます。お気に入りはスポットの詳細画面のハート、または記録するときのチェックから付けられます。「また行きたい」は記録するときのチェックです。付けたものはマイページからまとめて見られます。",
  },
  {
    q: "共有旅から抜けたいときは？",
    a: "共有旅の詳細画面の一番下にある「この旅行から退出する」から抜けられます。旅行を作った人は退出できないため、旅行ごと削除するか、他のメンバーを外してください。",
  },
  {
    q: "入力の途中で画面を閉じても大丈夫？",
    a: "登録フォームの入力内容は自動で下書き保存されます。場所の指定・評価・写真も含めて、同じ画面を開き直すと復元されます。保存すると下書きは消えます。",
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
            連絡先はこの画面に用意していないため、直接お伝えください。
          </p>
        </section>
      </PageBody>
    </>
  );
}
