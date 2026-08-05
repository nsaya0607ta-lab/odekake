"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/components/form";
import { toJapaneseError } from "@/lib/errors";
import { getMunicipality } from "@/lib/geo";
import { requireUser } from "@/lib/supabase/server";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable();

const spotSchema = z.object({
  name: z.string().trim().min(1, "スポット名を入力してください。").max(80, "スポット名は80文字以内で入力してください。"),
  categoryId: z
    .string()
    .transform((v) => (v === "" ? null : Number(v)))
    .refine((v) => v === null || Number.isInteger(v), "カテゴリーを選び直してください。"),
  municipalityCode: z.string().regex(/^\d{5}$/, "市区町村を選んでください。"),
  address: optionalText(200),
  websiteUrl: optionalText(300),
  openingHours: optionalText(120),
  closedDays: optionalText(120),
  memo: optionalText(1000),
});

function collect(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    categoryId: String(formData.get("categoryId") ?? ""),
    municipalityCode: String(formData.get("municipalityCode") ?? ""),
    address: String(formData.get("address") ?? ""),
    websiteUrl: String(formData.get("websiteUrl") ?? ""),
    openingHours: String(formData.get("openingHours") ?? ""),
    closedDays: String(formData.get("closedDays") ?? ""),
    memo: String(formData.get("memo") ?? ""),
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

export async function createSpotAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = collect(formData);
  const parsed = spotSchema.safeParse(values);

  if (!parsed.success) {
    return { error: "入力内容をご確認ください。", fieldErrors: fieldErrorsOf(parsed.error), values };
  }

  const municipality = getMunicipality(parsed.data.municipalityCode);
  if (!municipality) {
    return { error: "選択した市区町村が見つかりません。", values };
  }

  const { supabase, user } = await requireUser();

  const { data, error } = await supabase
    .from("spots")
    .insert({
      created_by: user.id,
      name: parsed.data.name,
      category_id: parsed.data.categoryId,
      prefecture_code: municipality.prefectureCode,
      municipality_code: municipality.code,
      address: parsed.data.address,
      latitude: municipality.lat,
      longitude: municipality.lng,
      website_url: parsed.data.websiteUrl,
      opening_hours: parsed.data.openingHours,
      closed_days: parsed.data.closedDays,
      memo: parsed.data.memo,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: toJapaneseError(error, "スポットの登録に失敗しました。"), values };
  }

  revalidatePath("/home");
  revalidatePath("/map");
  redirect(`/visits/new?spot=${data.id}&created=1`);
}

export async function updateSpotAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const spotId = String(formData.get("spotId") ?? "");
  const values = collect(formData);
  const parsed = spotSchema.safeParse(values);

  if (!parsed.success) {
    return { error: "入力内容をご確認ください。", fieldErrors: fieldErrorsOf(parsed.error), values };
  }

  const municipality = getMunicipality(parsed.data.municipalityCode);
  if (!municipality) return { error: "選択した市区町村が見つかりません。", values };

  const { supabase } = await requireUser();

  const { error } = await supabase
    .from("spots")
    .update({
      name: parsed.data.name,
      category_id: parsed.data.categoryId,
      prefecture_code: municipality.prefectureCode,
      municipality_code: municipality.code,
      address: parsed.data.address,
      website_url: parsed.data.websiteUrl,
      opening_hours: parsed.data.openingHours,
      closed_days: parsed.data.closedDays,
      memo: parsed.data.memo,
    })
    .eq("id", spotId);

  if (error) return { error: toJapaneseError(error, "スポットの更新に失敗しました。"), values };

  revalidatePath(`/spots/${spotId}`);
  redirect(`/spots/${spotId}`);
}

export async function deleteSpotAction(formData: FormData) {
  const spotId = String(formData.get("spotId") ?? "");
  const { supabase } = await requireUser();
  await supabase.from("spots").delete().eq("id", spotId);
  revalidatePath("/home");
  redirect("/records?tab=spots");
}
