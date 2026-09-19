"use client";

import { useState } from "react";

type Status = "idle" | "loading" | "ready" | "error";

export function VisitShortcutSetup({ endpoint }: { endpoint: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const [token, setToken] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState<"token" | "endpoint" | null>(null);

  async function issueToken() {
    setStatus("loading");
    setMessage(null);
    setCopied(null);

    try {
      const response = await fetch("/api/steps/token", { method: "POST" });
      const body = (await response.json()) as { token?: string; error?: string };
      if (!response.ok || !body.token) throw new Error(body.error ?? "連携キーを発行できませんでした。");
      setToken(body.token);
      setStatus("ready");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "連携キーを発行できませんでした。");
    }
  }

  async function copy(value: string, kind: "token" | "endpoint") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      setMessage("コピーできませんでした。長押ししてコピーしてください。");
    }
  }

  return (
    <div className="space-y-5">
      <section className="rough-card bg-leaf-soft/35 p-5">
        <p className="font-bold">ショートカットの動き</p>
        <p className="mt-2 text-sm leading-7 text-ink-soft">
          ホーム画面のショートカットを押すと、現在地の周辺施設が表示されます。
          場所を1つ選ぶと、そのまま「自分のおでかけ」へ登録されます。
        </p>
      </section>

      <section className="rough-card p-5">
        <p className="font-bold">1. iPhone連携キーを発行</p>
        <p className="mt-2 text-xs leading-6 text-ink-soft">
          このキーで登録者を判別します。パスワードと同じ扱いなので、他人やSNSには共有しないでください。
        </p>

        {token ? (
          <div className="mt-4 rounded-2xl border border-line bg-paper-deep/60 p-3">
            <p className="text-[10px] font-semibold text-ink-faint">iPhone連携キー</p>
            <p className="mt-1 break-all font-mono text-xs text-ink">{token}</p>
            <button type="button" className="btn btn-quiet mt-3 w-full" onClick={() => copy(token, "token")}>
              {copied === "token" ? "コピーしました" : "連携キーをコピー"}
            </button>
          </div>
        ) : null}

        <button type="button" className="btn btn-primary mt-4 w-full" onClick={issueToken} disabled={status === "loading"}>
          {status === "loading" ? "発行中…" : token ? "新しい連携キーを再発行" : "連携キーを発行"}
        </button>
        <p className="mt-2 text-[10px] leading-5 text-ink-faint">
          再発行すると以前のキーは無効になります。歩数連携でも同じキーを使っている場合は、歩数ショートカット側も更新してください。
        </p>
      </section>

      <section className="rough-card p-5">
        <p className="font-bold">2. ショートカットを作成</p>
        <ol className="mt-3 space-y-3 text-xs leading-6 text-ink-soft">
          <li><b className="text-ink">①</b> 「ショートカット」アプリで右上の「＋」を押します。</li>
          <li><b className="text-ink">②</b> 「現在地を取得」を追加します。</li>
          <li>
            <b className="text-ink">③</b> 「メニューから選択」を追加し、「飲食店」「カフェ」「観光スポット」
            「買い物」「ホテル」「駅」「その他」を登録します。
          </li>
          <li>
            <b className="text-ink">④</b> 各メニュー内に「ローカルビジネスを検索」を追加します。
            検索語をメニュー名、検索する場所を「現在地」にします。
          </li>
          <li><b className="text-ink">⑤</b> 検索結果の後ろに「リストから選択」を追加し、周辺候補から1つ選べるようにします。</li>
          <li>
            <b className="text-ink">⑥</b> 選んだ場所から「名前」「住所」「緯度」「経度」を取得します。
            変数をタップすると、取り出す項目を変更できます。
          </li>
          <li><b className="text-ink">⑦</b> 「URLの内容を取得」を追加し、下の設定で送信します。</li>
        </ol>
        <p className="mt-3 rounded-xl bg-paper-deep px-3 py-2 text-[11px] leading-5 text-ink-faint">
          「ローカルビジネスを検索」は検索語が必須です。「その他」だけは「入力を要求」を入れ、店名や種類を入力できるようにします。
        </p>
      </section>

      <section className="rough-card p-5">
        <p className="font-bold">3. 送信設定</p>
        <div className="mt-3 space-y-4 text-xs leading-6 text-ink-soft">
          <div>
            <p className="font-semibold text-ink">URL</p>
            <p className="mt-1 break-all rounded-xl bg-paper-deep p-2 font-mono text-[11px]">{endpoint}</p>
            <button type="button" className="btn btn-quiet mt-2 w-full" onClick={() => copy(endpoint, "endpoint")}>
              {copied === "endpoint" ? "コピーしました" : "URLをコピー"}
            </button>
          </div>

          <dl className="grid grid-cols-[92px_1fr] gap-x-2 gap-y-2">
            <dt className="font-semibold text-ink">方法</dt><dd>POST</dd>
            <dt className="font-semibold text-ink">本文</dt><dd>JSON</dd>
            <dt className="font-semibold text-ink">ヘッダー名</dt><dd className="font-mono">Authorization</dd>
            <dt className="font-semibold text-ink">ヘッダー値</dt><dd className="break-all font-mono">Bearer 連携キー</dd>
          </dl>

          <div>
            <p className="font-semibold text-ink">JSON本文</p>
            <pre className="mt-1 overflow-x-auto rounded-xl bg-paper-deep p-3 font-mono text-[11px] leading-5 text-ink">{
`{
  "name": 選んだ場所の名前,
  "address": 選んだ場所の住所,
  "latitude": 選んだ場所の緯度,
  "longitude": 選んだ場所の経度
}`
            }</pre>
          </div>
        </div>
      </section>

      <section className="rough-card p-5">
        <p className="font-bold">4. ホーム画面へ追加</p>
        <p className="mt-2 text-xs leading-6 text-ink-soft">
          ショートカット名を「おでかけ登録」にし、詳細メニューから「ホーム画面に追加」を選びます。
          初回だけ位置情報と通信の許可が表示されます。
        </p>
      </section>

      {message ? (
        <p className={`rounded-2xl px-4 py-3 text-xs ${
          status === "error" ? "bg-blossom-soft text-[#95505e]" : "bg-paper-deep text-ink-soft"
        }`}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
