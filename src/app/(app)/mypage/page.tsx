import Link from "next/link";
import { signOutAction } from "@/app/(auth)/actions";
import {
  IconCalendar,
  IconChat,
  IconChevronRight,
  IconFlag,
  IconHeart,
  IconLogout,
  IconMail,
  IconUser,
} from "@/components/icons";
import { PageBody } from "@/components/page-body";
import { TopHeader } from "@/components/page-header";
import { loadAreaIndex } from "@/lib/data/areas";
import { signPhotoPath } from "@/lib/data/photos";
import { getRecordSpace } from "@/lib/data/space";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "マイページ | おでかけ記録" };
export const dynamic = "force-dynamic";

export default async function MyPage() {
  const { supabase, user } = await requireUser();

  const space = await getRecordSpace(supabase, user.id);
  const [{ data: profile }, areas] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
    loadAreaIndex(supabase, space.tripIds),
  ]);

  const avatarUrl = await signPhotoPath(supabase, profile?.profile_image_url);

  return (
    <>
      <TopHeader title="マイページ" />
      <PageBody>
        <section className="rough-card flex items-center gap-4 p-5">
          <span className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-paper-deep">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-ink-faint">
                <IconUser size={28} />
              </span>
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-bold">{user.displayName}</p>
            <p className="truncate text-xs text-ink-faint">{user.email}</p>
            {profile?.introduction ? (
              <p className="mt-1 line-clamp-2 text-xs text-ink-soft">{profile.introduction}</p>
            ) : null}
          </div>
        </section>

        <section className="rough-card flex items-center justify-around px-4 py-4 text-center">
          <div>
            <p className="text-2xl leading-none font-bold tabular-nums">{areas.totals.visitedPrefectures}</p>
            <p className="mt-1 text-xs text-ink-soft">都道府県</p>
          </div>
          <div className="h-8 w-px bg-line" />
          <div>
            <p className="text-2xl leading-none font-bold tabular-nums">{areas.totals.visitedMunicipalities}</p>
            <p className="mt-1 text-xs text-ink-soft">市区町村</p>
          </div>
          <div className="h-8 w-px bg-line" />
          <div>
            <p className="text-2xl leading-none font-bold tabular-nums">{areas.totals.visits}</p>
            <p className="mt-1 text-xs text-ink-soft">訪問記録</p>
          </div>
        </section>

        <nav>
          <ul className="rough-card divide-y divide-line overflow-hidden">
            <MenuItem href="/mypage/favorites" icon={<IconHeart size={20} />} label="お気に入り" />
            <MenuItem href="/mypage/wishlist" icon={<IconFlag size={20} />} label="また行きたい場所" />
            <MenuItem href="/records?tab=trips" icon={<IconCalendar size={20} />} label="旅行の計画" />
          </ul>
        </nav>

        <nav>
          <p className="mb-2 px-1 text-xs font-semibold text-ink-faint">設定</p>
          <ul className="rough-card divide-y divide-line overflow-hidden">
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
