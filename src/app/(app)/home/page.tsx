import Link from "next/link";
import {
  IconCalendar,
  IconChevronRight,
  IconHome,
  IconMapPin,
  IconNotebook,
  IconPlus,
} from "@/components/icons";
import { TopHeader } from "@/components/page-header";
import { PageBody } from "@/components/page-body";
import { EmptyState, LinkRow, formatDate } from "@/components/ui";
import { WanderingFrenchie } from "@/components/wandering-frenchie";
import { loadAreaIndex } from "@/lib/data/areas";
import { formatTripPeriod, getTripSummaries, type TripSummary } from "@/lib/data/trips";
import { getTimeline } from "@/lib/data/visits";
import { getRecordSpace } from "@/lib/data/space";
import { MUNICIPALITIES, PREFECTURES } from "@/lib/geo";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "あなたの旅 | おでかけ記録" };
export const dynamic = "force-dynamic";

const LEVEL_THRESHOLDS = [
  0,
  100,
  220,
  360,
  520,
  700,
  900,
  1120,
  1360,
  1620,
  1900,
  2200,
  2520,
  2860,
  3220,
  3600,
  4000,
  4420,
  4860,
  5320,
  5800,
  6300,
  6820,
  7360,
  7920,
  8500,
  9100,
  9720,
  10360,
  11020,
] as const;

const LEVEL_REWARDS = [
  "基本スタート",
  "伸びをする",
  "首輪（グリーン）",
  "表情：にっこり",
  "バンダナ（レッド）",
  "おもちゃ：ボール",
  "顔をかく",
  "表情：眠そう",
  "帽子（キャップ）",
  "ごろん",
  "首輪（ブラウン）",
  "小さなクッション",
  "首をかしげる",
  "表情：わくわく",
  "旅リュック",
  "観葉植物",
  "飼い主を見る",
  "表情：ドヤ顔",
  "称号：旅なれフレブル",
  "写真スポットでポーズ",
  "犬用ベッド",
  "走る",
  "帽子（ハット）",
  "表情：てへぺろ",
  "穴を掘る",
  "写真立て",
  "バンダナ（ネイビー）",
  "ぴょん",
  "称号：おでかけマスター",
  "特別コーデセット",
] as const;

export default async function HomePage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const [{ supabase, user }, { notice }] = await Promise.all([requireUser(), searchParams]);
  const space = await getRecordSpace(supabase, user.id);

  const [areas, recent, trips] = await Promise.all([
    loadAreaIndex(supabase, space.tripIds),
    getTimeline(supabase, { tripIds: space.tripIds, limit: 4 }),
    getTripSummaries(supabase),
  ]);

  const latest = recent[0] ?? null;
  const adventure = getAdventureProgress({
    visits: areas.totals.visits,
    spots: areas.totals.spots,
    municipalities: areas.totals.visitedMunicipalities,
    prefectures: areas.totals.visitedPrefectures,
  });

  return (
    <>
      <TopHeader title={space.name} />

      <PageBody>
        {notice === "password-updated" ? (
          <p className="rounded-2xl border border-leaf bg-leaf-soft px-4 py-3 text-sm text-leaf-deep">
            パスワードを変更しました。
          </p>
        ) : null}

        <div className="flex items-center justify-between gap-2 px-1">
          <p className="min-w-0 flex-1 truncate text-sm text-ink-soft">
            <span className="font-bold text-ink">{user.displayName}</span>
            さん、おでかけを記録しましょう
          </p>
          <Link
            href="/mypage/profile"
            className="shrink-0 rounded-full border border-line-strong bg-card px-3 py-1.5 text-xs font-semibold text-ink-soft"
          >
            名前を変える
          </Link>
        </div>

        <section className="rough-card overflow-hidden">
          <div className="relative h-44 overflow-hidden bg-leaf-soft">
            <div className="absolute inset-x-0 bottom-0 h-24 bg-[#eef3e5]" />
            <div className="absolute -left-14 bottom-[-42px] h-32 w-72 rounded-[50%] bg-[#e3ecd7]" />
            <div className="absolute right-[-42px] bottom-[-54px] h-36 w-80 rounded-[50%] bg-[#dce8cf]" />
            <div className="absolute left-[10%] top-6 h-4 w-10 rounded-full bg-white/55" />
            <div className="absolute left-[32%] top-10 h-3 w-8 rounded-full bg-white/45" />
            <div className="absolute right-12 top-5 h-10 w-10 rounded-full border border-[#d7b87d] bg-[#f8e7ca]" />
            <div className="absolute bottom-5 left-[8%] h-6 w-2 rounded-full bg-[#91aa75]" />
            <div className="absolute bottom-4 left-[7.2%] h-5 w-5 rounded-[50%] bg-[#b9cf9f]" />
            <div className="absolute bottom-7 right-[12%] h-8 w-2 rounded-full bg-[#91aa75]" />
            <div className="absolute bottom-6 right-[10.8%] h-6 w-6 rounded-[50%] bg-[#b9cf9f]" />

            <WanderingFrenchie />
            <AdventureLevelTag {...adventure} />
          </div>

          <div className="grid grid-cols-3 divide-x divide-line px-2 py-4 text-center">
            <DashboardStat
              icon={<IconMapPin size={18} />}
              value={areas.totals.visitedPrefectures}
              unit={`/ ${PREFECTURES.length}`}
              label="都道府県"
              tone="blossom"
            />
            <DashboardStat
              icon={<IconHome size={18} />}
              value={areas.totals.visitedMunicipalities}
              unit={`/ ${MUNICIPALITIES.length}`}
              label="市区町村など"
              tone="sky"
            />
            <DashboardStat
              icon={<IconNotebook size={18} />}
              value={areas.totals.visits}
              unit="回"
              label="訪問数"
              tone="leaf"
            />
          </div>
        </section>

        <div className="grid grid-cols-2 items-stretch gap-3">
          <section className="grid min-w-0 grid-rows-[40px_240px]">
            <div className="flex h-10 items-center justify-between gap-2 px-1">
              <h2 className="truncate text-base font-bold">最近の記録</h2>
              <Link href="/records" className="flex shrink-0 items-center gap-0.5 text-sm text-leaf-deep">
                すべて見る
                <IconChevronRight size={15} />
              </Link>
            </div>
            {latest ? (
              <Link
                href={`/spots/${latest.spotId}`}
                className="rough-card flex h-full min-h-0 flex-col justify-between overflow-hidden p-4 active:scale-[0.99]"
              >
                <div className="min-h-0">
                  <span className="mb-3 flex h-14 w-14 overflow-hidden rounded-2xl bg-paper-deep">
                    {latest.photoUrls[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={latest.photoUrls[0]} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-ink-faint">
                        <IconMapPin size={20} />
                      </span>
                    )}
                  </span>
                  <span className="block line-clamp-2 font-bold leading-snug">{latest.spotName}</span>
                  <span className="mt-1 block line-clamp-2 text-xs leading-relaxed text-ink-soft">
                    {latest.municipalityName}・{latest.tripTitle}
                  </span>
                </div>
                <span className="flex items-center justify-between gap-1 text-xs text-ink-faint">
                  <span className="flex min-w-0 items-center gap-1 truncate">
                    <IconCalendar size={13} />
                    {formatDate(latest.visitedAt)}
                  </span>
                  <IconChevronRight size={17} className="shrink-0" />
                </span>
              </Link>
            ) : (
              <div className="rough-card flex h-full min-h-0 flex-col items-center justify-center overflow-hidden px-4 text-center">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-paper-deep text-ink-faint">
                  <IconMapPin size={20} />
                </span>
                <p className="mt-3 text-sm font-bold">まだ記録がありません</p>
                <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-ink-soft">
                  訪れた場所を記録するとここに表示されます。
                </p>
                <Link
                  href="/add"
                  className="mt-4 shrink-0 rounded-full border border-leaf bg-leaf-soft px-4 py-2 text-xs font-semibold text-leaf-deep"
                >
                  記録を追加する
                </Link>
              </div>
            )}
          </section>

          <section className="grid min-w-0 grid-rows-[40px_240px]">
            <div className="flex h-10 items-center px-1">
              <h2 className="truncate text-base font-bold">今日の歩数</h2>
            </div>
            <div className="rough-card flex h-full min-h-0 flex-col items-center justify-center overflow-hidden bg-sun-soft/45 p-4 text-center">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-[#e8d4aa] bg-card text-2xl shadow-sm">
                👟
              </span>
              <p className="mt-3 whitespace-nowrap text-xs text-ink-soft">今日のおでかけ</p>
              <p className="mt-1 flex items-baseline justify-center gap-1 whitespace-nowrap text-ink">
                <span className="text-3xl font-bold tabular-nums">—</span>
                <span className="text-xs text-ink-soft">歩</span>
              </p>
              <p className="mt-3 whitespace-nowrap text-[10px] text-ink-faint">ヘルスケア連携前</p>
            </div>
          </section>
        </div>

        <TripSection
          trips={trips}
          emptyTitle="旅行計画はまだありません"
          emptyDescription="旅行としてまとめたい予定があるときだけ作成できます。"
        />
      </PageBody>
    </>
  );
}

function getAdventureProgress({
  visits,
  spots,
  municipalities,
  prefectures,
}: {
  visits: number;
  spots: number;
  municipalities: number;
  prefectures: number;
}) {
  // 現在DBに専用のEXP台帳がないため、すでに確実に集計できる訪問実績だけで暫定算出する。
  // 初スポットは50EXP相当、再訪は10EXP、市区町村は+60、都道府県は+150。
  // 写真・感想・評価・歩数のEXPは、専用台帳導入後にここへ統合する。
  const totalExp = visits * 10 + spots * 40 + municipalities * 60 + prefectures * 150;
  let level = 1;

  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i -= 1) {
    if (totalExp >= LEVEL_THRESHOLDS[i]) {
      level = i + 1;
      break;
    }
  }

  const currentThreshold = LEVEL_THRESHOLDS[level - 1];
  const nextThreshold = LEVEL_THRESHOLDS[Math.min(level, LEVEL_THRESHOLDS.length - 1)];
  const isMax = level >= LEVEL_THRESHOLDS.length;
  const progressSpan = Math.max(1, nextThreshold - currentThreshold);
  const progressValue = isMax ? progressSpan : Math.min(progressSpan, Math.max(0, totalExp - currentThreshold));
  const progressPercent = isMax ? 100 : Math.round((progressValue / progressSpan) * 100);

  return {
    level,
    totalExp,
    nextThreshold,
    progressPercent,
    nextReward: isMax ? "すべて解放済み" : LEVEL_REWARDS[level],
    isMax,
  };
}

function AdventureLevelTag({
  level,
  totalExp,
  nextThreshold,
  progressPercent,
  nextReward,
  isMax,
}: ReturnType<typeof getAdventureProgress>) {
  return (
    <div className="absolute right-3 top-3 z-20 w-[42%] min-w-[148px] max-w-[184px] rounded-[22px] border border-[#d8ccb4] bg-[#fffdf7]/95 px-3 py-3 shadow-[0_5px_16px_rgba(91,73,51,0.10)] backdrop-blur-[2px]">
      <p className="text-center text-[10px] font-semibold tracking-wide text-ink-soft">おでかけレベル</p>
      <div className="mt-0.5 flex items-end justify-center gap-1 leading-none">
        <span className="text-[10px] font-semibold text-leaf-deep">Lv.</span>
        <span className="text-4xl font-bold tabular-nums text-ink">{level}</span>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <span className="text-[9px] font-bold text-ink-soft">EXP</span>
        <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full border border-[#d8ccb4] bg-[#f1eee4]">
          <div
            className="h-full rounded-full bg-[#719457] transition-[width] duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
      <p className="mt-1 text-right text-[9px] tabular-nums text-ink-faint">
        {isMax ? `${totalExp} EXP` : `${totalExp} / ${nextThreshold}`}
      </p>

      <div className="mt-2 border-t border-dashed border-[#ddd1bd] pt-2">
        <p className="text-[8px] text-ink-faint">次に解放</p>
        <p className="mt-0.5 line-clamp-2 text-[10px] font-semibold leading-snug text-ink">{nextReward}</p>
      </div>
    </div>
  );
}

function TripSection({
  trips,
  emptyTitle,
  emptyDescription,
}: {
  trips: TripSummary[];
  emptyTitle: string;
  emptyDescription: string;
}) {
  const createHref = "/trips/new";

  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
        <h2 className="text-base font-bold">
          旅行
          {trips.length > 0 ? (
            <span className="ml-1.5 text-sm font-normal text-ink-faint tabular-nums">{trips.length}件</span>
          ) : null}
        </h2>
        <div className="flex items-center gap-3">
          <Link href={createHref} className="flex items-center gap-0.5 text-sm text-leaf-deep">
            <IconPlus size={15} />
            つくる
          </Link>
          {trips.length > 3 ? (
            <Link href="/records?tab=trips" className="flex items-center gap-0.5 text-sm text-leaf-deep">
              すべて見る
              <IconChevronRight size={15} />
            </Link>
          ) : null}
        </div>
      </div>
      {trips.length === 0 ? (
        <EmptyState
          title={emptyTitle}
          description={emptyDescription}
          actionHref={createHref}
          actionLabel="旅行の計画を立てる"
        />
      ) : (
        <ul className="space-y-2">
          {trips.slice(0, 3).map(({ trip, visitCount }) => (
            <li key={trip.id}>
              <LinkRow
                href={`/trips/${trip.id}`}
                title={trip.title}
                subtitle={[formatTripPeriod(trip), `${visitCount}件の記録`].filter(Boolean).join("・")}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function DashboardStat({
  icon,
  value,
  unit,
  label,
  tone,
}: {
  icon: React.ReactNode;
  value: number;
  unit?: string;
  label: string;
  tone: "blossom" | "sky" | "leaf";
}) {
  const toneClass = {
    blossom: "bg-blossom-soft text-[#95505e]",
    sky: "bg-sky-soft text-[#42718f]",
    leaf: "bg-leaf-soft text-leaf-deep",
  }[tone];

  return (
    <div className="flex min-w-0 flex-col items-center gap-1 px-1">
      <span className={`flex h-9 w-9 items-center justify-center rounded-full ${toneClass}`}>{icon}</span>
      <span className="mt-1 flex items-baseline gap-0.5">
        <span className="text-2xl leading-none font-bold tabular-nums">{value}</span>
        {unit ? <span className="text-[10px] text-ink-faint tabular-nums">{unit}</span> : null}
      </span>
      <span className="whitespace-nowrap text-[10px] leading-tight text-ink-soft">{label}</span>
    </div>
  );
}
