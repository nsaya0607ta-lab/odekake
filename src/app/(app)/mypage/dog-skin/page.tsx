import { DogSkinPicker } from "@/components/dog-skin-picker";
import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { getOwnedItemIds } from "@/lib/data/collection";
import { getCurrentDogSkin } from "@/lib/data/dog-skin";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "犬のすがた | おでかけ記録" };
export const dynamic = "force-dynamic";

export default async function DogSkinPage() {
  const { supabase, user } = await requireUser();
  const [currentSkin, ownedItemIds] = await Promise.all([
    getCurrentDogSkin(supabase, user.id),
    getOwnedItemIds(supabase, user.id),
  ]);

  return (
    <>
      <PageHeader title="犬のすがた" backHref="/mypage" subtitle="ガチャで手に入れた犬に変えられます" />
      <PageBody>
        <p className="px-1 text-[11px] text-ink-soft">
          選んだ犬は、ホームやコイン画面など、犬が出てくるところすべてに反映されます。
        </p>
        <DogSkinPicker currentSkin={currentSkin} ownedItemIds={[...ownedItemIds]} />
      </PageBody>
    </>
  );
}
