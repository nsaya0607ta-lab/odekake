"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PHOTO_BUCKET } from "@/lib/data/client";
import { requireUser } from "@/lib/supabase/server";

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/**
 * 指定スポットにある「自分の訪問記録」だけをまとめて削除する。
 * spots 本体は他ユーザーや共有旅でも使われるため削除しない。
 */
export async function deleteMySpotRecordsAction(formData: FormData) {
  const spotId = String(formData.get("spotId") ?? "");
  if (!isUuid(spotId)) redirect("/records?tab=spots");

  const { supabase, user } = await requireUser();

  const { data: visits, error: visitError } = await supabase
    .from("visit_records")
    .select("id")
    .eq("spot_id", spotId)
    .eq("user_id", user.id);

  if (visitError) {
    console.error("Spot record lookup failed", { spotId, code: visitError.code, message: visitError.message });
    redirect(`/spots/${spotId}?error=delete`);
  }

  const visitIds = (visits ?? []).map((visit) => visit.id);
  if (visitIds.length === 0) redirect("/records?tab=spots");

  const { data: photos } = await supabase
    .from("visit_photos")
    .select("storage_path")
    .in("visit_record_id", visitIds);

  const { data: deleted, error } = await supabase
    .from("visit_records")
    .delete()
    .eq("spot_id", spotId)
    .eq("user_id", user.id)
    .select("id");

  if (error || (deleted ?? []).length !== visitIds.length) {
    console.error("Spot records delete failed", {
      spotId,
      expected: visitIds.length,
      deleted: (deleted ?? []).length,
      code: error?.code,
      message: error?.message,
    });
    redirect(`/spots/${spotId}?error=delete`);
  }

  if (photos && photos.length > 0) {
    await supabase.storage.from(PHOTO_BUCKET).remove(photos.map((photo) => photo.storage_path));
  }

  revalidatePath("/home");
  revalidatePath("/records");
  revalidatePath("/map");
  revalidatePath(`/spots/${spotId}`);
  revalidatePath("/mypage/favorites");
  revalidatePath("/mypage/wishlist");

  redirect("/records?tab=spots&deleted=1");
}
