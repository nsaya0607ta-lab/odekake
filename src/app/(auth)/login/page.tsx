import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata = { title: "ログイン | おでかけ記録" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; notice?: string }>;
}) {
  const { next, notice } = await searchParams;

  const noticeText =
    notice === "signed-out"
      ? "ログアウトしました。"
      : notice === "account-deleted"
        ? "アカウントを削除しました。ご利用ありがとうございました。"
        : notice === "confirm-failed"
          ? "リンクの有効期限が切れているか、すでに使用されています。もう一度お試しください。"
          : null;

  return (
    <div className="rough-card p-6">
      <h2 className="mb-1 text-lg font-bold">ログイン</h2>
      <p className="mb-5 text-sm text-ink-soft">登録したメールアドレスとパスワードを入力してください。</p>

      {noticeText ? (
        <p className="mb-4 rounded-2xl border border-sky bg-sky-soft px-4 py-3 text-sm text-[#3f6480]">{noticeText}</p>
      ) : null}

      <LoginForm next={next ?? "/home"} />

      <div className="mt-6 space-y-2 text-center text-sm">
        <p>
          <Link href="/forgot-password" className="text-leaf-deep underline underline-offset-4">
            パスワードを忘れた方
          </Link>
        </p>
        <p className="text-ink-soft">
          アカウントをお持ちでない方は{" "}
          <Link href="/signup" className="font-semibold text-leaf-deep underline underline-offset-4">
            新規登録
          </Link>
        </p>
      </div>
    </div>
  );
}
