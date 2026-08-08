import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { signPhotoPath } from "@/lib/data/photos";
import { DEFAULT_SPACE_NAME } from "@/lib/data/space";
import { requireUser } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";

export const metadata = { title: "プロフィール | おでかけ記録" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const { supabase, user } = await requireUser();

  const { data: profile } = await supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
  const avatarUrl = await signPhotoPath(supabase, profile?.profile_image_url);

  return (
    <>
      <PageHeader title="プロフィール" backHref="/mypage" />
      <PageBody>
        <ProfileForm
          userId={user.id}
          displayName={profile?.display_name ?? user.displayName}
          spaceName={profile?.space_name ?? ""}
          spaceNamePlaceholder={DEFAULT_SPACE_NAME}
          introduction={profile?.introduction ?? ""}
          imagePath={profile?.profile_image_url ?? null}
          imageUrl={avatarUrl}
        />
      </PageBody>
    </>
  );
}
