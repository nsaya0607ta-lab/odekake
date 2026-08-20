import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { SnsBackgroundBand } from "@/components/sns/sns-background-band";
import { SnsGroupSwitcher } from "@/components/sns/sns-group-switcher";
import { SnsPeopleToggleBar, type SnsPersonRow } from "@/components/sns/sns-people-toggle-bar";
import { getFriendList } from "@/lib/data/friends";
import { signThumbOrOriginalPaths } from "@/lib/data/photos";
import { getMyFriendGroups, getOwnSnsProfile, signGroupIconUrls } from "@/lib/data/sns";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "個人アカウント | SNS" };
export const dynamic = "force-dynamic";

export default async function SnsPersonalPage() {
  const { supabase, user } = await requireUser();

  const [groups, friends, ownProfile] = await Promise.all([
    getMyFriendGroups(supabase, user.id),
    getFriendList(supabase),
    getOwnSnsProfile(supabase, user.id),
  ]);
  const [groupIconUrls, friendAvatarUrls] = await Promise.all([
    signGroupIconUrls(supabase, groups),
    signThumbOrOriginalPaths(
      supabase,
      friends.flatMap((f) => (f.profile_image_url ? [f.profile_image_url] : [])),
    ),
  ]);

  const friendRows: SnsPersonRow[] = friends.map((friend) => ({
    id: friend.friend_user_id,
    label: friend.display_name,
    iconUrl: friend.profile_image_url ? friendAvatarUrls.get(friend.profile_image_url) : undefined,
  }));

  return (
    <>
      <PageHeader title={ownProfile.displayName} showBack={false} />
      <SnsBackgroundBand />
      <PageBody>
        <SnsGroupSwitcher
          groups={groups}
          iconUrls={Object.fromEntries(groupIconUrls)}
          personalActive
          personalIconUrl={ownProfile.iconUrl}
          personalLabel={ownProfile.displayName}
        />

        <SnsPeopleToggleBar
          own={{ id: user.id, label: ownProfile.displayName, iconUrl: ownProfile.iconUrl }}
          friends={friendRows}
        />
      </PageBody>
    </>
  );
}
