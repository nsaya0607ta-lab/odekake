/**
 * Resend による招待メールの送信
 * =============================================================
 * HTTP API を直接叩くので追加の依存はありません。APIキーはサーバー側の
 * 環境変数だけに置き、ブラウザへは渡しません（仕様書29章の方針）。
 *
 *   EMAIL_PROVIDER=resend
 *   RESEND_API_KEY=re_xxxxxxxx
 *   EMAIL_FROM="おでかけ記録 <noreply@example.com>"   ← 認証済みドメインの宛先
 *   EMAIL_REPLY_TO=support@example.com                 ← 任意
 *
 * 送信元ドメインを Resend で認証していないと 403 で失敗します。
 * 失敗の理由は trip_invitations.email_error に残り、旅行の設定画面に出ます。
 */
import type { Mailer, MailMessage, MailResult } from "./types";

const ENDPOINT = "https://api.resend.com/emails";
const TIMEOUT_MS = 10_000;

/** 主催者に見せる文言。APIキーなどの内部情報は載せない */
function describeFailure(status: number, message: string): string {
  if (status === 401 || status === 403) {
    return "メール送信の設定（APIキーまたは送信元ドメイン）が正しくありません。";
  }
  if (status === 422) {
    return `宛先または送信元を受け付けられませんでした。${message}`.trim();
  }
  if (status === 429) {
    return "送信の上限に達しました。時間をおいてもう一度お試しください。";
  }
  return `メールの送信に失敗しました（${status}）。${message}`.trim();
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (body && typeof body === "object" && "message" in body) {
      return String((body as { message: unknown }).message).slice(0, 200);
    }
  } catch {
    // 本文が JSON でないこともある（プロキシのエラーページなど）
  }
  return "";
}

export function createResendMailer(): Mailer {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  const replyTo = process.env.EMAIL_REPLY_TO?.trim();

  // 設定が欠けているときは「送信できる」と名乗らない。
  // 画面は招待コードとリンクを共有する案内のままになる。
  if (!apiKey || !from) {
    console.error("EMAIL_PROVIDER=resend ですが、RESEND_API_KEY と EMAIL_FROM が設定されていません。");
    return {
      id: "resend",
      label: "Resend（未設定）",
      enabled: false,
      async send() {
        return { status: "not_sent", error: "メール送信の設定が未完了です。" };
      },
    };
  }

  return {
    id: "resend",
    label: "Resend",
    enabled: true,
    async send(message: MailMessage): Promise<MailResult> {
      let response: Response;
      try {
        response = await fetch(ENDPOINT, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from,
            to: [message.to],
            subject: message.subject,
            text: message.text,
            ...(message.html ? { html: message.html } : {}),
            ...(replyTo ? { reply_to: replyTo } : {}),
          }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch (error: unknown) {
        console.error("Resend request failed", error);
        return {
          status: "failed",
          error: "メールの送信先へ接続できませんでした。時間をおいてもう一度お試しください。",
        };
      }

      if (!response.ok) {
        const detail = await readErrorMessage(response);
        console.error("Resend responded with an error", { status: response.status, detail });
        return { status: "failed", error: describeFailure(response.status, detail) };
      }

      // 受け付けた時点で 200 が返り、その先の配送結果は通知されない。
      // アプリから追跡できないため queued のままにせず sent として記録する
      // （配送の失敗は Resend の管理画面で確認する）。
      return { status: "sent" };
    },
  };
}
