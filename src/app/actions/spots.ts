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

const optionalHttpUrl = z
  .string()
  .trim()
  .max(300, "公式URLは300文字以内で入力してください。")
  .transform((value) => (value === "" ? null : value))
  .refine((value) => {
    if (value === null) return true;
    try {
      const url = new URL(value);
      return (url.protocol === "https:" || url.protocol === "http:") && Boolean(url.hostname);
    } catch {
      return false;
    }
  }, "公式URLは https:// または http:// から始まる正しいURLを入力してください。");

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
  websiteUrl: optionalHttpUrl,
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

type DbError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
} | null;

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

function baseDetailValues(parsed: SpotInput) {
  return {
    name: parsed.name,
    category_id: parsed.categoryId,
    address: parsed.address,
    website_url: parsed.websiteUrl,
    opening_hours: parsed.openingHours,
    closed_days: parsed.closedDays,
    memo: parsed.memo,
  };
}

function extendedDetailValues(parsed: SpotInput) {
  return {
    ...baseDetailValues(parsed),
    postal_code: parsed.postalCode,
    phone: parsed.phone,
  };
}

function legacyLocationValues(location: ReturnType<typeof resolveLocation> & { ok: true }) {
  return {
    prefecture_code: location.values.prefecture_code,
    municipality_code: location.values.municipality_code,
    latitude: location.values.latitude,
    longitude: location.values.longitude,
  };
}

function isMissingExtendedSpotColumn(error: DbError) {
  return error?.code === "PGRST204" && /spots.*schema cache|column of 'spots'/i.test(error.message ?? "");
}

function spotSaveError(error: DbError) {
  if (error?.code === "23505" && /spots_place_ref_idx|place_provider|place_id/i.test(`${error.message ?? ""} ${error.details ?? ""}`)) {
    return "この場所はすでにスポットへ登録されています。記録画面から既存のスポットを選んでください。";
  }
  return toJapaneseError(error, "スポットの登録に失敗しました。時間をおいてもう一度お試しください。");
}

function logSpotError(label: string, error: DbError, parsed: SpotInput) {
  console.error(label, {
    code: error?.code,
    message: error?.message,
    details: error?.details,
    hint: error?.hint,
    municipalityCode: parsed.municipalityCode,
    locationSource: parsed.locationSource,
    hasPlaceId: Boolean(parsed.placeId),
  });
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

  let result = await supabase
    .from("spots")
    .insert({ created_by: user.id, ...extendedDetailValues(parsed.data), ...location.values })
    .select("id")
    .single();

  // 本番DBに位置情報拡張マイグレーションがまだ適用されていない場合でも、
  // 初期スキーマに存在する列だけで保存を継続する。
  if (isMissingExtendedSpotColumn(result.error)) {
    console.warn("Extended spot columns are unavailable; retrying with legacy schema", {
      missingColumnMessage: result.error?.message,
      municipalityCode: parsed.data.municipalityCode,
    });
    result = await supabase
      .from("spots")
      .insert({
        created_by: user.id,
        ...baseDetailValues(parsed.data),
        ...legacyLocationValues(location),
      })
      .select("id")
      .single();
  }

  if (result.error || !result.data) {
    logSpotError("Spot insert failed", result.error, parsed.data);
    return { error: spotSaveError(result.error), values };
  }

  revalidatePath("/home");
  revalidatePath("/map");
  redirect(`/visits/new?spot=${result.data.id}&created=1`);
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

  let result = await supabase
    .from("spots")
    .update({ ...extendedDetailValues(parsed.data), ...location.values })
    .eq("id", spotId);

  if (isMissingExtendedSpotColumn(result.error)) {
    result = await supabase
      .from("spots")
      .update({ ...baseDetailValues(parsed.data), ...legacyLocationValues(location) })
      .eq("id", spotId);
  }

  if (result.error) {
    logSpotError("Spot update failed", result.error, parsed.data);
    return { error: toJapaneseError(result.error, "スポットの更新に失敗しました。"), values };
  }

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
