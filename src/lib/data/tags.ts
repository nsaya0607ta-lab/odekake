import type { DB } from "./client";

const MAX_TAGS_PER_VISIT = 10;
const MAX_TAG_LENGTH = 20;

/** 入力欄の文字列をタグ名の配列に整える */
function parseTagNames(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(/[,、\s]+/)
        .map((tag) => tag.trim().replace(/^#/, ""))
        .filter((tag) => tag.length > 0 && tag.length <= MAX_TAG_LENGTH),
    ),
  ].slice(0, MAX_TAGS_PER_VISIT);
}

/**
 * 入力されたタグ名を tags テーブルへ登録し、訪問記録に紐づけ直す。
 * 新規作成と更新の両方から呼ぶので、必ず既存の紐づけを消してから入れ直す。
 */
export async function syncVisitTags(supabase: DB, userId: string, visitId: string, raw: string) {
  const names = parseTagNames(raw);

  await supabase.from("visit_record_tags").delete().eq("visit_record_id", visitId);
  if (names.length === 0) return;

  const { data: tags } = await supabase
    .from("tags")
    .upsert(
      names.map((name) => ({ user_id: userId, name })),
      { onConflict: "user_id,name" },
    )
    .select("id");

  if (!tags || tags.length === 0) return;

  await supabase
    .from("visit_record_tags")
    .insert(tags.map((tag) => ({ visit_record_id: visitId, tag_id: tag.id })));
}
