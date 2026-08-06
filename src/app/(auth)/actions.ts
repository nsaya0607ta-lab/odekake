"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/components/form";
import { toJapaneseError } from "@/lib/errors";
import { safeNextPath } from "@/lib/navigation";
import { getSiteUrl } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

const emailSchema = z.string().trim().min(1, "メールアドレスを入力してください。").email("メールアドレスの形式が正しくありません。");
const passwordSchema = z
  .string()
  .min(8, "パスワードは8文字以上で入力してください。")
  .max(72, "パスワードは72文字以内で入力してください。");

function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!result[key]) result[key] = issue.message;
  }
  return result;
}

function authCallbackUrl(next: string): string {
  const callback = new URL("/auth/callback", getSiteUrl());
  callback.searchParams.set("next", safeNextPath(next));
  return callback.toString();
}

export async function signUpAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const raw = {
    displayName: String(formData.get("displayName") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
    passwordConfirm: String(formData.get("passwordConfirm") ?? ""),
    next: safeNextPath(String(formData.get("next") ?? "/home")),
  };
  const values = { displayName: raw.displayName, email: raw.email, next: raw.next };

  const parsed = z
    .object({
      displayName: z.string().trim().min(1, "ニックネームを入力してください。").max(30, "ニックネームは30文字以内で入力してください。"),
      email: emailSchema,
      password: passwordSchema,
      passwordConfirm: z.string(),
      next: z.string(),
    })
    .refine((v) => v.password === v.passwordConfirm, {
      message: "パスワードが一致しません。",
      path: ["passwordConfirm"],
    })
    .safeParse(raw);

  if (!parsed.success) {
    return { error: "入力内容をご確認ください。", fieldErrors: fieldErrorsOf(parsed.error), values };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.displayName },
      emailRedirectTo: authCallbackUrl(parsed.data.next),
    },
  });

  if (error) {
    return { error: toJapaneseError(error, "登録に失敗しました。"), values };
  }

  const query = new URLSearchParams({ email: parsed.data.email, next: parsed.data.next });
  redirect(`/signup/complete?${query.toString()}`);
}

export async function signInAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(String(formData.get("next") ?? "/home"));
  const values = { email };

  const parsed = z.object({ email: emailSchema, password: z.string().min(1, "パスワードを入力してください。") }).safeParse({
    email,
    password,
  });

  if (!parsed.success) {
    return { error: "入力内容をご確認ください。", fieldErrors: fieldErrorsOf(parsed.error), values };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password });

  if (error) {
    return { error: toJapaneseError(error, "ログインに失敗しました。"), values };
  }

  redirect(next);
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function resendConfirmationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const next = safeNextPath(String(formData.get("next") ?? "/home"));
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) return { error: "メールアドレスの形式が正しくありません。", values: { email, next } };

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: parsed.data,
    options: { emailRedirectTo: authCallbackUrl(next) },
  });

  if (error) return { error: toJapaneseError(error, "確認メールの再送に失敗しました。"), values: { email, next } };
  return { ok: true, message: "確認メールを再送しました。メールボックスをご確認ください。", values: { email, next } };
}

export async function requestPasswordResetAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "メールアドレスをご確認ください。", values: { email } };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: authCallbackUrl("/reset-password"),
  });

  if (error) return { error: toJapaneseError(error, "メールの送信に失敗しました。"), values: { email } };

  return {
    ok: true,
    message: "パスワード再設定のメールを送信しました。届いたリンクから新しいパスワードを設定してください。",
    values: { email },
  };
}

export async function updatePasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("passwordConfirm") ?? "");

  const parsed = z
    .object({ password: passwordSchema, passwordConfirm: z.string() })
    .refine((v) => v.password === v.passwordConfirm, {
      message: "パスワードが一致しません。",
      path: ["passwordConfirm"],
    })
    .safeParse({ password, passwordConfirm });

  if (!parsed.success) {
    return { error: "入力内容をご確認ください。", fieldErrors: fieldErrorsOf(parsed.error) };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "リンクの有効期限が切れています。もう一度パスワード再設定をやり直してください。" };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: toJapaneseError(error, "パスワードの変更に失敗しました。") };

  redirect("/home?notice=password-updated");
}
