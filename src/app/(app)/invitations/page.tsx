import { IconMail } from "@/components/icons";
import { JoinTripForm } from "@/components/join-trip-form";
import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { formatDate } from "@/components/ui";
import { requireUser } from "@/lib/supabase/server";
import type { TripInvitationRow } from "@/lib/supabase/types";

export const metadata = { title: "招待のお知らせ | おでかけ記録" };
export const dynamic = "force-dynamic";

export default async function InvitationsPage() {
  const { supabase, user } = await requireUser();

  // RLS により、自分のメールアドレス宛の招待だけが返る
  const { data } = await supabase
    .from("trip_invitations")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  const invitations = ((data ?? []) as TripInvitationRow[]).filter(
    (i) => i.email && user.email && i.email.toLowerCase() === user.email.toLowerCase(),
  );

  const tripTitles = new Map<string, string>();
  if (invitations.length > 0) {
    const { data: trips } = await supabase
      .from("trips")
      .select("id, title")
      .in(
        "id",
        invitations.map((i) => i.trip_id),
      );
    for (const trip of trips ?? []) tripTitles.set(trip.id, trip.title);
  }

  return (
    <>
      <PageHeader title="招待のお知らせ" backHref="/mypage" />
      <PageBody>
        <section>
          <h2 className="mb-2 px-1 text-base font-bold">届いている招待</h2>
          {invitations.length === 0 ? (
            <div className="rough-card flex flex-col items-center gap-2 px-6 py-8 text-center">
              <span className="text-ink-faint">
                <IconMail size={30} />
              </span>
              <p className="font-semibold">届いている招待はありません</p>
              <p className="text-sm leading-relaxed text-ink-soft">
                招待コードを受け取っている場合は、下から参加できます。
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {invitations.map((invitation) => (
                <li key={invitation.id} className="rough-card px-4 py-4">
                  <p className="font-semibold">{tripTitles.get(invitation.trip_id) ?? "共有旅"}</p>
                  <p className="mt-1 text-xs text-ink-faint">
                    招待コード {invitation.invite_code}・{formatDate(invitation.expires_at)}まで有効
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-2 px-1 text-base font-bold">招待コードで参加する</h2>
          <JoinTripForm />
        </section>
      </PageBody>
    </>
  );
}
