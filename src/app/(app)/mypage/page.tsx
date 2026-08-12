import Link from "next/link";
import { signOutAction } from "@/app/(auth)/actions";
import {
  IconCalendar,
  IconChat,
  IconChevronRight,
  IconCoin,
  IconFlag,
  IconHeart,
  IconLogout,
  IconMail,
  IconStar,
  IconUser,
} from "@/components/icons";
import { PageBody } from "@/components/page-body";
import { TopHeader } from "@/components/page-header";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "マイページ | おでかけ記録" };
export const dynamic = "force-dynamic";

export default async function MyPage() {
  await requireUser();

  return (
    <>
      <TopHeader title="マイページ" />
      <PageBody>
        <nav>
          <ul className="rough-card divide-y divide-line overflow-hidden">
            <MenuItem href="/mypage/favorites" icon={<IconHeart size={20} />} label="お気に入り" />
            <MenuItem href="/mypage/wishlist" icon={<IconFlag size={20} />} label="また行きたい場所" />
            <MenuItem href="/records?tab=trips" icon={<IconCalendar size={20} />} label="旅行の計画" />
            <MenuItem href="/mypage/exp-history" icon={<IconStar size={20} />} label="おでかけレベル・EXP履歴" />
            <MenuItem href="/mypage/coins" icon={<IconCoin size={20} />} label="おでかけコイン" />
            <MenuItem href="/mypage/gear" icon={<span className="text-lg leading-none">🐾</span>} label="おぼえたしぐさ" />
            <MenuItem href="/mypage/dog-skin" icon={<span className="text-lg leading-none">🐕</span>} label="犬のすがたを選ぶ" />
          </ul>
        </nav>

        <nav>
          <p className="mb-2 px-1 text-xs font-semibold text-ink-faint">設定</p>
          <ul className="rough-card divide-y divide-line overflow-hidden">
            <MenuItem href="/mypage/step-sync" icon={<span className="text-lg leading-none">👟</span>} label="iPhone歩数連携" />
            <MenuItem href="/mypage/profile" icon={<IconUser size={20} />} label="プロフィールを編集" />
            <MenuItem href="/mypage/account" icon={<IconMail size={20} />} label="アカウント設定" />
            <MenuItem href="/mypage/help" icon={<IconChat size={20} />} label="ヘルプ・お問い合わせ" />
          </ul>
        </nav>

        <form action={signOutAction}>
          <button type="submit" className="btn btn-quiet w-full">
            <IconLogout size={18} />
            ログアウト
          </button>
        </form>
      </PageBody>
    </>
  );
}

function MenuItem({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <li>
      <Link href={href} className="flex items-center gap-3 px-4 py-4 transition-colors active:bg-paper-deep">
        <span className="shrink-0 text-ink-faint">{icon}</span>
        <span className="min-w-0 flex-1 truncate font-semibold">{label}</span>
        <IconChevronRight size={18} className="shrink-0 text-ink-faint" />
      </Link>
    </li>
  );
}
