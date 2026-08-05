import Link from "next/link";
import { IconSearch } from "@/components/icons";

export default function AppNotFound() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full border border-line-strong bg-paper-deep text-ink-faint">
        <IconSearch size={28} />
      </span>
      <h1 className="text-lg font-bold">ページが見つかりません</h1>
      <p className="text-sm leading-relaxed text-ink-soft">
        削除されたか、閲覧できないデータの可能性があります。
        <br />
        共有旅は、参加しているメンバーだけが閲覧できます。
      </p>
      <Link href="/home" className="btn btn-primary w-full">
        ホームへ戻る
      </Link>
    </div>
  );
}
