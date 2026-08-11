import { NextResponse } from "next/server";
import { municipalityFromAddress } from "@/lib/geo/municipalities";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ spotId: string }> },
) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (typeof userId !== "string") {
    return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
  }

  const { spotId } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(spotId)) {
    return NextResponse.json({ error: "スポットが正しくありません。" }, { status: 400 });
  }

  const { data: spot, error: readError } = await supabase
    .from("spots")
    .select("address, prefecture_code, municipality_code, location_accuracy_m")
    .eq("id", spotId)
    .eq("created_by", userId)
    .maybeSingle();

  if (readError) return NextResponse.json({ error: "場所を確認できませんでした。" }, { status: 500 });
  if (!spot) return new NextResponse(null, { status: 204 });

  const municipality = municipalityFromAddress(spot.address);
  const invalidAccuracy =
    spot.location_accuracy_m !== null &&
    (typeof spot.location_accuracy_m !== "number" ||
      !Number.isFinite(spot.location_accuracy_m) ||
      spot.location_accuracy_m < 0);

  const locationMismatch = Boolean(
    municipality &&
    (municipality.prefectureCode !== spot.prefecture_code || municipality.code !== spot.municipality_code),
  );
  if (!locationMismatch && !invalidAccuracy) return NextResponse.json({ repaired: false });

  const { error: updateError } = await supabase
    .from("spots")
    .update({
      ...(municipality
        ? { prefecture_code: municipality.prefectureCode, municipality_code: municipality.code }
        : {}),
      ...(invalidAccuracy ? { location_accuracy_m: null } : {}),
    })
    .eq("id", spotId)
    .eq("created_by", userId);

  if (updateError) return NextResponse.json({ error: "場所を修復できませんでした。" }, { status: 500 });
  return NextResponse.json({ repaired: true });
}
