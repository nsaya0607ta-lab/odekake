import type { DB } from "@/lib/data/client";

/** 名前は表示用。権限は管理側で登録したアカウントに固定する。 */
export async function canSeeTownBuilder(displayName: string | null | undefined, db: DB): Promise<boolean> {
  if (displayName?.trim() !== "しゅん") return false;
  const { data, error } = await (db.rpc.bind(db) as unknown as (name: string) => PromiseLike<{ data: unknown; error: unknown }>)("has_town_builder_access");
  return !error && data === true;
}
