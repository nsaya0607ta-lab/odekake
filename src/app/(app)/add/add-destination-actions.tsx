"use client";

import Link from "next/link";
import { useState } from "react";
import { IconChevronRight, IconFlag, IconMapPin, IconNotebook } from "@/components/icons";
import { RecordDestinationPicker, type RecordDestinationValue } from "@/components/record-destination-picker";
import type { RecordDestinationHierarchy } from "@/lib/data/trips";

type RecentSpot = {
  spotId: string;
  spotName: string;
  categoryName: string | null;
  municipalityName: string | null;
};

export function AddDestinationActions({ destinations, recentSpots }: { destinations: RecordDestinationHierarchy; recentSpots: RecentSpot[] }) {
  const [value, setValue] = useState<RecordDestinationValue>({
    tripId: destinations.personal?.id ?? destinations.shared[0]?.id ?? "",
    journeyId: "",
  });
  const query = new URLSearchParams();
  if (value.tripId) query.set("trip", value.tripId);
  if (value.journeyId) query.set("journey", value.journeyId);
  const suffix = query.toString() ? `?${query}` : "";
  const recordParams = new URLSearchParams({ tab: "spots" });
  if (value.tripId) recordParams.set("recordTrip", value.tripId);
  if (value.journeyId) recordParams.set("recordJourney", value.journeyId);

  return (
    <>
      <RecordDestinationPicker destinations={destinations} onChange={setValue} />
      <ul className="space-y-3">
        <li><AddLink href={`/spots/new${suffix}`} icon={<IconMapPin size={24} />} title="行った場所を登録" description="新しい場所と訪問記録を追加します" tone="sky" /></li>
        <li><AddLink href={`/records?${recordParams}`} icon={<IconNotebook size={24} />} title="登録済みの場所に記録" description="以前登録した場所へ訪問記録を追加します" tone="sun" /></li>
        <li><AddLink href={`/trips/new?parent=${value.tripId}`} icon={<IconFlag size={24} />} title="旅行の計画を立てる" description="今選んでいる個人旅・共有旅の中に旅行を作ります" tone="leaf" /></li>
      </ul>
      {recentSpots.length > 0 ? (
        <section>
          <h2 className="mb-2 px-1 text-base font-bold">最近の場所へもう一度行った</h2>
          <ul className="space-y-2">
            {recentSpots.map((item) => (
              <li key={item.spotId}>
                <Link
                  href={`/visits/new?spot=${item.spotId}&${query}`}
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
    </>
  );
}

function AddLink({ href, icon, title, description, tone }: { href: string; icon: React.ReactNode; title: string; description: string; tone: "leaf" | "sky" | "sun" }) {
  const toneClass = { leaf: "bg-leaf-soft text-leaf-deep", sky: "bg-sky-soft text-[#42718f]", sun: "bg-sun-soft text-[#8a6a28]" }[tone];
  return <Link href={href} className="rough-card flex items-center gap-4 px-4 py-4 transition-transform active:scale-[0.99]">
    <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${toneClass}`}>{icon}</span>
    <span className="min-w-0 flex-1"><span className="block font-bold">{title}</span><span className="mt-0.5 block text-xs text-ink-soft">{description}</span></span>
    <IconChevronRight size={18} className="shrink-0 text-ink-faint" />
  </Link>;
}
