import { notFound, redirect } from "next/navigation";
import { deleteTripAction } from "@/app/actions/trips";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { getTripCoverUrl } from "@/lib/data/trips";
import { requireUser } from "@/lib/supabase/server";
import type { TripRow } from "@/lib/supabase/types";
import { TripSettingsForm } from "./trip-settings-form";

export const metadata = { title: "旅行の設定 | おでかけ記録" };
export const dynamic = "force-dynamic";

const SETTINGS_ERRORS: Record<string, string> = {
  delete: "旅行を削除できませんでした。時間をおいてもう一度お試しください。",
};

export default async function TripSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tripId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ tripId }, { error }, { supabase, user }] = await Promise.all([
    params,
    searchParams,
    requireUser(),
  ]);

  const { data: tripData } = await supabase.from("trips").select("*").eq("id", tripId).maybeSingle();
  if (!tripData) notFound();
  const trip = tripData as TripRow;

  // 設定はオーナーのみ
  if (trip.owner_id !== user.id) redirect(`/trips/${trip.id}`);

  const coverUrl = await getTripCoverUrl(supabase, trip);

  return (
    <>
      <PageHeader title="旅行の設定" backHref={`/trips/${trip.id}`} />
      <PageBody>
        {SETTINGS_ERRORS[error ?? ""] ? (
          <p className="rounded-2xl border border-blossom bg-blossom-soft px-4 py-3 text-sm text-[#8f4c59]">
            {SETTINGS_ERRORS[error ?? ""]}
          </p>
        ) : null}

        <section>
          <h2 className="mb-2 px-1 text-base font-bold">旅行の情報</h2>
          <TripSettingsForm userId={user.id} trip={trip} coverUrl={coverUrl} />
        </section>

        <section>
          <h2 className="mb-2 px-1 text-base font-bold">旅行を削除</h2>
          <form action={deleteTripAction} className="rough-card space-y-3 p-4">
            <input type="hidden" name="tripId" value={trip.id} />
            <p className="text-sm leading-relaxed text-ink-soft">
              旅行を削除すると、この旅行に紐づく訪問記録と写真もすべて削除されます。元に戻すことはできません。
            </p>
            <ConfirmSubmitButton
              message="この旅行と、紐づく訪問記録・写真をすべて削除します。元に戻せません。よろしいですか？"
              pendingLabel="削除中…"
            >
              旅行を削除する
            </ConfirmSubmitButton>
          </form>
        </section>
      </PageBody>
    </>
  );
}
