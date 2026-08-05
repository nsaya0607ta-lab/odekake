import Link from "next/link";
import { IconMail } from "@/components/icons";
import { ResendForm } from "./resend-form";

export const metadata = { title: "確認メールを送信しました | おでかけ記録" };

export default async function SignUpCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  return (
    <div className="rough-card p-6 text-center">
      <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-sky bg-sky-soft text-[#4a7492]">
        <IconMail size={28} />
      </span>
      <h2 className="mb-2 text-lg font-bold">確認メールを送信しました</h2>
      <p className="text-sm leading-relaxed text-ink-soft">
        {email ? <span className="font-semibold text-ink">{email}</span> : "ご登録のメールアドレス"} 宛に確認メールを送信しました。
        <br />
        メール内のリンクを開くと登録が完了します。
      </p>

      <p className="mt-4 rounded-2xl bg-paper-deep px-4 py-3 text-xs leading-relaxed text-ink-soft">
        メールが見つからない場合は、迷惑メールフォルダもご確認ください。
      </p>

      <div className="mt-6">
        <ResendForm email={email ?? ""} />
      </div>

      <Link href="/login" className="mt-5 inline-block text-sm text-leaf-deep underline underline-offset-4">
        ログイン画面へ
      </Link>
    </div>
  );
}
