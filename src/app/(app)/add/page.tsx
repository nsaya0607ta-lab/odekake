import Link from "next/link";
import { IconChevronRight, IconFlag, IconMapPin, IconNotebook, IconUsers } from "@/components/icons";
import { PageBody } from "@/components/page-body";
import { TopHeader } from "@/components/page-header";
import { getTimeline } from "@/lib/data/visits";
import { resolveWorkspace } from "@/lib/data/workspace";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "追加 | おでかけ記録" };
export const dynamic = "force-dynamic";

export default async function AddPage() {
  const { supabase, user } = await requireUser();
  const workspace = await resolveWorkspace(supabase, user.id);

  // 最近の訪問履歴から場所を拾う。スポットを全件読んでから絞るより軽く、
  // 「最近行った順」も正しく出る。
  const recent = await getTimeline(supabase, { tripIds: workspace.tripIds, limit: 20 });
  const recentSpots = [...new Map(recent.map((item) => [item.spotId, item])).values()].slice(0, 5);
  const isShared = workspace.kind === "trip";

  return (
    <>
      <TopHeader title="追加" />
      <PageBody>
        <p
          className={`rounded-2xl px-4 py-3 text-xs leading-relaxed ${
            isShared ? "bg-sky-soft text-[#42718f]" : "bg-blossom-soft text-[#95505e]"
          }`}
        >
          {isShared
            ? `現在は「${workspace.name}」の共有旅画面です。この画面で追加した内容は共有旅の記録として扱われます。`
            : "現在は自分の旅の画面です。普段のおでかけや、一人で行った場所を記録できます。"}
        </p>

        <ul className="space-y-3">
          <li>
            <AddCard
              href="/spots/new"
              icon={<IconMapPin size={24} />}
              title="行った場所を登録"
              description={
                isShared
                  ? "場所・訪問日・感想・写真を、この共有旅へまとめて登録します"
                  : "場所・訪問日・感想・写真を、まとめて登録します"
              }
              tone="sky"
            />
          </li>
          <li>
            <AddCard
              href="/records?tab=spots"
              icon={<IconNotebook size={24} />}
              title="登録済みの場所に記録"
              description={
                isShared
                  ? "この共有旅で以前訪れた場所へ、再訪の記録を追加します"
                  : "以前訪れた場所へ、もう一度行った記録を追加します"
              }
              tone="sun"
            />
          </li>
          {isShared ? (
            <li>
              <AddCard
                href="/invitations"
                icon={<IconUsers size={24} />}
                title="別の共有旅に参加"
                description="招待コードを入力して共有旅に参加します"
                tone="blossom"
              />
            </li>
          ) : null}
          <li>
            <AddCard
              href={isShared ? "/trips/new/shared" : "/trips/new/personal"}
              icon={isShared ? <IconUsers size={24} /> : <IconFlag size={24} />}
              title={isShared ? "新しい共有旅" : "旅行の計画を立てる"}
              description={
                isShared
                  ? "メンバーと記録を共有する、新しい旅行をつくります"
                  : "日程や表紙を決めて、訪問記録を旅行ごとにまとめます"
              }
              tone={isShared ? "sky" : "leaf"}
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
