import { CopyButton } from "@/components/copy-button";
import { IconLink } from "@/components/icons";

/** 招待1件ぶんの、コピーと共有の操作 */
export function InvitationActions({ code, link }: { code: string; link: string }) {
  const pillClass =
    "rough-pill flex items-center gap-1 border border-line-strong bg-card px-2.5 py-1 text-[11px] font-semibold text-ink-soft";

  return (
    <span className="flex shrink-0 gap-1.5">
      <CopyButton value={code} copiedLabel="コピー済" className={pillClass}>
        コード
      </CopyButton>
      <CopyButton value={link} copiedLabel="コピー済" icon={<IconLink size={13} />} className={pillClass}>
        リンク
      </CopyButton>
    </span>
  );
}
