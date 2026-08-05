import Link from "next/link";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata = { title: "パスワード再設定 | おでかけ記録" };

export default function ForgotPasswordPage() {
  return (
    <div className="rough-card p-6">
      <h2 className="mb-1 text-lg font-bold">パスワードを再設定</h2>
      <p className="mb-5 text-sm leading-relaxed text-ink-soft">
        ご登録のメールアドレスを入力してください。再設定用のリンクをお送りします。
      </p>

      <ForgotPasswordForm />

      <p className="mt-6 text-center text-sm">
        <Link href="/login" className="text-leaf-deep underline underline-offset-4">
          ログイン画面へ戻る
        </Link>
      </p>
    </div>
  );
}
