import { cookies } from "next/headers";
import { DOG_SKIN_COOKIE, isDogSkinId, type DogSkinId } from "@/lib/dog-skins";
import type { DB } from "./client";

/**
 * 選択中の犬スキン。
 *
 * 現在はCookieを正として読む。これなら本番Supabaseに0017_dog_skins.sqlが
 * 未適用でも犬を切り替えられる。すでに0017を適用済みの環境や既存選択との
 * 互換性のため、Cookieが無いときだけ従来のuser_dog_skinも確認する。
 */
export async function getCurrentDogSkin(supabase: DB, userId: string): Promise<DogSkinId> {
  const cookieStore = await cookies();
  const cookieSkin = cookieStore.get(DOG_SKIN_COOKIE)?.value;
  if (isDogSkinId(cookieSkin)) return cookieSkin;

  const { data, error } = await supabase
    .from("user_dog_skin")
    .select("skin_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    // 0017未適用ならテーブル自体が無い。この場合は通常犬へ安全に戻す。
    console.warn("Dog skin DB fallback is unavailable", { code: error.code, message: error.message });
    return "default";
  }

  return isDogSkinId(data?.skin_id) ? data.skin_id : "default";
}
