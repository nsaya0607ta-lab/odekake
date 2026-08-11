import { FriendPrivacyForm } from "@/components/friends/friend-controls";
import { IconLock } from "@/components/icons";
import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import {
  FriendsUnavailableError,
  getFriendPrivacySettings,
} from "@/lib/data/friends";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "フレンド公開設定 | おでかけ記録" };
export const dynamic = "force-dynamic";

export default async function FriendSettingsPage() {
  const { supabase, user } = await requireUser();

  try {
    const settings = await getFriendPrivacySettings(supabase, user.id);
    return (
      <>
        <PageHeader title="フレンド公開設定" backHref="/mypage/friends" />
        <PageBody>
          <div className="px-1">
            <p className="text-sm leading-relaxed text-ink-soft">
              フレンドに見せる情報を選べます。表示名・プロフィール画像・レベル・基本集計はフレンドに表示されます。
            </p>
          </div>
          <FriendPrivacyForm
            showPrefectures={settings.show_prefectures}
            showCollection={settings.show_collection}
            showRecentVisits={settings.show_recent_visits}
          />
        </PageBody>
      </>
    );
  } catch (error) {
    if (!(error instanceof FriendsUnavailableError)) throw error;
    return (
      <>
        <PageHeader title="フレンド公開設定" backHref="/mypage/friends" />
        <PageBody>
          <div className="rough-card px-6 py-10 text-center">
            <IconLock size={30} className="mx-auto text-ink-faint" />
            <p className="mt-3 font-bold">フレンド機能を準備中です</p>
          </div>
        </PageBody>
      </>
    );
  }
}
