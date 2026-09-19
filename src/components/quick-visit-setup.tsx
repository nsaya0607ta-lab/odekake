"use client";

import Link from "next/link";
import { useState } from "react";

export function QuickVisitSetup({ shortcutUrl }: { shortcutUrl: string }) {
  const [copied, setCopied] = useState(false);

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(shortcutUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rough-card p-5">
        <p className="font-bold">できること</p>
        <p className="mt-2 text-sm leading-7 text-ink-soft">
          ホーム画面の「おでかけ登録」を押すと現在地を確認し、500m以内のお店・施設を近い順に表示します。
          場所を選んで「この場所を登録」を押すだけで完了します。
        </p>
      </section>

      <section className="rough-card p-5">
        <p className="font-bold">iPhoneにショートカットを追加</p>
        <ol className="mt-3 space-y-3 text-sm leading-6 text-ink-soft">
          <li><b className="text-ink">1.</b> 下のURLをコピーします。</li>
          <li><b className="text-ink">2.</b> iPhoneの「ショートカット」アプリを開き、右上の「＋」を押します。</li>
          <li><b className="text-ink">3.</b> 「URLを開く」アクションを追加し、コピーしたURLを設定します。</li>
          <li><b className="text-ink">4.</b> 名前を「おでかけ登録」にして、共有メニューから「ホーム画面に追加」を押します。</li>
        </ol>

        <div className="mt-4 rounded-2xl border border-line bg-paper-deep/60 p-3">
          <p className="text-[10px] font-semibold text-ink-faint">ショートカットで開くURL</p>
          <p className="mt-1 break-all font-mono text-[11px] text-ink">{shortcutUrl}</p>
          <button type="button" onClick={copyUrl} className="btn btn-primary mt-3 w-full">
            {copied ? "コピーしました" : "URLをコピー"}
          </button>
        </div>
      </section>

      <section className="rough-card p-5">
        <p className="font-bold">最初の1回だけ</p>
        <p className="mt-2 text-sm leading-7 text-ink-soft">
          初回はログインと位置情報の許可が必要です。一度許可すると、次回からはショートカットを押してすぐ周辺候補を表示できます。
        </p>
      </section>

      <Link href="/quick-visit" className="btn btn-quiet w-full">
        かんたん場所登録を試す
      </Link>
    </div>
  );
}
