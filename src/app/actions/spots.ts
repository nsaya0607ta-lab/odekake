"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/components/form";
import type { DB } from "@/lib/data/client";
import { toJapaneseError } from "@/lib/errors";
import { distanceMeters, getMunicipality } from "@/lib/geo";
import { MAX_PHOTOS_PER_VISIT } from "@/lib/image";
import { finalizePhotoPaths } from "@/lib/photos";
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

const optionalInt = (max: number, label: string) =>
  z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v)))
    .refine(
      (v) => v === null || (Number.isInteger(v) && v >= 0 && v <= max),
      `${label}を正しく入力してください。`,
    );

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

const visitedSpotSchema = spotSchema.extend({
  visitId: z.string().uuid("保存の準備が完了していません。画面を開き直してください。"),
  tripId: z.string().uuid("旅行を選んでください。"),
  visitedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "訪問日を入力してください。"),
  rating: z
    .string()
    .trim()
    .transform((v) => (v === "" || v === "0" ? null : Number(v)))
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
    visitId: String(formData.get("visitId") ?? ""),
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
    return "この場所はすでにスポットへ登録されています。";
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

function parsePhotoPaths(formData: FormData): string[] {
  try {
    const raw = String(formData.get("photoPaths") ?? "[]");
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((path): path is string => typeof path === "string").slice(0, MAX_PHOTOS_PER_VISIT);
  } catch {
    return [];
  }
}

async function syncTags(supabase: DB, userId: string, visitId: string, rawTags: string) {
  const names = [
    ...new Set(
      rawTags
        .split(/[,、\s]+/)
        .map((tag) => tag.trim().replace(/^#/, ""))
        .filter((tag) => tag.length > 0 && tag.length <= 20),
    ),
  ].slice(0, 10);

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

async function syncPhotos(
  supabase: DB,
  userId: string,
  tripId: string,
  visitId: string,
  requestedPaths: string[],
) {
  const paths = await finalizePhotoPaths(
    supabase,
    requestedPaths,
    `trips/${tripId}/visits/${visitId}`,
  );

  if (paths.length === 0) return;

  await supabase.from("visit_photos").insert(
    paths.map((path, index) => ({
      user_id: userId,
      visit_record_id: visitId,
      storage_path: path,
      display_order: index,
    })),
  );
}

async function insertSpot(
  supabase: DB,
  userId: string,
  parsed: SpotInput,
  location: ReturnType<typeof resolveLocation> & { ok: true },
) {
  let result = await supabase
    .from("spots")
    .insert({ created_by: userId, ...extendedDetailValues(parsed), ...location.values })
    .select("id")
    .single();

  if (isMissingExtendedSpotColumn(result.error)) {
    console.warn("Extended spot columns are unavailable; retrying with legacy schema", {
      missingColumnMessage: result.error?.message,
      municipalityCode: parsed.municipalityCode,
    });
    result = await supabase
      .from("spots")
      .insert({
        created_by: userId,
        ...baseDetailValues(parsed),
        ...legacyLocationValues(location),
      })
      .select("id")
      .single();
  }

  return result;
}

export async function createVisitedSpotAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = collect(formData);
  const parsed = visitedSpotSchema.safeParse(values);

  if (!parsed.success) {
    return { error: "入力内容をご確認ください。", fieldErrors: fieldErrorsOf(parsed.error), values };
  }

  const location = resolveLocation(parsed.data);
  if (!location.ok) return { error: location.error, values };

  const { supabase, user } = await requireUser();

  // 二重送信の防止はスポットを作る前に行う。
  // あとから確認すると、送信のたびに同じ場所のスポットが増えてしまう。
  const { data: savedVisit } = await supabase
    .from("visit_records")
    .select("id, spot_id")
    .eq("id", parsed.data.visitId)
    .maybeSingle();
  if (savedVisit) redirect(`/spots/${savedVisit.spot_id}?saved=1`);

  const spotResult = await insertSpot(supabase, user.id, parsed.data, location);
  let spotId = spotResult.data?.id ?? null;
  let createdSpot = Boolean(spotId);

  // 同じGoogle施設がすでに登録されている場合は、そのスポットへ新しい訪問履歴を追加する。
  if (
    !spotId &&
    spotResult.error?.code === "23505" &&
    parsed.data.placeProvider &&
    parsed.data.placeId
  ) {
    const { data: existingSpot } = await supabase
      .from("spots")
      .select("id")
      .eq("created_by", user.id)
      .eq("place_provider", parsed.data.placeProvider)
      .eq("place_id", parsed.data.placeId)
      .maybeSingle();
    if (existingSpot) {
      spotId = existingSpot.id;
      createdSpot = false;
    }
  }

  if (!spotId) {
    logSpotError("Visited spot insert failed", spotResult.error, parsed.data);
    return { error: spotSaveError(spotResult.error), values };
  }

  const { error: visitError } = await supabase.from("visit_records").insert({
    id: parsed.data.visitId,
    user_id: user.id,
    trip_id: parsed.data.tripId,
    spot_id: spotId,
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

  if (visitError) {
    if (createdSpot) await supabase.from("spots").delete().eq("id", spotId);
    console.error("Visit insert after spot failed", {
      code: visitError.code,
      message: visitError.message,
      details: visitError.details,
      hint: visitError.hint,
      tripId: parsed.data.tripId,
      spotId,
    });
    return { error: toJapaneseError(visitError, "行った場所の保存に失敗しました。"), values };
  }

  await Promise.all([
    syncPhotos(supabase, user.id, parsed.data.tripId, parsed.data.visitId, parsePhotoPaths(formData)),
    syncTags(supabase, user.id, parsed.data.visitId, values.tags),
  ]);

  revalidatePath("/home");
  revalidatePath("/map");
  revalidatePath("/records");
  revalidatePath(`/spots/${spotId}`);
  revalidatePath(`/trips/${parsed.data.tripId}`);
  redirect(`/spots/${spotId}?saved=1`);
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
  const result = await insertSpot(supabase, user.id, parsed.data, location);

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

  // 権限がない場合はエラーではなく0件削除になるため、削除された行で判定する
  const { data: deleted, error } = await supabase
    .from("spots")
    .delete()
    .eq("id", spotId)
    .select("id");

  if (error || (deleted ?? []).length === 0) {
    console.error("Spot delete failed", { spotId, code: error?.code, message: error?.message });
    redirect(`/spots/${spotId}/edit?error=delete`);
  }

  revalidatePath("/home");
  revalidatePath("/map");
  revalidatePath("/records");
  redirect("/records?tab=spots");
}
