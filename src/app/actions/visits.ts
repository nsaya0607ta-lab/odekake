"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/components/form";
import { toJapaneseError } from "@/lib/errors";
import { MAX_PHOTOS_PER_VISIT } from "@/lib/image";
import { requireUser } from "@/lib/supabase/server";
import type { DB } from "@/lib/data/client";

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

/** 入力されたタグ名を tags テーブルへ登録し、訪問記録に紐づける */
async function syncTags(supabase: DB, userId: string, visitId: string, rawTags: string) {
  const names = [
    ...new Set(
      rawTags
        .split(/[,、\s]+/)
        .map((t) => t.trim().replace(/^#/, ""))
        .filter((t) => t.length > 0 && t.length <= 20),
    ),
  ].slice(0, 10);

  await supabase.from("visit_record_tags").delete().eq("visit_record_id", visitId);
  if (names.length === 0) return;

  const { data: tags } = await supabase
    .from("tags")
    .upsert(
      names.map((name) => ({ user_id: userId, name })),
      { onConflict: "user_id,name" },
    )
    .select("id");

  if (!tags || tags.length === 0) return;

  await supabase
    .from("visit_record_tags")
    .insert(tags.map((tag) => ({ visit_record_id: visitId, tag_id: tag.id })));
}

async function syncPhotos(supabase: DB, userId: string, visitId: string, paths: string[]) {
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
    await supabase.storage.from("photos").remove(removed.map((p) => p.storage_path));
  }

  const added = paths.filter((p) => !existingPaths.has(p));
  if (added.length > 0) {
    await supabase.from("visit_photos").insert(
      added.map((path) => ({
        user_id: userId,
        visit_record_id: visitId,
        storage_path: path,
        display_order: paths.indexOf(path),
      })),
    );
  }
}

export async function createVisitAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = collect(formData);
  const parsed = visitSchema.safeParse(values);

  if (!parsed.success) {
    return { error: "入力内容をご確認ください。", fieldErrors: fieldErrorsOf(parsed.error), values };
  }

  const { supabase, user } = await requireUser();
  const visitId = String(formData.get("visitId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(visitId)) {
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
    syncPhotos(supabase, user.id, visitId, parsePhotoPaths(formData)),
    syncTags(supabase, user.id, visitId, values.tags),
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

  const { supabase, user } = await requireUser();

  const { error } = await supabase
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
    .eq("id", visitId);

  if (error) return { error: toJapaneseError(error, "訪問履歴の更新に失敗しました。"), values };

  await Promise.all([
    syncPhotos(supabase, user.id, visitId, parsePhotoPaths(formData)),
    syncTags(supabase, user.id, visitId, values.tags),
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

  await supabase.from("visit_records").delete().eq("id", visitId);

  if (photos && photos.length > 0) {
    await supabase.storage.from("photos").remove(photos.map((p) => p.storage_path));
  }

  revalidatePath("/home");
  revalidatePath("/records");
  redirect(spotId ? `/spots/${spotId}` : "/records");
}

export async function toggleVisitFavoriteAction(formData: FormData) {
  const visitId = String(formData.get("visitId") ?? "");
  const spotId = String(formData.get("spotId") ?? "");
  const next = String(formData.get("favorite") ?? "") === "on";

  const { supabase } = await requireUser();
  await supabase.from("visit_records").update({ favorite: next }).eq("id", visitId);

  revalidatePath(`/spots/${spotId}`);
}
