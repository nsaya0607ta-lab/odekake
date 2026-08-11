"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/components/form";
import { toJapaneseError } from "@/lib/errors";
import { PHOTO_BUCKET } from "@/lib/data/client";
import { SPACE_NAME_MAX } from "@/lib/data/space";
import { finalizePhotoPaths, removeFolderRecursively, TMP_ROOT } from "@/lib/photos";
import { getSiteUrl } from "@/lib/supabase/env";
import { requireUser } from "@/lib/supabase/server";

export async function updateProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = {
    displayName: String(formData.get("displayName") ?? "").trim(),
    spaceName: String(formData.get("spaceName") ?? "").trim(),
    introduction: String(formData.get("introduction") ?? "").trim(),
  };

  const parsed = z
    .object({
      displayName: z
        .string()
        .min(1, "ニックネームを入力してください。")
        .max(30, "ニックネームは30文字以内で入力してください。"),
      // 未入力なら既定の「自分の旅」に戻す
      spaceName: z.string().max(SPACE_NAME_MAX, `旅の名前は${SPACE_NAME_MAX}文字以内で入力してください。`),
      introduction: z.string().max(300, "自己紹介は300文字以内で入力してください。"),
    })
    .safeParse(values);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力内容をご確認ください。", values };
  }

  let profileImagePath: string | null = null;
  try {
    const raw: unknown = JSON.parse(String(formData.get("profilePaths") ?? "[]"));
    if (Array.isArray(raw) && typeof raw[0] === "string") profileImagePath = raw[0];
  } catch {
    // 画像がなくても保存できる
  }

  const { supabase, user } = await requireUser();

  if (profileImagePath) {
    const [moved] = await finalizePhotoPaths(supabase, [profileImagePath], `users/${user.id}/profile`);
    if (!moved) {
      return {
        error: "プロフィール画像を保存できませんでした。画像を選び直して、もう一度お試しください。",
        values,
      };
    }
    profileImagePath = moved;
  }

  const { data: current } = await supabase
    .from("profiles")
    .select("profile_image_url")
    .eq("user_id", user.id)
    .maybeSingle();

  // 古いDBに space_name 列がまだない場合でも、画像・名前・自己紹介まで
  // 巻き添えで保存できなくならないよう、基本プロフィールと旅の名前を分ける。
  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: parsed.data.displayName,
      introduction: parsed.data.introduction || null,
      profile_image_url: profileImagePath,
    })
    .eq("user_id", user.id);

  if (error) {
    console.error("[profile/update] Failed to update profile", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return { error: toJapaneseError(error, "プロフィールの更新に失敗しました。"), values };
  }

  const { error: spaceNameError } = await supabase
    .from("profiles")
    .update({ space_name: parsed.data.spaceName || null })
    .eq("user_id", user.id);

  if (spaceNameError) {
    console.error("[profile/update] Failed to update space name", {
      code: spaceNameError.code,
      message: spaceNameError.message,
      details: spaceNameError.details,
      hint: spaceNameError.hint,
    });
  }

  // 差し替え前の画像を消す。残しておくとストレージに孤立ファイルがたまる
  const previous = current?.profile_image_url ?? null;
  if (previous && previous !== profileImagePath) {
    await supabase.storage.from(PHOTO_BUCKET).remove([previous]);
  }

  // 通常画面は JWT の user_metadata からニックネームを即座に読めるようにする。
  // profiles と同じ値を保持することで、画面遷移ごとのプロフィール取得を不要にする。
  await supabase.auth.updateUser({
    data: {
      display_name: parsed.data.displayName,
      profile_image_url: profileImagePath,
    },
  });

  // updateUser はアクセストークンを作り直さないため、JWT の user_metadata は
  // 古いままになる。requireUser() は JWT からニックネームを読むので、
  // ここで作り直さないとホーム画面などが前の名前を出し続ける。
  const { error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError) {
    console.warn("Failed to refresh session after profile update", {
      message: refreshError.message,
    });
  }

  revalidatePath("/home");
  revalidatePath("/records");
  revalidatePath("/mypage");
  return {
    ok: true,
    message: spaceNameError
      ? "プロフィールを更新しました。旅の名前はデータベース設定後に変更できます。"
      : "プロフィールを更新しました。",
    values,
  };
}

export async function updateEmailAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  const parsed = z.string().email("メールアドレスの形式が正しくありません。").safeParse(email);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "", values: { email } };

  const { supabase } = await requireUser();
  const { error } = await supabase.auth.updateUser(
    { email: parsed.data },
    { emailRedirectTo: `${getSiteUrl()}/auth/callback?next=/mypage/account` },
  );

  if (error) return { error: toJapaneseError(error, "メールアドレスの変更に失敗しました。"), values: { email } };

  return {
    ok: true,
    message: "新しいメールアドレス宛に確認メールを送信しました。リンクを開くと変更が完了します。",
    values: { email },
  };
}

export async function deleteAccountAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const confirmText = String(formData.get("confirmText") ?? "").trim();

  if (confirmText !== "削除") {
    return { error: "確認のため「削除」と入力してください。" };
  }

  const { supabase, user } = await requireUser();

  // データベースの行は外部キーの連鎖で消えるが、Storage のファイルは残るため
  // ログインしているうちに消しておく（RLS で自分の分しか消せない）。

  // 旅行フォルダの掃除から漏れる分がないよう、自分がアップロードした写真を
  // 先に個別に消しておく。
  const { data: ownPhotos } = await supabase
    .from("visit_photos")
    .select("storage_path")
    .eq("user_id", user.id);
  const ownPhotoPaths = (ownPhotos ?? []).map((photo) => photo.storage_path);
  for (let i = 0; i < ownPhotoPaths.length; i += 100) {
    await supabase.storage.from(PHOTO_BUCKET).remove(ownPhotoPaths.slice(i, i + 100));
  }

  const { data: ownedTrips } = await supabase.from("trips").select("id").eq("owner_id", user.id);
  for (const trip of ownedTrips ?? []) {
    await removeFolderRecursively(supabase, `trips/${trip.id}`);
  }
  await removeFolderRecursively(supabase, `users/${user.id}`);
  await removeFolderRecursively(supabase, `${TMP_ROOT}/${user.id}`);

  const { error } = await supabase.rpc("delete_own_account");

  if (error) return { error: toJapaneseError(error, "アカウントの削除に失敗しました。") };

  await supabase.auth.signOut();
  redirect("/login?notice=account-deleted");
}
