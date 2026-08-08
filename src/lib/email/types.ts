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
