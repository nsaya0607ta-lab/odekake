import {
  IconCamera,
  IconChat,
  IconFlag,
  IconMapPin,
  IconNotebook,
  IconTrash,
  IconUsers,
} from "@/components/icons";
import type { TripActivityEntry } from "@/lib/data/trips";
import type { TripActivityAction } from "@/lib/supabase/types";

const TONE: Record<TripActivityAction, { icon: React.ReactNode; className: string }> = {
  trip_created: { icon: <IconFlag size={16} />, className: "bg-leaf-soft text-leaf-deep" },
  trip_updated: { icon: <IconNotebook size={16} />, className: "bg-paper-deep text-ink-soft" },
  member_joined: { icon: <IconUsers size={16} />, className: "bg-sky-soft text-[#42718f]" },
  member_left: { icon: <IconUsers size={16} />, className: "bg-paper-deep text-ink-soft" },
  member_removed: { icon: <IconUsers size={16} />, className: "bg-paper-deep text-ink-soft" },
  visit_added: { icon: <IconMapPin size={16} />, className: "bg-leaf-soft text-leaf-deep" },
  visit_updated: { icon: <IconNotebook size={16} />, className: "bg-paper-deep text-ink-soft" },
  visit_deleted: { icon: <IconTrash size={16} />, className: "bg-blossom-soft text-[#95505e]" },
  photo_added: { icon: <IconCamera size={16} />, className: "bg-blossom-soft text-[#95505e]" },
  photo_removed: { icon: <IconTrash size={16} />, className: "bg-paper-deep text-ink-soft" },
  comment_added: { icon: <IconChat size={16} />, className: "bg-sky-soft text-[#42718f]" },
};

function describe(entry: TripActivityEntry): string {
  const who = `${entry.actorName}さん`;
  const what = entry.targetLabel ? `「${entry.targetLabel}」` : "";

  switch (entry.action) {
    case "trip_created":
      return `${who}が旅行をつくりました`;
    case "trip_updated":
      return `${who}が旅行の情報を編集しました`;
    case "member_joined":
      return `${who}が参加しました`;
    case "member_left":
      return `${who}が退出しました`;
    case "member_removed":
      return `${entry.targetLabel ?? "メンバー"}さんが旅行から外れました`;
    case "visit_added":
      return `${who}が${what}の記録を追加しました`;
    case "visit_updated":
      return `${who}が${what}の記録を編集しました`;
    case "visit_deleted":
      return `${who}が${what}の記録を削除しました`;
    case "photo_added":
      return `${who}が${what}に写真を${entry.photoCount ?? 1}枚追加しました`;
    case "photo_removed":
      return `${who}が${what}の写真を${entry.photoCount ?? 1}枚削除しました`;
    case "comment_added":
      return `${who}がコメントしました${what ? `：${entry.targetLabel}` : ""}`;
    default:
      return `${who}が操作しました`;
  }
}

/** 日付は「今日 / 昨日 / 月日」で、時刻は 24 時間表記で出す */
function formatMoment(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const time = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86_400_000);

  if (days === 0) return `今日 ${time}`;
  if (days === 1) return `昨日 ${time}`;
  if (date.getFullYear() === new Date().getFullYear()) {
    return `${date.getMonth() + 1}/${date.getDate()} ${time}`;
  }
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}

export function TripActivityList({ entries }: { entries: TripActivityEntry[] }) {
  if (entries.length === 0) {
    return <p className="rough-card px-4 py-6 text-center text-sm text-ink-soft">まだ動きがありません。</p>;
  }

  return (
    <ul className="rough-card divide-y divide-line">
      {entries.map((entry) => {
        const tone = TONE[entry.action];
        return (
          <li key={entry.id} className="flex items-start gap-3 px-4 py-3">
            <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${tone.className}`}>
              {tone.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm leading-relaxed">{describe(entry)}</span>
              <span className="mt-0.5 block text-[11px] text-ink-faint tabular-nums">
                {formatMoment(entry.createdAt)}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
