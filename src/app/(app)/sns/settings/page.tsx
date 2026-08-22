import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { SnsBackgroundBand } from "@/components/sns/sns-background-band";
import { SnsGuideCard } from "@/components/sns/sns-guide-card";
import { SnsIllustratedHero } from "@/components/sns/sns-illustrated-hero";
import { SnsSettingsForm } from "@/components/sns/sns-settings-form";
import { signThumbOrOriginalPaths } from "@/lib/data/photos";
import { getMyFriendGroupsFresh, getSnsBlockedUsers } from "@/lib/data/sns";
import { getSnsNotificationPreferences } from "@/lib/data/sns-notifications";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "通知と安全 | SNS" };
export const dynamic = "force-dynamic";

export default async function SnsSettingsPage() {
  const { supabase } = await requireUser();
  const [preferences, groups, blockedUsers] = await Promise.all([
    getSnsNotificationPreferences(supabase),
    getMyFriendGroupsFresh(supabase),
    getSnsBlockedUsers(supabase),
  ]);
  const avatarUrls = await signThumbOrOriginalPaths(
    supabase,
    blockedUsers.flatMap((person) => person.profile_image_url ? [person.profile_image_url] : []),
  );

  return (
    <>
      <PageHeader title="通知と安全" subtitle="自分にちょうどいいSNSへ" backHref="/sns/notifications" />
      <SnsBackgroundBand hasToggleBar={false} />
      <PageBody className="sns-page-shell sns-subpage-body space-y-4">
        <SnsIllustratedHero
          eyebrow="YOUR COMFORT"
          title="受け取る便りを選ぼう"
          description="必要な通知は逃さず、静かにしたい場所はそっとミュート。"
          artSrc="/illustrations/sns/notification-bell-v2.webp"
          tone="notice"
        />
        <SnsGuideCard />
        <SnsSettingsForm
          preferences={preferences}
          groups={groups.map((group) => ({ id: group.id, name: group.name, icon: group.icon }))}
          initialBlockedUsers={blockedUsers.map((person) => ({
            userId: person.user_id,
            displayName: person.display_name,
            avatarUrl: person.profile_image_url ? avatarUrls.get(person.profile_image_url) : undefined,
          }))}
        />
      </PageBody>
    </>
  );
}
