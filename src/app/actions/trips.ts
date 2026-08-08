"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/components/form";
import { getMailer, renderTripInvitationMail } from "@/lib/email";
import { toJapaneseError } from "@/lib/errors";
import { finalizePhotoPaths } from "@/lib/photos";
import { setCurrentWorkspace } from "@/app/actions/workspace";
import { PHOTO_BUCKET } from "@/lib/data/client";
import { PERSONAL_WORKSPACE_ID } from "@/lib/data/workspace";
import { safeNextPath } from "@/lib/navigation";
import { getSiteUrl } from "@/lib/supabase/env";
import { requireUser } from "@/lib/supabase/server";
import type { DB } from "@/lib/data/client";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

async function generateInviteCode(length = 8): Promise<string> {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => CODE_CHARS[b % CODE_CHARS.length]).join("");
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable();

const optionalDate = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "日付を正しく入力してください。");

const tripSchema = z
  .object({
    title: z.string().trim().min(1, "旅行名を入力してください。").max(60, "旅行名は60文字以内で入力してください。"),
    tripType: z.enum(["solo", "shared"]),
    startDate: optionalDate,
    endDate: optionalDate,
    description: optionalText(1000),
  })
  .refine((v) => !v.startDate || !v.endDate || v.startDate <= v.endDate, {
    message: "終了日は開始日より後にしてください。",
    path: ["endDate"],
  });

function collect(formData: FormData) {
  return {
    title: String(formData.get("title") ?? ""),
    tripType: String(formData.get("tripType") ?? "solo"),
    startDate: String(formData.get("startDate") ?? ""),
    endDate: String(formData.get("endDate") ?? ""),
    description: String(formData.get("description") ?? ""),
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

function firstPhotoPath(formData: FormData): string | null {
  try {
    const parsed: unknown = JSON.parse(String(formData.get("coverPaths") ?? "[]"));
    if (Array.isArray(parsed) && typeof parsed[0] === "string") return parsed[0];
  } catch {
    // 画像がなくても保存できる
  }
  return null;
}

/** 一時領域にある表紙画像を旅行の保存先へ移す */
async function moveCover(supabase: DB, tripId: string, path: string | null): Promise<string | null> {
  if (!path) return null;
  const [moved] = await finalizePhotoPaths(supabase, [path], `trips/${tripId}/cover`);
  return moved ?? null;
}

/** 差し替え前の表紙画像を消す。残しておくとストレージに孤立ファイルがたまる */
async function removeReplacedCover(supabase: DB, previous: string | null, next: string | null) {
  if (!previous || previous === next) return;
  await supabase.storage.from(PHOTO_BUCKET).remove([previous]);
}

export async function createTripAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = collect(formData);
  const parsed = tripSchema.safeParse(values);

  if (!parsed.success) {
    return { error: "入力内容をご確認ください。", fieldErrors: fieldErrorsOf(parsed.error), values };
  }

  const tripId = String(formData.get("tripId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(tripId)) {
    return { error: "保存に失敗しました。画面を開き直してもう一度お試しください。", values };
  }

  const { supabase, user } = await requireUser();

  // 二重送信の防止
  const { data: existing } = await supabase.from("trips").select("id").eq("id", tripId).maybeSingle();
  if (existing) redirect(`/trips/${tripId}`);

  const isShared = parsed.data.tripType === "shared";

  const { error } = await supabase.from("trips").insert({
    id: tripId,
    owner_id: user.id,
    title: parsed.data.title,
    trip_type: parsed.data.tripType,
    start_date: parsed.data.startDate,
    end_date: parsed.data.endDate,
    description: parsed.data.description,
    invite_code: isShared ? await generateInviteCode() : null,
  });

  if (error) {
    return { error: toJapaneseError(error, "旅行の作成に失敗しました。"), values };
  }

  // 表紙画像は旅行を作ってから移す（保存先の権限は旅行の存在を前提にしているため）
  const cover = await moveCover(supabase, tripId, firstPhotoPath(formData));
  if (cover) await supabase.from("trips").update({ cover_image_url: cover }).eq("id", tripId);

  // 共有旅では、入力されたメールアドレス宛の招待をまとめて作成する
  if (isShared) {
    const emails = [
      ...new Set(
        String(formData.get("inviteEmails") ?? "")
          .split(/[,\s]+/)
          .map((e) => e.trim().toLowerCase())
          .filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)),
      ),
    ].slice(0, 20);

    for (const email of emails) {
      await createInvitation(supabase, { tripId, email, invitedBy: user.id });
    }
  }

  // 共有旅は独立した空間なので、作成したらその空間へ移る
  await setCurrentWorkspace(isShared ? tripId : PERSONAL_WORKSPACE_ID);

  revalidatePath("/home");
  revalidatePath("/records");

  // 「旅行がないので先に作る」導線から来た場合は、書きかけの画面へ戻す
  const requestedNext = String(formData.get("next") ?? "");
  if (requestedNext) redirect(safeNextPath(requestedNext, `/trips/${tripId}`));

  redirect(isShared ? "/home" : `/trips/${tripId}`);
}

export async function updateTripAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const tripId = String(formData.get("tripId") ?? "");
  const values = collect(formData);
  const parsed = tripSchema.safeParse(values);

  if (!parsed.success) {
    return { error: "入力内容をご確認ください。", fieldErrors: fieldErrorsOf(parsed.error), values };
  }

  const { supabase } = await requireUser();
  const coverPath = await moveCover(supabase, tripId, firstPhotoPath(formData));

  const { data: current } = await supabase
    .from("trips")
    .select("cover_image_url")
    .eq("id", tripId)
    .maybeSingle();

  // 権限がない場合はエラーではなく0件更新になるため、更新された行で判定する
  const { data: updated, error } = await supabase
    .from("trips")
    .update({
      title: parsed.data.title,
      start_date: parsed.data.startDate,
      end_date: parsed.data.endDate,
      description: parsed.data.description,
      cover_image_url: coverPath,
    })
    .eq("id", tripId)
    .select("id");

  if (error) return { error: toJapaneseError(error, "旅行の更新に失敗しました。"), values };

  if ((updated ?? []).length === 0) {
    console.error("Trip update affected no rows", { tripId });
    return { error: "この旅行を編集する権限がありません。", values };
  }

  await removeReplacedCover(supabase, current?.cover_image_url ?? null, coverPath);

  revalidatePath(`/trips/${tripId}`);
  return { ok: true, message: "旅行の情報を更新しました。", values };
}

export async function deleteTripAction(formData: FormData) {
  const tripId = String(formData.get("tripId") ?? "");
  const { supabase } = await requireUser();

  // 所有者でない場合はエラーではなく0件削除になるため、削除された行で判定する
  const { data: deleted, error } = await supabase
    .from("trips")
    .delete()
    .eq("id", tripId)
    .select("id");

  if (error || (deleted ?? []).length === 0) {
    console.error("Trip delete failed", { tripId, code: error?.code, message: error?.message });
    redirect(`/trips/${tripId}/settings?error=delete`);
  }

  await setCurrentWorkspace(PERSONAL_WORKSPACE_ID);

  revalidatePath("/home");
  revalidatePath("/records");
  redirect("/home");
}

/**
 * 招待を1件作り、送信できる設定なら招待メールも送る。
 * 送信結果は trip_invitations に残すので、あとから送信機能を足しても
 * 「どの招待をまだ知らせていないか」が分かる。
 */
async function createInvitation(
  supabase: DB,
  input: { tripId: string; email: string; invitedBy: string; message?: string | null },
): Promise<{ ok: true; code: string; sent: boolean } | { ok: false; error: string }> {
  const code = await generateInviteCode();

  const { data, error } = await supabase
    .from("trip_invitations")
    .insert({
      trip_id: input.tripId,
      email: input.email,
      invite_code: code,
      invited_by: input.invitedBy,
      message: input.message ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      return { ok: false, error: "このメールアドレスにはすでに招待を送っています。" };
    }
    return { ok: false, error: toJapaneseError(error, "招待の作成に失敗しました。") };
  }

  const sent = await deliverInvitation(supabase, {
    invitationId: data.id,
    email: input.email,
    tripId: input.tripId,
    code,
    message: input.message ?? null,
    inviterId: input.invitedBy,
  });

  return { ok: true, code, sent };
}

async function deliverInvitation(
  supabase: DB,
  input: {
    invitationId: string;
    email: string;
    tripId: string;
    code: string;
    message: string | null;
    inviterId: string;
  },
): Promise<boolean> {
  const mailer = getMailer();
  if (!mailer.enabled) return false;

  // 共有旅では同じ旅のメンバーのプロフィールも読めるため、
  // 招待した本人で絞り込まないと複数行が返って名前を取得できない。
  const [{ data: trip }, { data: profile }] = await Promise.all([
    supabase.from("trips").select("title").eq("id", input.tripId).maybeSingle(),
    supabase.from("profiles").select("display_name").eq("user_id", input.inviterId).maybeSingle(),
  ]);

  const result = await mailer
    .send(
      renderTripInvitationMail({
        to: input.email,
        tripTitle: trip?.title ?? "共有旅",
        inviterName: profile?.display_name ?? "メンバー",
        inviteCode: input.code,
        joinUrl: `${getSiteUrl()}/join/${input.code}`,
        message: input.message,
      }),
    )
    .catch((error: unknown) => ({
      status: "failed" as const,
      error: error instanceof Error ? error.message : String(error),
    }));

  await supabase
    .from("trip_invitations")
    .update({
      email_status: result.status,
      email_sent_at: result.status === "sent" ? new Date().toISOString() : null,
      email_error: result.error ?? null,
    })
    .eq("id", input.invitationId);

  return result.status === "sent" || result.status === "queued";
}

export async function inviteMemberAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const tripId = String(formData.get("tripId") ?? "");
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { error: "メールアドレスの形式が正しくありません。", values: { email } };
  }

  const message = String(formData.get("message") ?? "").trim();
  if (message.length > 300) {
    return { error: "メッセージは300文字以内で入力してください。", values: { email, message } };
  }

  const { supabase, user } = await requireUser();
  const result = await createInvitation(supabase, {
    tripId,
    email,
    invitedBy: user.id,
    message: message || null,
  });

  if (!result.ok) return { error: result.error, values: { email, message } };

  revalidatePath(`/trips/${tripId}/settings`);
  return {
    ok: true,
    message: result.sent
      ? `${email} に招待メールを送りました。`
      : `${email} を招待しました。招待コード ${result.code} かリンクを相手に伝えてください。`,
  };
}

/** 招待をもう一度知らせる（メール送信が有効なら再送する） */
export async function resendInvitationAction(formData: FormData) {
  const invitationId = String(formData.get("invitationId") ?? "");
  const tripId = String(formData.get("tripId") ?? "");

  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("trip_invitations")
    .select("id, email, invite_code, message, email_attempts, invited_by")
    .eq("id", invitationId)
    .maybeSingle();

  if (!data?.email) {
    console.error("Resend invitation target not found", { invitationId });
    redirect(settingsPath(tripId, "invitation"));
  }

  await supabase
    .from("trip_invitations")
    .update({ email_attempts: (data.email_attempts ?? 0) + 1 })
    .eq("id", invitationId);
  await deliverInvitation(supabase, {
    invitationId: data.id,
    email: data.email,
    tripId,
    code: data.invite_code,
    message: data.message,
    inviterId: data.invited_by ?? user.id,
  });

  revalidatePath(`/trips/${tripId}/settings`);
}

/**
 * 設定画面の操作は、権限がないとエラーではなく0行更新になる。
 * 何も起きていないのに画面だけ描き直すと成功したように見えるため、
 * 影響した行を確かめて、駄目なら理由をクエリで返す。
 */
function settingsPath(tripId: string, error?: string) {
  return error ? `/trips/${tripId}/settings?error=${error}` : `/trips/${tripId}/settings`;
}

export async function cancelInvitationAction(formData: FormData) {
  const invitationId = String(formData.get("invitationId") ?? "");
  const tripId = String(formData.get("tripId") ?? "");
  const { supabase } = await requireUser();

  const { data, error } = await supabase
    .from("trip_invitations")
    .update({ status: "cancelled" })
    .eq("id", invitationId)
    .select("id");

  if (error || (data ?? []).length === 0) {
    console.error("Cancel invitation affected no rows", { invitationId, code: error?.code });
    redirect(settingsPath(tripId, "invitation"));
  }

  revalidatePath(`/trips/${tripId}/settings`);
}

export async function regenerateInviteCodeAction(formData: FormData) {
  const tripId = String(formData.get("tripId") ?? "");
  const { supabase } = await requireUser();

  const { data, error } = await supabase
    .from("trips")
    .update({ invite_code: await generateInviteCode() })
    .eq("id", tripId)
    .select("id");

  if (error || (data ?? []).length === 0) {
    console.error("Regenerate invite code affected no rows", { tripId, code: error?.code });
    redirect(settingsPath(tripId, "invite-code"));
  }

  revalidatePath(`/trips/${tripId}/settings`);
}

export async function removeMemberAction(formData: FormData) {
  const tripId = String(formData.get("tripId") ?? "");
  const userId = String(formData.get("userId") ?? "");
  const { supabase } = await requireUser();

  const { data, error } = await supabase
    .from("trip_members")
    .delete()
    .eq("trip_id", tripId)
    .eq("user_id", userId)
    .select("user_id");

  if (error || (data ?? []).length === 0) {
    console.error("Remove member affected no rows", { tripId, code: error?.code });
    redirect(settingsPath(tripId, "member"));
  }

  revalidatePath(`/trips/${tripId}/settings`);
}

export async function leaveTripAction(formData: FormData) {
  const tripId = String(formData.get("tripId") ?? "");
  const { supabase, user } = await requireUser();

  // 所有者は退出できない（RLS で0件削除になる）。
  // 抜けられていないのにホームへ戻すと退出できたように見えるため、結果を確かめる。
  const { data: left, error } = await supabase
    .from("trip_members")
    .delete()
    .eq("trip_id", tripId)
    .eq("user_id", user.id)
    .select("user_id");

  if (error || (left ?? []).length === 0) {
    console.error("Leave trip failed", { tripId, code: error?.code, message: error?.message });
    redirect(`/trips/${tripId}?error=leave`);
  }

  // 退出した旅の空間は開けなくなるため、自分の旅へ戻す
  await setCurrentWorkspace(PERSONAL_WORKSPACE_ID);

  revalidatePath("/home");
  revalidatePath("/records");
  redirect("/home");
}

/**
 * 招待コードで共有旅に参加する。
 * 呼び出し側で redirect() したいので、ここでは結果を返すだけにする。
 */
async function joinByCode(code: string): Promise<{ ok: true; tripId: string } | { ok: false; error: string }> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("join_trip_by_code", { p_code: code });

  if (error) return { ok: false, error: toJapaneseError(error, "参加できませんでした。") };

  const joined = Array.isArray(data) ? data[0] : null;
  if (!joined) return { ok: false, error: "招待コードが見つかりません。コードをご確認ください。" };

  // 参加した共有旅の空間へ移る
  await setCurrentWorkspace(joined.trip_id);

  revalidatePath("/home");
  revalidatePath("/records");
  revalidatePath("/invitations");
  return { ok: true, tripId: joined.trip_id };
}

export async function joinTripAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const code = String(formData.get("inviteCode") ?? "")
    .trim()
    .toUpperCase();

  if (code.length < 4) {
    return { error: "招待コードを入力してください。", values: { inviteCode: code } };
  }

  const result = await joinByCode(code);
  if (!result.ok) return { error: result.error, values: { inviteCode: code } };

  redirect("/home");
}

/** 招待のお知らせから、コードを打たずにそのまま参加する */
export async function acceptInvitationAction(formData: FormData) {
  const code = String(formData.get("inviteCode") ?? "")
    .trim()
    .toUpperCase();

  const result = await joinByCode(code);
  if (!result.ok) {
    console.error("Accept invitation failed", { message: result.error });
    redirect("/invitations?error=join");
  }

  redirect("/home");
}

export async function addTripCommentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const tripId = String(formData.get("tripId") ?? "");
  const comment = String(formData.get("comment") ?? "").trim();

  if (comment.length === 0) return { error: "コメントを入力してください。" };
  if (comment.length > 1000) return { error: "コメントは1000文字以内で入力してください。", values: { comment } };

  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("trip_comments").insert({ trip_id: tripId, user_id: user.id, comment });

  if (error) return { error: toJapaneseError(error, "コメントの投稿に失敗しました。"), values: { comment } };

  revalidatePath(`/trips/${tripId}`);
  return { ok: true };
}

export async function deleteTripCommentAction(formData: FormData) {
  const commentId = String(formData.get("commentId") ?? "");
  const tripId = String(formData.get("tripId") ?? "");
  const { supabase } = await requireUser();
  await supabase.from("trip_comments").delete().eq("id", commentId);
  revalidatePath(`/trips/${tripId}`);
}
