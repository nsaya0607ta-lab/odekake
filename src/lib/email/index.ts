/**
 * メール送信の入り口
 * =============================================================
 * 初期版はメールを送りません（既定の提供元は none）。
 * 招待は作成され、招待コードと招待リンクを画面から共有します。
 *
 * あとから送信を足すときは、Mailer を実装して registerMailer() で登録し、
 * 環境変数 EMAIL_PROVIDER で切り替えます。呼び出し側（サーバーアクション）は
 * 変更不要で、送信結果は trip_invitations.email_status に残ります。
 *
 *   not_sent … 送信していない（提供元が none）
 *   queued  … 送信を受け付けた（非同期に送る提供元の場合）
 *   sent    … 送信できた
 *   failed  … 送信に失敗した（email_error に理由）
 */
import type { InvitationEmailStatus } from "@/lib/supabase/types";

export type MailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type MailResult = {
  status: InvitationEmailStatus;
  error?: string;
};

export type Mailer = {
  id: string;
  label: string;
  /** 画面に「招待メールを送る」と出してよいかどうか */
  enabled: boolean;
  send(message: MailMessage): Promise<MailResult>;
};

const noopMailer: Mailer = {
  id: "none",
  label: "送信しない",
  enabled: false,
  async send() {
    return { status: "not_sent" };
  },
};

const MAILERS: Record<string, Mailer> = {
  none: noopMailer,
};

export function registerMailer(mailer: Mailer) {
  MAILERS[mailer.id] = mailer;
}

export function getMailer(): Mailer {
  const id = process.env.EMAIL_PROVIDER ?? "none";
  return MAILERS[id] ?? noopMailer;
}

export type TripInvitationMail = {
  to: string;
  tripTitle: string;
  inviterName: string;
  inviteCode: string;
  joinUrl: string;
  message?: string | null;
};

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
    "――――――",
    "このメールに心当たりがない場合は、破棄してください。",
  ];

  return {
    to: input.to,
    subject: `「${input.tripTitle}」への招待`,
    text: lines.join("\n"),
  };
}
