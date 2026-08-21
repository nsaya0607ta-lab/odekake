import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { SnsTextComposeForm } from "@/components/sns/sns-text-compose-form";
import { IconSend } from "@/components/icons";
import { getSnsLinkableVisits } from "@/lib/data/sns";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "投稿する | SNS" };
export const dynamic = "force-dynamic";

export default async function NewSnsHomePostPage() {
  const { supabase, user } = await requireUser();
  const visitOptions = await getSnsLinkableVisits(supabase, user.id);

  return (
    <>
      <PageHeader title="つぶやく" backHref="/sns/home" />
      <PageBody className="space-y-4">
        <section className="sns-compose-intro">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-leaf text-white shadow-sm">
            <IconSend size={18} />
          </span>
          <span>
            <span className="block text-sm font-bold">フレンドに共有</span>
            <span className="mt-0.5 block text-[11px] leading-relaxed text-ink-faint">
              ひとことだけでも、写真だけでも投稿できます。
            </span>
          </span>
        </section>
        <SnsTextComposeForm userId={user.id} visitOptions={visitOptions} />
      </PageBody>
    </>
  );
}
