import Link from "next/link";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata = { title: "新しいパスワードの設定 | おでかけ記録" };

export default async function ResetPasswordPage() {
  let hasSession = false;

  if (getSupabaseEnv()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    hasSession = Boolean(user);
  }

  return (
    <div className="rough-card p-6">
      <h2 className="mb-1 text-lg font-bold">新しいパスワードを設定</h2>

      {hasSession ? (
        <>
          <p className="mb-5 text-sm text-ink-soft">新しいパスワードを入力してください。</p>
          <ResetPasswordForm />
        </>
      ) : (
        <>
          <p className="mb-5 text-sm leading-relaxed text-ink-soft">
            リンクの有効期限が切れているか、すでに使用されています。
            <br />
            お手数ですが、もう一度パスワード再設定の手続きを行ってください。
          </p>
          <Link href="/forgot-password" className="btn btn-primary w-full">
            再設定メールを送り直す
          </Link>
        </>
      )}
    </div>
  );
}
