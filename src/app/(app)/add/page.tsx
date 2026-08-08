import Link from "next/link";
import { IconChevronRight, IconFlag, IconMapPin, IconNotebook } from "@/components/icons";
import { PageBody } from "@/components/page-body";
import { TopHeader } from "@/components/page-header";
import { getTimeline } from "@/lib/data/visits";
import { getRecordSpace } from "@/lib/data/space";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "追加 | おでかけ記録" };
export const dynamic = "force-dynamic";

export default async function AddPage() {
  const { supabase, user } = await requireUser();
  const space = await getRecordSpace(supabase, user.id);

  // 最近の訪問履歴から場所を拾う。スポットを全件読んでから絞るより軽く、
  // 「最近行った順」も正しく出る。
  const recent = await getTimeline(supabase, { tripIds: space.tripIds, limit: 20 });
  const recentSpots = [...new Map(recent.map((item) => [item.spotId, item])).values()].slice(0, 5);

  return (
    <>
      <TopHeader title="追加" />
      <PageBody>
        <p className="rounded-2xl bg-blossom-soft px-4 py-3 text-xs leading-relaxed text-[#95505e]">
          {`追加した内容は「${space.name}」の記録として保存されます。`}
        </p>

        <ul className="space-y-3">
          <li>
            <AddCard
              href="/spots/new"
              icon={<IconMapPin size={24} />}
              title="行った場所を登録"
              description="場所・訪問日・感想・写真を、まとめて登録します"
              tone="sky"
            />
          </li>
          <li>
            <AddCard
              href="/records?tab=spots"
              icon={<IconNotebook size={24} />}
              title="登録済みの場所に記録"
              description="以前訪れた場所へ、もう一度行った記録を追加します"
              tone="sun"
            />
          </li>
          <li>
            <AddCard
              href="/trips/new"
              icon={<IconFlag size={24} />}
              title="旅行の計画を立てる"
              description="日程や表紙を決めて、訪問記録を旅行ごとにまとめます"
              tone="leaf"
            />
          </li>
        </ul>

        {recentSpots.length > 0 ? (
          <section>
            <h2 className="mb-2 px-1 text-base font-bold">最近の場所へもう一度行った</h2>
            <ul className="space-y-2">
              {recentSpots.map((item) => (
                <li key={item.spotId}>
                  <Link
                    href={`/visits/new?spot=${item.spotId}`}
                    className="rough-card flex items-center gap-3 px-4 py-3 transition-transform active:scale-[0.99]"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{item.spotName}</span>
                      <span className="text-xs text-ink-soft">
                        {item.categoryName ?? item.municipalityName ?? "カテゴリー未設定"}
                      </span>
                    </span>
                    <IconChevronRight size={18} className="shrink-0 text-ink-faint" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
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
