import { cache } from "react";
import type { DB } from "./client";

/**
 * 記録の置き場所
 * =============================================================
 * このアプリは自分ひとりで記録するアプリなので、記録の置き場所は
 * ひとつだけ。ホームや記録画面の上に出す名前と、集計・一覧の
 * 絞り込みに使う旅行の ID をまとめて持つ。
 *
 * 名前は profiles.space_name に保存し、未設定なら「自分の旅」を使う。
 * （以前は共有旅ごとに空間が分かれていて、名前は変更できなかった）
 */
export const DEFAULT_SPACE_NAME = "自分の旅";
export const SPACE_NAME_MAX = 30;

export type RecordSpace = {
  name: string;
  /** 自分の旅行すべて。RLS により他人の旅行は含まれない */
  tripIds: string[];
};

/** 同じ画面内で複数の箇所から呼ばれるため、1リクエスト中の取得はまとめる */
export const getRecordSpace = cache(async function getRecordSpace(
  supabase: DB,
  userId: string,
): Promise<RecordSpace> {
  const [{ data: profile }, { data: trips }] = await Promise.all([
    supabase.from("profiles").select("space_name").eq("user_id", userId).maybeSingle(),
    supabase.from("trips").select("id"),
  ]);

  return {
    name: profile?.space_name?.trim() || DEFAULT_SPACE_NAME,
    tripIds: (trips ?? []).map((trip) => trip.id),
  };
});
