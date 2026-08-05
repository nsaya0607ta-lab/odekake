"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/components/form";
import { toJapaneseError } from "@/lib/errors";
import { distanceMeters, getMunicipality } from "@/lib/geo";
import { requireUser } from "@/lib/supabase/server";
import type { LocationSource } from "@/lib/supabase/types";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable();

const optionalNumber = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : Number(v)))
  .refine((v) => v === null || Number.isFinite(v), "数値を正しく入力してください。");

const spotSchema = z.object({
  name: z.string().trim().min(1, "スポット名を入力してください。").max(80, "スポット名は80文字以内で入力してください。"),
  categoryId: z
    .string()
    .transform((v) => (v === "" ? null : Number(v)))
    .refine((v) => v === null || Number.isInteger(v), "カテゴリーを選び直してください。"),
  municipalityCode: z.string().regex(/^\d{5}$/, "市区町村を選んでください。"),
  address: optionalText(200),
  postalCode: optionalText(10),
  phone: optionalText(20),
  websiteUrl: optionalText(300),
  openingHours: optionalText(120),
  closedDays: optionalText(120),
  memo: optionalText(1000),
  latitude: optionalNumber.refine((v) => v === null || (v >= -90 && v <= 90), "緯度が正しくありません。"),
  longitude: optionalNumber.refine((v) => v === null || (v >= -180 && v <= 180), "経度が正しくありません。"),
  locationSource: z.enum(["municipality", "address", "map", "device", "place_search"]),
  locationAccuracy: optionalNumber.refine((v) => v === null || v >= 0, "位置の誤差が正しくありません。"),
  placeProvider: optionalText(40),
  placeId: optionalText(200),
});

type SpotInput = z.infer<typeof spotSchema>;

function collect(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    categoryId: String(formData.get("categoryId") ?? ""),
    municipalityCode: String(formData.get("municipalityCode") ?? ""),
    address: String(formData.get("address") ?? ""),
    postalCode: String(formData.get("postalCode") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    websiteUrl: String(formData.get("websiteUrl") ?? ""),
    openingHours: String(formData.get("openingHours") ?? ""),
    closedDays: String(formData.get("closedDays") ?? ""),
    memo: String(formData.get("memo") ?? ""),
    latitude: String(formData.get("latitude") ?? ""),
    longitude: String(formData.get("longitude") ?? ""),
    locationSource: String(formData.get("locationSource") ?? "municipality"),
    locationAccuracy: String(formData.get("locationAccuracy") ?? ""),
    placeProvider: String(formData.get("placeProvider") ?? ""),
    placeId: String(formData.get("placeId") ?? ""),
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

/**
 * 座標と市区町村のつじつまを合わせる。
 * 座標が無いときは市区町村の代表地点を入れ、
 * 選んだ市区町村から極端に離れた座標は受け付けない。
 */
function resolveLocation(parsed: SpotInput) {
  const municipality = getMunicipality(parsed.municipalityCode);
  if (!municipality) return { ok: false as const, error: "選択した市区町村が見つかりません。" };

  let latitude = parsed.latitude;
  let longitude = parsed.longitude;
  let source: LocationSource = parsed.locationSource;
  let accuracy = parsed.locationAccuracy;

  if (latitude === null || longitude === null) {
    latitude = municipality.lat;
    longitude = municipality.lng;
    source = "municipality";
    accuracy = null;
  } else if (municipality.lat !== null && municipality.lng !== null) {
    // 市区町村の代表地点から 100km 以上離れていたら、選び間違いとみなす
    if (distanceMeters(latitude, longitude, municipality.lat, municipality.lng) > 100_000) {
      return { ok: false as const, error: "選んだ市区町村と座標が大きく離れています。場所を選び直してください。" };
    }
  }

  return {
    ok: true as const,
    values: {
      prefecture_code: municipality.prefectureCode,
      municipality_code: municipality.code,
      latitude,
      longitude,
      location_source: source,
      location_accuracy_m: source === "municipality" ? null : accuracy,
      location_updated_at: new Date().toISOString(),
      place_provider: source === "place_search" ? parsed.placeProvider : null,
      place_id: source === "place_search" ? parsed.placeId : null,
    },
  };
}

function detailValues(parsed: SpotInput) {
  return {
    name: parsed.name,
    category_id: parsed.categoryId,
    address: parsed.address,
    postal_code: parsed.postalCode,
    phone: parsed.phone,
    website_url: parsed.websiteUrl,
    opening_hours: parsed.openingHours,
    closed_days: parsed.closedDays,
    memo: parsed.memo,
  };
}

export async function createSpotAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = collect(formData);
  const parsed = spotSchema.safeParse(values);

  if (!parsed.success) {
    return { error: "入力内容をご確認ください。", fieldErrors: fieldErrorsOf(parsed.error), values };
  }

  const location = resolveLocation(parsed.data);
  if (!location.ok) return { error: location.error, values };

  const { supabase, user } = await requireUser();

  const { data, error } = await supabase
    .from("spots")
    .insert({ created_by: user.id, ...detailValues(parsed.data), ...location.values })
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

  const location = resolveLocation(parsed.data);
  if (!location.ok) return { error: location.error, values };

  const { supabase } = await requireUser();

  const { error } = await supabase
    .from("spots")
    .update({ ...detailValues(parsed.data), ...location.values })
    .eq("id", spotId);

  if (error) return { error: toJapaneseError(error, "スポットの更新に失敗しました。"), values };

  revalidatePath(`/spots/${spotId}`);
  revalidatePath("/map");
  redirect(`/spots/${spotId}?saved=1`);
}

export async function deleteSpotAction(formData: FormData) {
  const spotId = String(formData.get("spotId") ?? "");
  const { supabase } = await requireUser();
  await supabase.from("spots").delete().eq("id", spotId);
  revalidatePath("/home");
  revalidatePath("/map");
  redirect("/records?tab=spots");
}
