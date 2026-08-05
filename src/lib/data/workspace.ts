import { cookies } from "next/headers";
import { cache } from "react";
import type { TripRow } from "@/lib/supabase/types";
import type { DB } from "./client";
import { getTripSummaries } from "./trips";

/**
 * 旅ワークスペース
 * =============================================================
 * アプリは「自分の旅」と、共有旅ごとの独立した空間に分かれている。
 * ホーム・地図・記録・スポットは、いま選んでいるワークスペースの
 * 記録だけを表示する（他のワークスペースの記録は合算しない）。
 *
 *   自分の旅   … 自分がつくった一人旅すべて
 *   共有旅①②③ … 参加している共有旅ひとつずつ
 *
 * どのワークスペースを開いているかは Cookie に持つ。URL は変えないので、
 * 既存の画面の作りをそのまま使える。
 */
export const WORKSPACE_COOKIE = "odekake-workspace";
export const PERSONAL_WORKSPACE_ID = "personal";

export type Workspace = {
  id: string;
  kind: "personal" | "trip";
  name: string;
  /** 共有旅の参加人数。自分の旅では 1 */
  memberCount: number;
  /** この空間に含まれる旅行。集計と一覧の絞り込みに使う */
  tripIds: string[];
  /** 共有旅のときだけ、その旅行 */
  trip: TripRow | null;
};

export type WorkspaceSummary = Workspace & {
  visitCount: number;
  isCurrent: boolean;
};

function personalWorkspace(soloTripIds: string[]): Workspace {
  return {
    id: PERSONAL_WORKSPACE_ID,
    kind: "personal",
    name: "自分の旅",
    memberCount: 1,
    tripIds: soloTripIds,
    trip: null,
  };
}

function tripWorkspace(trip: TripRow, memberCount: number): Workspace {
  return {
    id: trip.id,
    kind: "trip",
    name: trip.title,
    memberCount,
    tripIds: [trip.id],
    trip,
  };
}

/** 参加しているすべてのワークスペースを、切替画面のために取り出す */
export async function listWorkspaces(supabase: DB, userId: string): Promise<WorkspaceSummary[]> {
  const [currentId, tripSummaries] = await Promise.all([
    readWorkspaceId(),
    getTripSummaries(supabase, userId),
  ]);

  const soloTrips = tripSummaries.filter(
    ({ trip }) => trip.trip_type === "solo" && trip.owner_id === userId,
  );
  const sharedTrips = tripSummaries.filter(({ trip }) => trip.trip_type === "shared");
  const soloIds = soloTrips.map(({ trip }) => trip.id);
  const personal = personalWorkspace(soloIds);

  return [
    {
      ...personal,
      visitCount: soloTrips.reduce((sum, item) => sum + item.visitCount, 0),
      isCurrent:
        currentId === PERSONAL_WORKSPACE_ID || !sharedTrips.some(({ trip }) => trip.id === currentId),
    },
    ...sharedTrips.map(({ trip, memberCount, visitCount }) => ({
      ...tripWorkspace(trip, memberCount),
      visitCount,
      isCurrent: currentId === trip.id,
    })),
  ];
}

const readWorkspaceId = cache(async function readWorkspaceId(): Promise<string> {
  const store = await cookies();
  return store.get(WORKSPACE_COOKIE)?.value ?? PERSONAL_WORKSPACE_ID;
});

/**
 * いま開いているワークスペースを求める。
 * Cookie の値が使えない（退出した・削除された）場合は自分の旅に戻す。
 */
export async function resolveWorkspace(supabase: DB, userId: string): Promise<Workspace> {
  const id = await readWorkspaceId();

  if (id !== PERSONAL_WORKSPACE_ID && /^[0-9a-f-]{36}$/i.test(id)) {
    // 旅行本体と参加人数は互いに依存しないため同時に取得する。
    const [{ data }, { count }] = await Promise.all([
      supabase.from("trips").select("*").eq("id", id).maybeSingle(),
      supabase.from("trip_members").select("id", { count: "exact", head: true }).eq("trip_id", id),
    ]);
    const trip = data as TripRow | null;

    // RLS で取得できた時点で参加している。一人旅はワークスペースにしない
    if (trip && trip.trip_type === "shared") {
      return tripWorkspace(trip, count ?? 1);
    }
  }

  // 自分の旅では、ホームでも使う旅行一覧を共通キャッシュから取り出す。
  // resolveWorkspace と listWorkspaces が同じ旅行を二重取得しない。
  const summaries = await getTripSummaries(supabase, userId);
  const soloTripIds = summaries
    .filter(({ trip }) => trip.trip_type === "solo" && trip.owner_id === userId)
    .map(({ trip }) => trip.id);

  return personalWorkspace(soloTripIds);
}
