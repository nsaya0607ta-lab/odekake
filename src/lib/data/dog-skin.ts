import { isDogSkinId, type DogSkinId } from "@/lib/dog-skins";
import type { DB } from "./client";

/** 選択中の犬スキン。まだ選んでいなければ default */
export async function getCurrentDogSkin(supabase: DB, userId: string): Promise<DogSkinId> {
  const { data, error } = await supabase
    .from("user_dog_skin")
    .select("skin_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.warn("Dog skin is unavailable", { code: error.code, message: error.message });
    return "default";
  }

  return isDogSkinId(data?.skin_id) ? data.skin_id : "default";
}
