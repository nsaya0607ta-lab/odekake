import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { SnsBackgroundBand } from "@/components/sns/sns-background-band";
import { SnsIllustratedHero } from "@/components/sns/sns-illustrated-hero";
import { SnsTextComposeForm } from "@/components/sns/sns-text-compose-form";
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
      <SnsBackgroundBand hasToggleBar={false} />
      <PageBody className="sns-page-shell sns-subpage-body space-y-4">
        <SnsIllustratedHero
          eyebrow="CREATE A MEMORY"
          title="今日を、旅の便りに"
          description="ひとこと・写真・場所を、好きな組み合わせでフレンドへ。"
          artSrc="/illustrations/sns/compose-post-v2.webp"
          tone="compose"
        />
        <SnsTextComposeForm userId={user.id} visitOptions={visitOptions} />
      </PageBody>
    </>
  );
}
