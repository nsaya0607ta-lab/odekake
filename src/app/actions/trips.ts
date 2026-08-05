"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/components/form";
import { toJapaneseError } from "@/lib/errors";
import { requireUser } from "@/lib/supabase/server";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export async function generateInviteCode(length = 8): Promise<string> {
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
    cover_image_url: firstPhotoPath(formData),
    invite_code: isShared ? await generateInviteCode() : null,
  });

  if (error) {
    return { error: toJapaneseError(error, "旅行の作成に失敗しました。"), values };
  }

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

    if (emails.length > 0) {
      const rows = await Promise.all(
        emails.map(async (email) => ({ trip_id: tripId, email, invite_code: await generateInviteCode() })),
      );
      await supabase.from("trip_invitations").insert(rows);
    }
  }

  revalidatePath("/home");
  revalidatePath("/records");
  redirect(`/trips/${tripId}`);
}

export async function updateTripAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const tripId = String(formData.get("tripId") ?? "");
  const values = collect(formData);
  const parsed = tripSchema.safeParse(values);

  if (!parsed.success) {
    return { error: "入力内容をご確認ください。", fieldErrors: fieldErrorsOf(parsed.error), values };
  }

  const { supabase } = await requireUser();
  const coverPath = firstPhotoPath(formData);

  const { error } = await supabase
    .from("trips")
    .update({
      title: parsed.data.title,
      start_date: parsed.data.startDate,
      end_date: parsed.data.endDate,
      description: parsed.data.description,
      cover_image_url: coverPath,
    })
    .eq("id", tripId);

  if (error) return { error: toJapaneseError(error, "旅行の更新に失敗しました。"), values };

  revalidatePath(`/trips/${tripId}`);
  return { ok: true, message: "旅行の情報を更新しました。", values };
}

export async function deleteTripAction(formData: FormData) {
  const tripId = String(formData.get("tripId") ?? "");
  const { supabase } = await requireUser();
  await supabase.from("trips").delete().eq("id", tripId);
  revalidatePath("/home");
  revalidatePath("/records");
  redirect("/records?tab=trips");
}

export async function inviteMemberAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const tripId = String(formData.get("tripId") ?? "");
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { error: "メールアドレスの形式が正しくありません。", values: { email } };
  }

  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("trip_invitations")
    .insert({ trip_id: tripId, email, invite_code: await generateInviteCode() });

  if (error) return { error: toJapaneseError(error, "招待の作成に失敗しました。"), values: { email } };

  revalidatePath(`/trips/${tripId}/settings`);
  return { ok: true, message: `${email} を招待しました。招待コードを相手に伝えてください。` };
}

export async function cancelInvitationAction(formData: FormData) {
  const invitationId = String(formData.get("invitationId") ?? "");
  const tripId = String(formData.get("tripId") ?? "");
  const { supabase } = await requireUser();
  await supabase.from("trip_invitations").update({ status: "cancelled" }).eq("id", invitationId);
  revalidatePath(`/trips/${tripId}/settings`);
}

export async function regenerateInviteCodeAction(formData: FormData) {
  const tripId = String(formData.get("tripId") ?? "");
  const { supabase } = await requireUser();
  await supabase.from("trips").update({ invite_code: await generateInviteCode() }).eq("id", tripId);
  revalidatePath(`/trips/${tripId}/settings`);
}

export async function removeMemberAction(formData: FormData) {
  const tripId = String(formData.get("tripId") ?? "");
  const userId = String(formData.get("userId") ?? "");
  const { supabase } = await requireUser();
  await supabase.from("trip_members").delete().eq("trip_id", tripId).eq("user_id", userId);
  revalidatePath(`/trips/${tripId}/settings`);
}

export async function leaveTripAction(formData: FormData) {
  const tripId = String(formData.get("tripId") ?? "");
  const { supabase, user } = await requireUser();
  await supabase.from("trip_members").delete().eq("trip_id", tripId).eq("user_id", user.id);
  revalidatePath("/records");
  redirect("/records?tab=trips");
}

export async function joinTripAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const code = String(formData.get("inviteCode") ?? "")
    .trim()
    .toUpperCase();

  if (code.length < 4) {
    return { error: "招待コードを入力してください。", values: { inviteCode: code } };
  }

  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("join_trip_by_code", { p_code: code });

  if (error) {
    return { error: toJapaneseError(error, "参加できませんでした。"), values: { inviteCode: code } };
  }

  const joined = Array.isArray(data) ? data[0] : null;
  if (!joined) {
    return { error: "招待コードが見つかりません。コードをご確認ください。", values: { inviteCode: code } };
  }

  revalidatePath("/home");
  revalidatePath("/records");
  redirect(`/trips/${joined.trip_id}`);
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
