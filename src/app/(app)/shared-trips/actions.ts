"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/components/form";
import { toJapaneseError } from "@/lib/errors";
import { requireUser } from "@/lib/supabase/server";

const schema = z
  .object({
    title: z.string().trim().min(1, "旅の名前を入力してください。").max(60, "旅の名前は60文字以内です。"),
    startDate: z.string().trim(),
    endDate: z.string().trim(),
    description: z.string().trim().max(1000, "説明は1000文字以内です。"),
  })
  .refine((value) => !value.startDate || !value.endDate || value.startDate <= value.endDate, {
    message: "終了日は開始日より後にしてください。",
  });

export async function createSharedTripAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = {
    title: String(formData.get("title") ?? ""),
    startDate: String(formData.get("startDate") ?? ""),
    endDate: String(formData.get("endDate") ?? ""),
    description: String(formData.get("description") ?? ""),
  };
  const parsed = schema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "入力内容をご確認ください。", values };

  const friendIds = formData.getAll("friendIds").map(String).filter(Boolean);
  if (friendIds.length === 0) return { error: "一緒に行くフレンドを1人以上選んでください。", values };

  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("create_shared_trip", {
    p_title: parsed.data.title,
    p_friend_user_ids: friendIds,
    p_start_date: parsed.data.startDate || null,
    p_end_date: parsed.data.endDate || null,
    p_description: parsed.data.description || null,
  });
  if (error) {
    console.error("Shared trip creation failed", { code: error.code, message: error.message });
    return { error: toJapaneseError(error, "共有旅を作成できませんでした。"), values };
  }

  revalidatePath("/shared-trips");
  redirect("/shared-trips?created=1");
}

export async function leaveSharedTripAction(formData: FormData) {
  const tripId = String(formData.get("tripId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(tripId)) redirect("/shared-trips");

  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("leave_shared_trip", { p_trip_id: tripId });
  if (error) {
    console.error("Leave shared trip failed", { code: error.code, message: error.message });
    redirect("/shared-trips?error=leave");
  }
  revalidatePath("/shared-trips");
  redirect("/shared-trips?left=1");
}

export async function respondSharedTripInvitationAction(formData: FormData) {
  const tripId = String(formData.get("tripId") ?? "");
  const accept = String(formData.get("response") ?? "") === "accept";
  if (!/^[0-9a-f-]{36}$/i.test(tripId)) redirect("/shared-trips");

  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("respond_shared_trip_invitation", {
    p_trip_id: tripId,
    p_accept: accept,
  });
  if (error) console.error("Shared trip invitation response failed", { code: error.code, message: error.message });
  revalidatePath("/shared-trips");
  redirect(`/shared-trips?responded=${accept ? "accepted" : "declined"}`);
}
