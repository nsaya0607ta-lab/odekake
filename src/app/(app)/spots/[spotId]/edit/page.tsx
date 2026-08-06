import { notFound, redirect } from "next/navigation";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { SpotForm } from "@/components/spot-form";
import { deleteSpotAction } from "@/app/actions/spots";
import { loadCategoryNames } from "@/lib/data/spots";
import { requireUser } from "@/lib/supabase/server";
import type { SpotRow } from "@/lib/supabase/types";

export const metadata = { title: "スポットを編集 | おでかけ記録" };
export const dynamic = "force-dynamic";

export default async function EditSpotPage({
  params,
  searchParams,
}: {
  params: Promise<{ spotId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ spotId }, { error }, { supabase, user }] = await Promise.all([
    params,
    searchParams,
    requireUser(),
  ]);

  const { data } = await supabase.from("spots").select("*").eq("id", spotId).maybeSingle();
  if (!data) notFound();
  const spot = data as SpotRow;

  // 編集できるのは登録した本人だけ（RLS と同じ条件）
  if (spot.created_by !== user.id) redirect(`/spots/${spot.id}`);

  const categoryNames = await loadCategoryNames(supabase);

  return (
    <>
      <PageHeader title="スポットを編集" backHref={`/spots/${spot.id}`} />
      <PageBody>
        {error === "delete" ? (
          <p className="rounded-2xl border border-blossom bg-blossom-soft px-4 py-3 text-sm text-[#8f4c59]">
            スポットを削除できませんでした。時間をおいてもう一度お試しください。
          </p>
        ) : null}

        <SpotForm
          spotId={spot.id}
          placeSearchEnabled={Boolean(process.env.GOOGLE_PLACES_API_KEY?.trim())}
          categories={[...categoryNames.entries()].map(([id, name]) => ({ id, name }))}
          location={{
            prefectureCode: spot.prefecture_code,
            municipalityCode: spot.municipality_code,
            latitude: spot.latitude,
            longitude: spot.longitude,
            locationSource: spot.location_source,
            locationAccuracyMeters: spot.location_accuracy_m,
            placeProvider: spot.place_provider,
            placeId: spot.place_id,
          }}
          defaults={{
            name: spot.name,
            categoryId: spot.category_id === null ? "" : String(spot.category_id),
            address: spot.address ?? "",
            postalCode: spot.postal_code ?? "",
            phone: spot.phone ?? "",
            websiteUrl: spot.website_url ?? "",
            openingHours: spot.opening_hours ?? "",
            closedDays: spot.closed_days ?? "",
            memo: spot.memo ?? "",
          }}
        />

        <section>
          <h2 className="mb-2 px-1 text-base font-bold">スポットを削除</h2>
          <form action={deleteSpotAction} className="rough-card space-y-3 p-4">
            <input type="hidden" name="spotId" value={spot.id} />
            <p className="text-sm leading-relaxed text-ink-soft">
              スポットを削除すると、このスポットの訪問記録と写真もすべて削除されます。元に戻すことはできません。
            </p>
            <ConfirmSubmitButton
              message="このスポットと、紐づく訪問記録・写真をすべて削除します。元に戻せません。よろしいですか？"
              pendingLabel="削除中…"
            >
              スポットを削除する
            </ConfirmSubmitButton>
          </form>
        </section>
      </PageBody>
    </>
  );
}
