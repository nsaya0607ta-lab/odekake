import { CopyButton } from "@/components/copy-button";
import { IconLink } from "@/components/icons";

export function InviteCodeBox({ code, link }: { code: string; link: string }) {
  if (!code) {
    return (
      <p className="rough-card px-4 py-4 text-sm text-ink-soft">
        招待コードがまだありません。下のボタンから発行してください。
      </p>
    );
  }

  return (
    <div className="rough-card min-w-0 space-y-3 p-4">
      <div className="min-w-0">
        <p className="text-xs text-ink-faint">招待コード</p>
        <p className="mt-1 break-all text-xl font-bold tracking-[0.14em] tabular-nums sm:text-2xl sm:tracking-[0.2em]">
          {code}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
        <CopyButton value={code} className="btn btn-quiet min-w-0 w-full px-3 text-sm">
          コードをコピー
        </CopyButton>
        <CopyButton
          value={link}
          icon={<IconLink size={17} />}
          className="btn btn-quiet min-w-0 w-full px-3 text-sm"
        >
          リンクをコピー
        </CopyButton>
      </div>

      <p className="text-xs leading-relaxed text-ink-faint">
        このコードまたはリンクを共有すると、相手がログイン後に旅行へ参加できます。
      </p>
    </div>
  );
}
