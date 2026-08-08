"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/components/form";
import { toJapaneseError } from "@/lib/errors";
import { finalizePhotoPaths } from "@/lib/photos";
import { PHOTO_BUCKET } from "@/lib/data/client";
import { safeNextPath } from "@/lib/navigation";
import { requireUser } from "@/lib/supabase/server";
import type { DB } from "@/lib/data/client";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable();

const optionalDate = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "日付を正しく入力してください。");

const tripSchema = z
  .object({
    title: z.string().trim().min(1, "旅行名を入力してください。").max(60, "旅行名は60文字以内で入力してください。"),
    startDate: optionalDate,
    endDate: optionalDate,
    description: optionalText(1000),
  })
  .refine((v) => !v.startDate || !v.endDate || v.startDate <= v.endDate, {
    message: "終了日は開始日より後にしてください。",
    path: ["endDate"],
  });

function collect(formData: FormData) {
  return {
    title: String(formData.get("title") ?? ""),
    startDate: String(formData.get("startDate") ?? ""),
    endDate: String(formData.get("endDate") ?? ""),
    description: String(formData.get("description") ?? ""),
  };
}

function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!result[key]) result[key] = issue.message;
  }
  return result;
}

function firstPhotoPath(formData: FormData): string | null {
  try {
    const parsed: unknown = JSON.parse(String(formData.get("coverPaths") ?? "[]"));
    if (Array.isArray(parsed) && typeof parsed[0] === "string") return parsed[0];
  } catch {
    // 画像がなくても保存できる
  }
  return null;
}

/** 一時領域にある表紙画像を旅行の保存先へ移す */
async function moveCover(supabase: DB, tripId: string, path: string | null): Promise<string | null> {
  if (!path) return null;
  const [moved] = await finalizePhotoPaths(supabase, [path], `trips/${tripId}/cover`);
  return moved ?? null;
}

/** 差し替え前の表紙画像を消す。残しておくとストレージに孤立ファイルがたまる */
async function removeReplacedCover(supabase: DB, previous: string | null, next: string | null) {
  if (!previous || previous === next) return;
  await supabase.storage.from(PHOTO_BUCKET).remove([previous]);
}

export async function createTripAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = collect(formData);
  const parsed = tripSchema.safeParse(values);

  if (!parsed.success) {
    return { error: "入力内容をご確認ください。", fieldErrors: fieldErrorsOf(parsed.error), values };
  }

  const tripId = String(formData.get("tripId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(tripId)) {
    return { error: "保存に失敗しました。画面を開き直してもう一度お試しください。", values };
  }

  const { supabase, user } = await requireUser();

  // 二重送信の防止
  const { data: existing } = await supabase.from("trips").select("id").eq("id", tripId).maybeSingle();
  if (existing) redirect(`/trips/${tripId}`);

  const { error } = await supabase.from("trips").insert({
    id: tripId,
    owner_id: user.id,
    title: parsed.data.title,
    start_date: parsed.data.startDate,
    end_date: parsed.data.endDate,
    description: parsed.data.description,
  });

  if (error) {
    return { error: toJapaneseError(error, "旅行の作成に失敗しました。"), values };
  }

  // 表紙画像は旅行を作ってから移す（保存先の権限は旅行の存在を前提にしているため）
  const cover = await moveCover(supabase, tripId, firstPhotoPath(formData));
  if (cover) await supabase.from("trips").update({ cover_image_url: cover }).eq("id", tripId);

  revalidatePath("/home");
  revalidatePath("/records");

  // 「旅行がないので先に作る」導線から来た場合は、書きかけの画面へ戻す
  const requestedNext = String(formData.get("next") ?? "");
  if (requestedNext) redirect(safeNextPath(requestedNext, `/trips/${tripId}`));

  redirect(`/trips/${tripId}`);
}

export async function updateTripAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const tripId = String(formData.get("tripId") ?? "");
  const values = collect(formData);
  const parsed = tripSchema.safeParse(values);

  if (!parsed.success) {
    return { error: "入力内容をご確認ください。", fieldErrors: fieldErrorsOf(parsed.error), values };
  }

  const { supabase } = await requireUser();
  const coverPath = await moveCover(supabase, tripId, firstPhotoPath(formData));

  const { data: current } = await supabase
    .from("trips")
    .select("cover_image_url")
    .eq("id", tripId)
    .maybeSingle();

  // 権限がない場合はエラーではなく0件更新になるため、更新された行で判定する
  const { data: updated, error } = await supabase
    .from("trips")
    .update({
      title: parsed.data.title,
      start_date: parsed.data.startDate,
      end_date: parsed.data.endDate,
      description: parsed.data.description,
      cover_image_url: coverPath,
    })
    .eq("id", tripId)
    .select("id");

  if (error) return { error: toJapaneseError(error, "旅行の更新に失敗しました。"), values };

  if ((updated ?? []).length === 0) {
    console.error("Trip update affected no rows", { tripId });
    return { error: "この旅行を編集する権限がありません。", values };
  }

  await removeReplacedCover(supabase, current?.cover_image_url ?? null, coverPath);

  revalidatePath(`/trips/${tripId}`);
  revalidatePath("/home");
  revalidatePath("/records");
  return { ok: true, message: "旅行の情報を更新しました。", values };
}

export async function deleteTripAction(formData: FormData) {
  const tripId = String(formData.get("tripId") ?? "");
  const { supabase } = await requireUser();

  // 所有者でない場合はエラーではなく0件削除になるため、削除された行で判定する
  const { data: deleted, error } = await supabase
    .from("trips")
    .delete()
    .eq("id", tripId)
    .select("id");

  if (error || (deleted ?? []).length === 0) {
    console.error("Trip delete failed", { tripId, code: error?.code, message: error?.message });
    redirect(`/trips/${tripId}/settings?error=delete`);
  }

  revalidatePath("/home");
  revalidatePath("/records");
  redirect("/home");
}
