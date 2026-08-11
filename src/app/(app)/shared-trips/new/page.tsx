import Link from "next/link";
import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { getFriendList, getFriendsSetupStatus } from "@/lib/data/friends";
import { getSharedTripsSetupStatus } from "@/lib/data/shared-trips";
import { requireUser } from "@/lib/supabase/server";
import { SharedTripForm } from "./shared-trip-form";

export const metadata = { title: "共有旅を作る | おでかけ記録" };
export const dynamic = "force-dynamic";

export default async function NewSharedTripPage() {
  const { supabase } = await requireUser();
  const [friendsStatus, sharedStatus] = await Promise.all([
    getFriendsSetupStatus(supabase),
    getSharedTripsSetupStatus(supabase),
  ]);
  const friends = friendsStatus.ready && sharedStatus.ready ? await getFriendList(supabase) : [];

  return (
    <>
      <PageHeader title="共有旅を作る" backHref="/shared-trips" />
      <PageBody>
        {!sharedStatus.ready ? <SetupCard /> : friends.length === 0 ? (
          <div className="rough-card px-6 py-9 text-center">
            <h2 className="font-bold">フレンドを追加してください</h2>
            <p className="mt-2 text-xs leading-relaxed text-ink-faint">共有旅は、登録済みのフレンドを選んで作成します。</p>
            <Link href="/mypage/friends" className="btn btn-primary mt-5 w-full">フレンド画面へ</Link>
          </div>
        ) : <SharedTripForm friends={friends} />}
      </PageBody>
    </>
  );
}

function SetupCard() {
  return <div className="rough-card px-6 py-9 text-center"><h2 className="font-bold">共有旅の準備が必要です</h2><p className="mt-2 text-xs text-ink-faint">Supabaseで 0023_shared_trips.sql を実行すると利用できます。</p></div>;
}
