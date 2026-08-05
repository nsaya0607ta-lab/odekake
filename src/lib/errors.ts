/** Supabase / PostgREST のエラーを日本語のメッセージへ変換する */

type UnknownError = {
  message?: string;
  code?: string;
  status?: number;
  name?: string;
} | null;

const AUTH_MESSAGES: Array<[RegExp, string]> = [
  [/invalid login credentials/i, "メールアドレスまたはパスワードが違います。"],
  [/email not confirmed/i, "メールアドレスの確認が完了していません。確認メールのリンクを開いてください。"],
  [/user already registered|already been registered/i, "このメールアドレスはすでに登録されています。"],
  [/password should be at least/i, "パスワードは8文字以上で入力してください。"],
  [/weak.?password/i, "パスワードが簡単すぎます。英字と数字を組み合わせてください。"],
  [/unable to validate email address|invalid email/i, "メールアドレスの形式が正しくありません。"],
  [/email rate limit exceeded|over_email_send_rate_limit/i, "メールの送信回数が上限に達しました。しばらく待って再度お試しください。"],
  [/for security purposes|rate limit|too many requests/i, "操作が続けて行われました。少し時間をおいて再度お試しください。"],
  [/token has expired|otp_expired|invalid or has expired/i, "リンクの有効期限が切れています。もう一度手続きをやり直してください。"],
  [/new password should be different/i, "現在と同じパスワードは設定できません。"],
  [/session|jwt|refresh token/i, "ログイン状態の期限が切れました。もう一度ログインしてください。"],
  [/same email/i, "現在と同じメールアドレスです。"],
];

const DB_MESSAGES: Record<string, string> = {
  "23505": "同じ内容がすでに登録されています。",
  "23503": "参照先のデータが見つかりません。削除された可能性があります。",
  "23514": "入力内容が条件を満たしていません。",
  "42501": "この操作を行う権限がありません。",
  PGRST116: "対象のデータが見つかりません。",
  PGRST301: "ログイン状態の期限が切れました。もう一度ログインしてください。",
};

const RPC_MESSAGES: Array<[RegExp, string]> = [
  [/INVITATION_NOT_FOUND/, "招待コードが見つかりません。コードをご確認ください。"],
  [/INVITATION_EXPIRED/, "招待コードの有効期限が切れています。旅行の作成者に再発行を依頼してください。"],
  [/INVITATION_CANCELLED/, "この招待は取り消されています。"],
  [/TRIP_NOT_SHARED/, "この旅行は共有旅ではないため参加できません。"],
  [/AUTH_REQUIRED/, "ログインが必要です。"],
];

export function toJapaneseError(error: UnknownError, fallback = "処理に失敗しました。時間をおいて再度お試しください。") {
  if (!error) return fallback;

  const message = error.message ?? "";

  for (const [pattern, text] of RPC_MESSAGES) {
    if (pattern.test(message)) return text;
  }

  if (error.code && DB_MESSAGES[error.code]) return DB_MESSAGES[error.code];

  for (const [pattern, text] of AUTH_MESSAGES) {
    if (pattern.test(message)) return text;
  }

  if (/fetch failed|network|ECONNREFUSED|ENOTFOUND|Failed to fetch/i.test(message)) {
    return "通信に失敗しました。電波状況を確認して、もう一度お試しください。";
  }

  return fallback;
}

/** ストレージ操作向けのメッセージ */
export function toJapaneseStorageError(error: UnknownError) {
  const message = error?.message ?? "";
  if (/exceeded the maximum allowed size|Payload too large/i.test(message)) {
    return "画像のサイズが大きすぎます。別の画像をお試しください。";
  }
  if (/mime type|not supported/i.test(message)) {
    return "この形式の画像には対応していません。JPEG・PNG・WebP をお使いください。";
  }
  return toJapaneseError(error, "画像のアップロードに失敗しました。もう一度お試しください。");
}
