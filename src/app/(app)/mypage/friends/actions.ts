"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/components/form";
import { formatFriendCode } from "@/lib/data/friends";
import { requireUser } from "@/lib/supabase/server";

const friendCodeSchema = z
  .string()
  .transform((value) => value.toUpperCase().replace(/[\s-]/g, ""))
  .pipe(z.string().regex(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/));

const uuidSchema = z.string().uuid();

type SupabaseActionError = { code?: string; message?: string };

function messageForError(error: SupabaseActionError | null, fallback: string): string {
  const message = error?.message ?? "";
  if (["42P01", "42883", "PGRST202", "PGRST205"].includes(error?.code ?? "")) {
    return "フレンド機能を準備中です";
  }
  if (message.includes("FRIEND_CODE_NOT_FOUND")) return "フレンドコードが見つかりませんでした";
  if (message.includes("CANNOT_FRIEND_SELF")) return "自分自身はフレンドに追加できません";
  if (message.includes("ALREADY_FRIENDS")) return "すでにフレンドです";
  return fallback;
}
export async function addFriendAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const rawCode = String(formData.get("friendCode") ?? "");
  const parsed = friendCodeSchema.safeParse(rawCode);
  if (!parsed.success) {
    return {
      error: "フレンドコードが見つかりませんでした",
      values: { friendCode: formatFriendCode(rawCode) },
    };
  }

  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("add_friend_by_code", { p_code: parsed.data });
  if (error) {
    return {
      error: messageForError(error, "フレンドを追加できませんでした。もう一度お試しください"),
      values: { friendCode: formatFriendCode(rawCode) },
    };
  }

  revalidatePath("/mypage/friends");
  return { ok: true, message: "フレンドに追加しました" };
}

export async function regenerateFriendCodeAction(
  _previous: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("regenerate_friend_code");
  if (error || !data) {
    return { error: messageForError(error, "フレンドコードを再発行できませんでした") };
  }

  revalidatePath("/mypage/friends");
  return {
    ok: true,
    message: "新しいフレンドコードを発行しました",
    values: { friendCode: data },
  };
}

export async function updateFriendPrivacyAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, user } = await requireUser();
  const settings = {
    user_id: user.id,
    show_prefectures: formData.get("showPrefectures") === "on",
    show_collection: formData.get("showCollection") === "on",
    show_recent_visits: formData.get("showRecentVisits") === "on",
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("friend_privacy_settings").upsert(settings, {
    onConflict: "user_id",
  });
  if (error) {
    return {
      error: messageForError(error, "公開設定を保存できませんでした。もう一度お試しください"),
      values: {
        showPrefectures: String(settings.show_prefectures),
        showCollection: String(settings.show_collection),
        showRecentVisits: String(settings.show_recent_visits),
      },
    };
  }

  revalidatePath("/mypage/friends/settings");
  return { ok: true, message: "公開設定を保存しました" };
}

export async function removeFriendAction(formData: FormData): Promise<void> {
  const parsed = uuidSchema.safeParse(String(formData.get("friendUserId") ?? ""));
  if (!parsed.success) redirect("/mypage/friends");

  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("remove_friend", { p_friend_user_id: parsed.data });
  if (error) {
    redirect(`/mypage/friends/${parsed.data}?error=remove`);
  }

  revalidatePath("/mypage/friends");
  revalidatePath(`/mypage/friends/${parsed.data}`);
  redirect("/mypage/friends?removed=1");
}
