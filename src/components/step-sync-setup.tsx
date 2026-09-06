"use client";

import { useState } from "react";

type Status = "idle" | "loading" | "ready" | "revoked" | "error";

export function StepSyncSetup({ endpoint }: { endpoint: string }) {
  const [platform, setPlatform] = useState<"iphone" | "android">("iphone");
  const [status, setStatus] = useState<Status>("idle");
  const [token, setToken] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [endpointCopied, setEndpointCopied] = useState(false);

  async function issueToken() {
    setStatus("loading");
    setMessage(null);
    setCopied(false);

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

  async function revokeToken() {
    setStatus("loading");
    setMessage(null);

    try {
      const response = await fetch("/api/steps/token", { method: "DELETE" });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "連携を解除できませんでした。");
      setToken(null);
      setStatus("revoked");
      setMessage("歩数連携を解除しました。以前の連携キーは使えません。");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "連携を解除できませんでした。");
    }
  }

  async function copyToken() {
    if (!token) return;
    await navigator.clipboard.writeText(token);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function copyEndpoint() {
    await navigator.clipboard.writeText(endpoint);
    setEndpointCopied(true);
    window.setTimeout(() => setEndpointCopied(false), 1800);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-paper-deep p-1.5">
        <button
          type="button"
          className={`rounded-xl px-3 py-2.5 text-sm font-bold ${platform === "iphone" ? "bg-card text-ink shadow-sm" : "text-ink-soft"}`}
          onClick={() => setPlatform("iphone")}
        >
          iPhone
        </button>
        <button
          type="button"
          className={`rounded-xl px-3 py-2.5 text-sm font-bold ${platform === "android" ? "bg-card text-ink shadow-sm" : "text-ink-soft"}`}
          onClick={() => setPlatform("android")}
        >
          Android
        </button>
      </div>

      <section className="rough-card p-5">
        <p className="text-sm font-bold">
          {platform === "iphone" ? "iPhoneヘルスケア → おでかけ記録" : "Android Health Connect → おでかけ記録"}
        </p>
        <p className="mt-2 text-xs leading-6 text-ink-soft">
          {platform === "iphone"
            ? "iPhoneの「ショートカット」を橋渡しにして、ヘルスケアの歩数をこのアプリへ送ります。"
            : "Android用の歩数連携アプリが、Health Connectの今日の歩数をこのアプリへ送ります。"}
          同じ日の歩数は上書き同期されるため、何度実行しても歩数EXPが重複することはありません。
        </p>
      </section>

      <section className="rough-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-bold">1. 連携キーを発行</p>
            <p className="mt-1 text-xs leading-5 text-ink-soft">
              キーはパスワードと同じ扱いです。SNSや他人には共有しないでください。
            </p>
          </div>
          <span className="rounded-full bg-leaf-soft px-2.5 py-1 text-[10px] font-semibold text-leaf-deep">Bearerキー</span>
        </div>

        {token ? (
          <div className="mt-4 rounded-2xl border border-line bg-paper-deep/60 p-3">
            <p className="text-[10px] font-semibold text-ink-faint">連携キー</p>
            <p className="mt-1 break-all font-mono text-xs text-ink">{token}</p>
            <button type="button" className="btn btn-quiet mt-3 w-full" onClick={copyToken}>
              {copied ? "コピーしました" : "連携キーをコピー"}
            </button>
          </div>
        ) : null}

        <button type="button" className="btn btn-primary mt-4 w-full" onClick={issueToken} disabled={status === "loading"}>
          {status === "loading" ? "処理中…" : token ? "新しい連携キーを再発行" : "連携キーを発行"}
        </button>
        <p className="mt-2 text-[10px] leading-5 text-ink-faint">
          再発行すると、以前の連携キーは即座に無効になります。
        </p>
      </section>

      {platform === "iphone" ? <section className="rough-card p-5">
        <p className="font-bold">2. iPhoneのショートカットを作成</p>
        <ol className="mt-3 space-y-3 text-xs leading-6 text-ink-soft">
          <li><span className="font-bold text-ink">①</span> ヘルスケアから「今日の歩数」の合計を取得します。</li>
          <li><span className="font-bold text-ink">②</span> 「URLの内容を取得」で下のURLへ <b>POST</b> します。</li>
          <li><span className="font-bold text-ink">③</span> ヘッダーに <code className="rounded bg-paper-deep px-1">Authorization</code> を追加し、値を <code className="rounded bg-paper-deep px-1">Bearer 連携キー</code> にします。</li>
          <li><span className="font-bold text-ink">④</span> JSON本文に <code className="rounded bg-paper-deep px-1">steps</code> を作り、取得した歩数合計を入れます。</li>
        </ol>

        <div className="mt-4 rounded-2xl border border-line bg-paper-deep/60 p-3 text-xs">
          <p className="text-[10px] font-semibold text-ink-faint">送信先URL</p>
          <p className="mt-1 break-all font-mono text-[11px] text-ink">{endpoint}</p>
          <p className="mt-3 text-[10px] font-semibold text-ink-faint">JSON</p>
          <pre className="mt-1 overflow-x-auto rounded-xl bg-card p-2 font-mono text-[11px] text-ink">{`{\n  "steps": 今日の歩数合計\n}`}</pre>
        </div>
      </section> : (
        <section className="rough-card p-5">
          <p className="font-bold">2. Android連携アプリを設定</p>
          <ol className="mt-3 space-y-3 text-xs leading-6 text-ink-soft">
            <li><span className="font-bold text-ink">①</span> Android Studioから「おでかけ歩数連携」を端末へインストールします。</li>
            <li><span className="font-bold text-ink">②</span> 下の送信先URLと、上で発行した連携キーをアプリに入力します。</li>
            <li><span className="font-bold text-ink">③</span> Health Connectの「歩数」と「バックグラウンド読み取り」を許可します。</li>
            <li><span className="font-bold text-ink">④</span> 「今すぐ同期」を押して、歩数が反映されることを確認します。</li>
          </ol>
          <div className="mt-4 rounded-2xl border border-line bg-paper-deep/60 p-3 text-xs">
            <p className="text-[10px] font-semibold text-ink-faint">送信先URL</p>
            <p className="mt-1 break-all font-mono text-[11px] text-ink">{endpoint}</p>
            <button type="button" className="btn btn-quiet mt-3 w-full" onClick={copyEndpoint}>
              {endpointCopied ? "コピーしました" : "送信先URLをコピー"}
            </button>
          </div>
        </section>
      )}

      <section className="rough-card p-5">
        <p className="font-bold">3. {platform === "iphone" ? "自動化" : "自動同期"}</p>
        <p className="mt-2 text-xs leading-6 text-ink-soft">
          {platform === "iphone"
            ? "ショートカットの「オートメーション」で時刻を指定して実行します。1日1回でも使えますが、昼・夕方・夜に複数回実行しても同じ日の歩数を更新するだけなので安全です。"
            : "Android連携アプリが約6時間ごとに同期します。Androidの省電力設定で遅れる場合は、アプリの「今すぐ同期」を使用してください。"}
        </p>
      </section>

      {message ? (
        <p className={`rounded-2xl px-4 py-3 text-xs ${status === "error" ? "bg-blossom-soft text-[#95505e]" : "bg-leaf-soft text-leaf-deep"}`}>
          {message}
        </p>
      ) : null}

      <button type="button" className="btn btn-quiet w-full" onClick={revokeToken} disabled={status === "loading"}>
        歩数連携を解除
      </button>
    </div>
  );
}
