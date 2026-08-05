import Link from "next/link";
import { IconLeaf } from "@/components/icons";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center px-5 py-10">
      <div className="w-full max-w-md fade-in">
        <div className="mb-7 flex flex-col items-center gap-2 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full border border-leaf bg-leaf-soft text-leaf-deep">
            <IconLeaf size={28} />
          </span>
          <p className="text-xl font-bold tracking-wide">おでかけ記録</p>
          <p className="text-sm text-ink-soft">訪れた場所を、地図で振り返る。</p>
        </div>
        {children}
        <p className="mt-6 flex justify-center gap-4 text-xs text-ink-faint">
          <Link href="/terms" className="underline underline-offset-4">
            利用規約
          </Link>
          <Link href="/privacy" className="underline underline-offset-4">
            プライバシー
          </Link>
        </p>
      </div>
    </div>
  );
}
