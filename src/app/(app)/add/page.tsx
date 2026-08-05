import Link from "next/link";
import { IconChevronRight, IconFlag, IconMapPin, IconNotebook, IconUsers } from "@/components/icons";
import { PageBody } from "@/components/page-body";
import { TopHeader } from "@/components/page-header";
import { getTripOptions } from "@/lib/data/trips";
import { getAllSpots } from "@/lib/data/spots";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "追加 | おでかけ記録" };
export const dynamic = "force-dynamic";

export default async function AddPage() {
  const { supabase } = await requireUser();
  const [trips, spots] = await Promise.all([getTripOptions(supabase), getAllSpots(supabase)]);

  const recentSpots = spots.slice(0, 5);

  return (
    <>
      <TopHeader title="追加" />
      <PageBody>
        <ul className="space-y-3">
          <li>
            <AddCard
              href="/trips/new"
              icon={<IconFlag size={24} />}
              title="新しい旅行"
              description="一人旅または共有旅をつくります"
              tone="leaf"
            />
          </li>
          <li>
            <AddCard
              href="/spots/new"
              icon={<IconMapPin size={24} />}
              title="新しいスポット"
              description="訪れた場所を登録します"
              tone="sky"
            />
          </li>
          <li>
            <AddCard
              href="/records?tab=spots"
              icon={<IconNotebook size={24} />}
              title="新しい訪問履歴"
              description="登録済みのスポットを選んで記録します"
              tone="sun"
            />
          </li>
          <li>
            <AddCard
              href="/invitations"
              icon={<IconUsers size={24} />}
              title="共有旅に参加"
              description="招待コードを入力して参加します"
              tone="blossom"
            />
          </li>
        </ul>

        {recentSpots.length > 0 ? (
          <section>
            <h2 className="mb-2 px-1 text-base font-bold">最近のスポットに記録する</h2>
            <ul className="space-y-2">
              {recentSpots.map((spot) => (
                <li key={spot.id}>
                  <Link
                    href={`/visits/new?spot=${spot.id}`}
                    className="rough-card flex items-center gap-3 px-4 py-3 transition-transform active:scale-[0.99]"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{spot.name}</span>
                      <span className="text-xs text-ink-soft">{spot.categoryName ?? "カテゴリー未設定"}</span>
                    </span>
                    <IconChevronRight size={18} className="shrink-0 text-ink-faint" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {trips.length === 0 ? (
          <p className="rounded-2xl bg-paper-deep px-4 py-3 text-xs leading-relaxed text-ink-soft">
            訪問履歴はどの旅行の記録かを選んで保存します。まずは旅行をひとつ作成してください。
          </p>
        ) : null}
      </PageBody>
    </>
  );
}

function AddCard({
  href,
  icon,
  title,
  description,
  tone,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  tone: "leaf" | "sky" | "sun" | "blossom";
}) {
  const toneClass = {
    leaf: "bg-leaf-soft text-leaf-deep",
    sky: "bg-sky-soft text-[#42718f]",
    sun: "bg-sun-soft text-[#8a6a28]",
    blossom: "bg-blossom-soft text-[#95505e]",
  }[tone];

  return (
    <Link
      href={href}
      className="rough-card flex items-center gap-4 px-4 py-4 transition-transform active:scale-[0.99]"
    >
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${toneClass}`}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-bold">{title}</span>
        <span className="mt-0.5 block text-xs text-ink-soft">{description}</span>
      </span>
      <IconChevronRight size={18} className="shrink-0 text-ink-faint" />
    </Link>
  );
}
