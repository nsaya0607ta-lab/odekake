import Link from "next/link";
import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/supabase/server";
import { DeleteAccountForm } from "./delete-account-form";
import { EmailForm } from "./email-form";

export const metadata = { title: "アカウント設定 | おでかけ記録" };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const { user } = await requireUser();

  return (
    <>
      <PageHeader title="アカウント設定" backHref="/mypage" />
      <PageBody>
        <section>
          <h2 className="mb-2 px-1 text-base font-bold">メールアドレス</h2>
          <EmailForm currentEmail={user.email ?? ""} />
        </section>

        <section>
          <h2 className="mb-2 px-1 text-base font-bold">パスワード</h2>
          <div className="rough-card space-y-3 p-4">
            <p className="text-sm leading-relaxed text-ink-soft">
              パスワードを変更するには、登録メールアドレス宛に再設定リンクをお送りします。
            </p>
            <Link href="/forgot-password" className="btn btn-quiet w-full">
              パスワードを再設定する
            </Link>
          </div>
        </section>

        <section>
          <h2 className="mb-2 px-1 text-base font-bold">アカウントの削除</h2>
          <DeleteAccountForm />
        </section>
      </PageBody>
    </>
  );
}
