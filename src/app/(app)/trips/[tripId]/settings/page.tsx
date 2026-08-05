import { notFound, redirect } from "next/navigation";
import {
  cancelInvitationAction,
  deleteTripAction,
  regenerateInviteCodeAction,
  removeMemberAction,
  resendInvitationAction,
} from "@/app/actions/trips";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { IconUsers } from "@/components/icons";
import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { formatDate } from "@/components/ui";
import { getTripCoverUrl, getTripMembers } from "@/lib/data/trips";
import { getMailer } from "@/lib/email";
import { getSiteUrl } from "@/lib/supabase/env";
import { requireUser } from "@/lib/supabase/server";
import type { TripInvitationRow, TripRow } from "@/lib/supabase/types";
import { InvitationActions } from "./invitation-row";
import { InviteCodeBox } from "./invite-code-box";
import { InviteMemberForm } from "./invite-member-form";
import { TripSettingsForm } from "./trip-settings-form";

export const metadata = { title: "旅行の設定 | おでかけ記録" };
export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  pending: "招待中",
  accepted: "参加済み",
  expired: "期限切れ",
  cancelled: "取り消し",
};

const EMAIL_STATUS_LABELS: Record<string, string> = {
  not_sent: "メール未送信",
  queued: "メール送信中",
  sent: "メール送信済み",
  failed: "メール送信に失敗",
};

export default async function TripSettingsPage({ params }: { params: Promise<{ tripId: string }> }) {
  const [{ tripId }, { supabase, user }] = await Promise.all([params, requireUser()]);

  const { data: tripData } = await supabase.from("trips").select("*").eq("id", tripId).maybeSingle();
  if (!tripData) notFound();
  const trip = tripData as TripRow;

  // 設定はオーナーのみ
  if (trip.owner_id !== user.id) redirect(`/trips/${trip.id}`);

  const [members, coverUrl, { data: invitationRows }] = await Promise.all([
    getTripMembers(supabase, trip.id),
    getTripCoverUrl(supabase, trip),
    supabase
      .from("trip_invitations")
      .select("*")
      .eq("trip_id", trip.id)
      .order("created_at", { ascending: false }),
  ]);

  const invitations = (invitationRows ?? []) as TripInvitationRow[];
  const isShared = trip.trip_type === "shared";
  const emailSendingEnabled = getMailer().enabled;
  const siteUrl = getSiteUrl();

  return (
    <>
      <PageHeader title="旅行の設定" backHref={`/trips/${trip.id}`} />
      <PageBody>
        <section>
          <h2 className="mb-2 px-1 text-base font-bold">旅行の情報</h2>
          <TripSettingsForm userId={user.id} trip={trip} coverUrl={coverUrl} />
        </section>

        {isShared ? (
          <>
            <section>
              <h2 className="mb-2 px-1 text-base font-bold">招待</h2>
              <InviteCodeBox code={trip.invite_code ?? ""} link={`${siteUrl}/join/${trip.invite_code ?? ""}`} />
              <form action={regenerateInviteCodeAction} className="mt-2">
                <input type="hidden" name="tripId" value={trip.id} />
                <ConfirmSubmitButton
                  className="btn btn-quiet w-full"
                  message="招待コードを作り直すと、いまのコードは使えなくなります。よろしいですか？"
                  pendingLabel="発行中…"
                >
                  招待コードを再発行する
                </ConfirmSubmitButton>
              </form>

              <div className="mt-4">
                <InviteMemberForm tripId={trip.id} emailSendingEnabled={emailSendingEnabled} />
              </div>

              {invitations.length > 0 ? (
                <>
                  <h3 className="mt-4 mb-2 px-1 text-sm font-bold text-ink-soft">招待の状況</h3>
                  <ul className="rough-card divide-y divide-line">
                    {invitations.map((invitation) => (
                      <li key={invitation.id} className="space-y-2 px-4 py-3">
                        <div className="flex items-start gap-3">
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold">
                              {invitation.email ?? "コード招待"}
                            </span>
                            <span className="mt-0.5 block text-[11px] text-ink-faint">
                              {STATUS_LABELS[invitation.status] ?? invitation.status}
                              {invitation.email ? `・${EMAIL_STATUS_LABELS[invitation.email_status] ?? ""}` : ""}
                              ・{formatDate(invitation.expires_at)}まで
                            </span>
                            {invitation.email_error ? (
                              <span className="mt-0.5 block text-[11px] text-[#a85c6a]">
                                {invitation.email_error}
                              </span>
                            ) : null}
                          </span>
                          {invitation.status === "pending" ? (
                            <InvitationActions
                              code={invitation.invite_code}
                              link={`${siteUrl}/join/${invitation.invite_code}`}
                            />
                          ) : null}
                        </div>

                        {invitation.status === "pending" ? (
                          <div className="flex items-center gap-4">
                            {invitation.email && emailSendingEnabled ? (
                              <form action={resendInvitationAction}>
                                <input type="hidden" name="invitationId" value={invitation.id} />
                                <input type="hidden" name="tripId" value={trip.id} />
                                <button type="submit" className="text-xs text-leaf-deep underline underline-offset-4">
                                  もう一度送る
                                </button>
                              </form>
                            ) : null}
                            <form action={cancelInvitationAction}>
                              <input type="hidden" name="invitationId" value={invitation.id} />
                              <input type="hidden" name="tripId" value={trip.id} />
                              <button type="submit" className="text-xs text-[#95505e] underline underline-offset-4">
                                取り消す
                              </button>
                            </form>
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </section>

            <section>
              <h2 className="mb-2 px-1 text-base font-bold">メンバー</h2>
              <ul className="rough-card divide-y divide-line">
                {members.map((member) => (
                  <li key={member.userId} className="flex items-center gap-3 px-4 py-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-paper-deep text-ink-faint">
                      <IconUsers size={18} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{member.displayName}</span>
                      <span className="text-[11px] text-ink-faint">
                        {member.role === "owner" ? "オーナー" : "メンバー"}・{formatDate(member.joinedAt)}参加
                      </span>
                    </span>
                    {member.role !== "owner" ? (
                      <form action={removeMemberAction}>
                        <input type="hidden" name="tripId" value={trip.id} />
                        <input type="hidden" name="userId" value={member.userId} />
                        <ConfirmSubmitButton
                          className="text-xs text-[#95505e] underline underline-offset-4"
                          message={`${member.displayName}さんをこの旅行から外します。よろしいですか？`}
                          pendingLabel="処理中…"
                        >
                          外す
                        </ConfirmSubmitButton>
                      </form>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          </>
        ) : null}

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
