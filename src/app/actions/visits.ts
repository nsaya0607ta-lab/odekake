"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/components/form";
import { toJapaneseError } from "@/lib/errors";
import { MAX_PHOTOS_PER_VISIT } from "@/lib/image";
import { finalizePhotoPaths } from "@/lib/photos";
import { requireUser } from "@/lib/supabase/server";
import { PHOTO_BUCKET, type DB } from "@/lib/data/client";
import { syncVisitTags } from "@/lib/data/tags";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable();

const optionalInt = (max: number, label: string) =>
  z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v)))
    .refine((v) => v === null || (Number.isFinite(v) && v >= 0 && v <= max), `${label}を正しく入力してください。`);

const visitSchema = z.object({
  spotId: z.string().uuid("スポットを選んでください。"),
  tripId: z.string().uuid("旅行を選んでください。"),
  visitedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "訪問日を入力してください。"),
  rating: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v)))
    .refine((v) => v === null || (Number.isInteger(v) && v >= 1 && v <= 5), "評価を選び直してください。"),
  comment: optionalText(2000),
  note: optionalText(2000),
  companions: optionalText(120),
  amount: optionalInt(10_000_000, "使用金額"),
  stayMinutes: optionalInt(10_000, "滞在時間"),
  congestionLevel: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v)))
    .refine((v) => v === null || [1, 2, 3].includes(v), "混雑状況を選び直してください。"),
});

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function collect(formData: FormData) {
  return {
    spotId: String(formData.get("spotId") ?? ""),
    tripId: String(formData.get("tripId") ?? ""),
    visitedAt: String(formData.get("visitedAt") ?? ""),
    rating: String(formData.get("rating") ?? ""),
    comment: String(formData.get("comment") ?? ""),
    note: String(formData.get("note") ?? ""),
    companions: String(formData.get("companions") ?? ""),
    amount: String(formData.get("amount") ?? ""),
    stayMinutes: String(formData.get("stayMinutes") ?? ""),
    congestionLevel: String(formData.get("congestionLevel") ?? ""),
    tags: String(formData.get("tags") ?? ""),
    revisitWanted: formData.get("revisitWanted") ? "on" : "",
    favorite: formData.get("favorite") ? "on" : "",
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

function parsePhotoPaths(formData: FormData): string[] {
  try {
    const raw = String(formData.get("photoPaths") ?? "[]");
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((p): p is string => typeof p === "string").slice(0, MAX_PHOTOS_PER_VISIT);
  } catch {
    return [];
  }
}

async function syncPhotos(
  supabase: DB,
  userId: string,
  tripId: string,
  visitId: string,
  requestedPaths: string[],
) {
  // 一時領域にある写真を、この訪問記録の保存先へ移す。
  // 同じ写真が二重に入っていると表示順が重複するため、ここで重複を除く。
  const paths = [
    ...new Set(
      await finalizePhotoPaths(supabase, requestedPaths, `trips/${tripId}/visits/${visitId}`),
    ),
  ];

  const { data: existing } = await supabase
    .from("visit_photos")
    .select("id, storage_path")
    .eq("visit_record_id", visitId);

  const existingPaths = new Set((existing ?? []).map((p) => p.storage_path));
  const keep = new Set(paths);

  const removed = (existing ?? []).filter((p) => !keep.has(p.storage_path));
  if (removed.length > 0) {
    await supabase
      .from("visit_photos")
      .delete()
      .in(
        "id",
        removed.map((p) => p.id),
      );
    await supabase.storage.from(PHOTO_BUCKET).remove(removed.map((p) => p.storage_path));
  }

  const added = paths.flatMap((path, index) =>
    existingPaths.has(path)
      ? []
      : [
          {
            user_id: userId,
            visit_record_id: visitId,
            storage_path: path,
            display_order: index,
          },
        ],
  );
  if (added.length > 0) await supabase.from("visit_photos").insert(added);
}

export async function createVisitAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = collect(formData);
  const parsed = visitSchema.safeParse(values);

  if (!parsed.success) {
    return { error: "入力内容をご確認ください。", fieldErrors: fieldErrorsOf(parsed.error), values };
  }

  const { supabase, user } = await requireUser();
  const visitId = String(formData.get("visitId") ?? "");
  if (!isUuid(visitId)) {
    return { error: "保存に失敗しました。画面を開き直してもう一度お試しください。", values };
  }

  // 二重送信の防止: 同じ ID がすでに保存済みなら詳細へ進む
  const { data: existing } = await supabase.from("visit_records").select("id").eq("id", visitId).maybeSingle();
  if (existing) redirect(`/spots/${parsed.data.spotId}?saved=1`);

  const { error } = await supabase.from("visit_records").insert({
    id: visitId,
    user_id: user.id,
    trip_id: parsed.data.tripId,
    spot_id: parsed.data.spotId,
    visited_at: parsed.data.visitedAt,
    rating: parsed.data.rating,
    comment: parsed.data.comment,
    note: parsed.data.note,
    companions: parsed.data.companions,
    amount: parsed.data.amount,
    stay_minutes: parsed.data.stayMinutes,
    congestion_level: parsed.data.congestionLevel,
    revisit_wanted: values.revisitWanted === "on",
    favorite: values.favorite === "on",
  });

  if (error) {
    return { error: toJapaneseError(error, "訪問履歴の保存に失敗しました。"), values };
  }

  await Promise.all([
    syncPhotos(supabase, user.id, parsed.data.tripId, visitId, parsePhotoPaths(formData)),
    syncVisitTags(supabase, user.id, visitId, values.tags),
  ]);

  revalidatePath("/home");
  revalidatePath("/records");
  revalidatePath(`/spots/${parsed.data.spotId}`);
  revalidatePath(`/trips/${parsed.data.tripId}`);
  redirect(`/spots/${parsed.data.spotId}?saved=1`);
}

export async function updateVisitAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const visitId = String(formData.get("visitId") ?? "");
  const values = collect(formData);
  const parsed = visitSchema.safeParse(values);

  if (!parsed.success) {
    return { error: "入力内容をご確認ください。", fieldErrors: fieldErrorsOf(parsed.error), values };
  }

  if (!isUuid(visitId)) {
    return { error: "保存に失敗しました。画面を開き直してもう一度お試しください。", values };
  }

  const { supabase, user } = await requireUser();

  // 権限がない場合はエラーではなく0件更新になるため、更新された行で判定する。
  // 確かめずに進めると、保存できていないのに「保存しました。」と表示してしまう。
  const { data: updated, error } = await supabase
    .from("visit_records")
    .update({
      trip_id: parsed.data.tripId,
      visited_at: parsed.data.visitedAt,
      rating: parsed.data.rating,
      comment: parsed.data.comment,
      note: parsed.data.note,
      companions: parsed.data.companions,
      amount: parsed.data.amount,
      stay_minutes: parsed.data.stayMinutes,
      congestion_level: parsed.data.congestionLevel,
      revisit_wanted: values.revisitWanted === "on",
      favorite: values.favorite === "on",
    })
    .eq("id", visitId)
    .select("id");

  if (error) return { error: toJapaneseError(error, "訪問履歴の更新に失敗しました。"), values };

  if ((updated ?? []).length === 0) {
    console.error("Visit update affected no rows", { visitId });
    return { error: "この訪問履歴を更新する権限がありません。", values };
  }

  await Promise.all([
    syncPhotos(supabase, user.id, parsed.data.tripId, visitId, parsePhotoPaths(formData)),
    syncVisitTags(supabase, user.id, visitId, values.tags),
  ]);

  revalidatePath("/records");
  revalidatePath(`/spots/${parsed.data.spotId}`);
  redirect(`/spots/${parsed.data.spotId}?saved=1`);
}

export async function deleteVisitAction(formData: FormData) {
  const visitId = String(formData.get("visitId") ?? "");
  const spotId = String(formData.get("spotId") ?? "");
  const { supabase } = await requireUser();

  const { data: photos } = await supabase
    .from("visit_photos")
    .select("storage_path")
    .eq("visit_record_id", visitId);

  // 記録が実際に消えたことを確かめてから写真を消す。
  // 権限がない場合はエラーではなく0件削除になるため、削除された行で判定する。
  const { data: deleted, error } = await supabase
    .from("visit_records")
    .delete()
    .eq("id", visitId)
    .select("id");

  if (error || (deleted ?? []).length === 0) {
    console.error("Visit delete failed", {
      visitId,
      code: error?.code,
      message: error?.message,
      details: error?.details,
    });
    redirect(`/visits/${visitId}/edit?error=delete`);
  }

  if (photos && photos.length > 0) {
    await supabase.storage.from(PHOTO_BUCKET).remove(photos.map((p) => p.storage_path));
  }

  revalidatePath("/home");
  revalidatePath("/records");
  redirect(spotId ? `/spots/${spotId}` : "/records");
}

/**
 * スポット詳細のハートの切り替え。
 *
 * お気に入りは訪問履歴側に付き、スポットの表示は「いずれかの訪問履歴に
 * 付いていればお気に入り」なので、
 *   付ける … 自分の最新の訪問履歴に付ける
 *   外す　 … このスポットにある自分の訪問履歴すべてから外す
 * とする。
 */
export async function toggleSpotFavoriteAction(formData: FormData) {
  const spotId = String(formData.get("spotId") ?? "");
  const next = String(formData.get("favorite") ?? "") === "on";

  if (!isUuid(spotId)) redirect("/records?tab=spots");

  const { supabase, user } = await requireUser();

  const { data: visits } = await supabase
    .from("visit_records")
    .select("id")
    .eq("spot_id", spotId)
    .eq("user_id", user.id)
    .order("visited_at", { ascending: false })
    .order("created_at", { ascending: false });

  const ids = (visits ?? []).map((visit) => visit.id);
  if (ids.length === 0) redirect(`/spots/${spotId}?error=favorite`);

  if (next) {
    await supabase.from("visit_records").update({ favorite: true }).eq("id", ids[0]!);
  } else {
    await supabase.from("visit_records").update({ favorite: false }).in("id", ids);
  }

  revalidatePath(`/spots/${spotId}`);
  revalidatePath("/mypage/favorites");
  revalidatePath("/records");
}
