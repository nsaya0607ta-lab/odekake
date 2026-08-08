import { acceptInvitationAction } from "@/app/actions/trips";
import { IconMail } from "@/components/icons";
import { JoinTripForm } from "@/components/join-trip-form";
import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/form";
import { formatDate } from "@/components/ui";
import { listIncomingInvitations } from "@/lib/data/trips";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "招待のお知らせ | おでかけ記録" };
export const dynamic = "force-dynamic";

export default async function InvitationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ error }, { supabase, user }] = await Promise.all([searchParams, requireUser()]);

  const invitations = await listIncomingInvitations(supabase, user.email);

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
        {error === "join" ? (
          <p className="rounded-2xl border border-blossom bg-blossom-soft px-4 py-3 text-sm text-[#8f4c59]">
            参加できませんでした。招待が取り消されたか、期限が切れている可能性があります。
          </p>
        ) : null}

        <section>
          <h2 className="mb-2 px-1 text-base font-bold">届いている招待</h2>
          {invitations.length === 0 ? (
            <div className="rough-card flex flex-col items-center gap-2 px-6 py-8 text-center">
              <span className="text-ink-faint">
                <IconMail size={30} />
              </span>
              <p className="font-semibold">届いている招待はありません</p>
              {/* 「招待されたのに出てこない」の多くは宛先ちがい。見えるようにしておく */}
              <p className="text-sm leading-relaxed text-ink-soft">
                ここには <span className="font-semibold break-all">{user.email ?? "登録しているメールアドレス"}</span>{" "}
                宛の招待が出ます。
                別のメールアドレスで招待されている場合は、下の招待コードから参加してください。
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
                  {invitation.message ? (
                    <p className="mt-2 text-sm leading-relaxed text-ink-soft">{invitation.message}</p>
                  ) : null}
                  <form action={acceptInvitationAction} className="mt-3">
                    <input type="hidden" name="inviteCode" value={invitation.invite_code} />
                    <SubmitButton className="btn btn-quiet w-full" pendingLabel="参加中…">
                      参加する
                    </SubmitButton>
                  </form>
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
