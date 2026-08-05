import Link from "next/link";
import { SignUpForm } from "./signup-form";

export const metadata = { title: "新規登録 | おでかけ記録" };

export default function SignUpPage() {
  return (
    <div className="rough-card p-6">
      <h2 className="mb-1 text-lg font-bold">新規登録</h2>
      <p className="mb-5 text-sm text-ink-soft">
        登録後、確認メールが届きます。メール内のリンクを開くと利用を開始できます。
      </p>

      <SignUpForm />

      <p className="mt-6 text-center text-sm text-ink-soft">
        すでにアカウントをお持ちの方は{" "}
        <Link href="/login" className="font-semibold text-leaf-deep underline underline-offset-4">
          ログイン
        </Link>
      </p>
    </div>
  );
}
