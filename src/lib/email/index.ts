/**
 * メール送信の入り口
 * =============================================================
 * 提供元は環境変数 EMAIL_PROVIDER で選びます。
 *
 *   none    … 送信しない（既定）。招待コードと招待リンクを画面から共有します。
 *   resend  … Resend で送る。RESEND_API_KEY と EMAIL_FROM が必要です。
 *
 * 別の提供元を足すときは Mailer を実装して registerMailer() で登録します。
 * 呼び出し側（サーバーアクション）は変更不要で、送信結果は
 * trip_invitations.email_status に残ります。
 *
 *   not_sent … 送信していない（提供元が none、または未設定）
 *   queued  … 送信を受け付けた（非同期に送る提供元の場合）
 *   sent    … 送信できた
 *   failed  … 送信に失敗した（email_error に理由）
 */
import { createResendMailer } from "./resend";
import type { Mailer, MailMessage, MailResult } from "./types";

export type { Mailer, MailMessage, MailResult };

const noopMailer: Mailer = {
  id: "none",
  label: "送信しない",
  enabled: false,
  async send() {
    return { status: "not_sent" };
  },
};

/** 組み込みの提供元。設定を読むのは最初に使うときだけにする */
const BUILTIN_MAILERS: Record<string, () => Mailer> = {
  resend: createResendMailer,
};

const MAILERS: Record<string, Mailer> = {
  none: noopMailer,
};

export function registerMailer(mailer: Mailer) {
  MAILERS[mailer.id] = mailer;
}

export function getMailer(): Mailer {
  const id = (process.env.EMAIL_PROVIDER ?? "none").trim().toLowerCase() || "none";

  const registered = MAILERS[id];
  if (registered) return registered;

  const builtin = BUILTIN_MAILERS[id];
  if (builtin) {
    const mailer = builtin();
    MAILERS[id] = mailer;
    return mailer;
  }

  console.error(`EMAIL_PROVIDER に未知の値が設定されています: ${id}`);
  return noopMailer;
}

export type TripInvitationMail = {
  to: string;
  tripTitle: string;
  inviterName: string;
  inviteCode: string;
  joinUrl: string;
  message?: string | null;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderTripInvitationMail(input: TripInvitationMail): MailMessage {
  const lines = [
    `${input.inviterName}さんから、おでかけ記録の共有旅「${input.tripTitle}」に招待されました。`,
    "",
    ...(input.message ? [input.message, ""] : []),
    "下のリンクを開くと参加できます。",
    input.joinUrl,
    "",
    `リンクが開けない場合は、アプリで招待コード ${input.inviteCode} を入力してください。`,
    "",
    `※ 招待は ${input.to} 宛です。別のメールアドレスで登録している場合は、招待コードを入力して参加してください。`,
    "",
    "――――――",
    "このメールに心当たりがない場合は、破棄してください。",
  ];

  const html = [
    '<div style="font-family:sans-serif;line-height:1.8;color:#3d3a36">',
    `<p>${escapeHtml(input.inviterName)}さんから、おでかけ記録の共有旅「${escapeHtml(input.tripTitle)}」に招待されました。</p>`,
    ...(input.message ? [`<blockquote style="margin:0 0 16px;padding:8px 12px;border-left:3px solid #d8dfcb">${escapeHtml(input.message)}</blockquote>`] : []),
    `<p><a href="${escapeHtml(input.joinUrl)}">共有旅に参加する</a></p>`,
    `<p>リンクが開けない場合は、アプリで招待コード <strong>${escapeHtml(input.inviteCode)}</strong> を入力してください。</p>`,
    `<p style="font-size:12px;color:#7a746c">※ 招待は ${escapeHtml(input.to)} 宛です。別のメールアドレスで登録している場合は、招待コードを入力して参加してください。</p>`,
    '<hr style="border:none;border-top:1px solid #e5e2dc">',
    '<p style="font-size:12px;color:#7a746c">このメールに心当たりがない場合は、破棄してください。</p>',
    "</div>",
  ].join("");

  return {
    to: input.to,
    subject: `「${input.tripTitle}」への招待`,
    text: lines.join("\n"),
    html,
  };
}
