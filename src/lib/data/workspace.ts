import { cookies } from "next/headers";
import type { TripRow } from "@/lib/supabase/types";
import type { DB } from "./client";

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
  const currentId = await readWorkspaceId();

  const { data: tripRows } = await supabase
    .from("trips")
    .select("*")
    .order("start_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  const trips = (tripRows ?? []) as TripRow[];
  const soloTrips = trips.filter((t) => t.trip_type === "solo" && t.owner_id === userId);
  const sharedTrips = trips.filter((t) => t.trip_type === "shared");

  const tripIds = trips.map((t) => t.id);
  const [{ data: members }, { data: visits }] = await Promise.all([
    tripIds.length > 0
      ? supabase.from("trip_members").select("trip_id, user_id").in("trip_id", tripIds)
      : Promise.resolve({ data: [] as Array<{ trip_id: string; user_id: string }> }),
    tripIds.length > 0
      ? supabase.from("visit_records").select("id, trip_id").in("trip_id", tripIds)
      : Promise.resolve({ data: [] as Array<{ id: string; trip_id: string }> }),
  ]);

  const memberCount = new Map<string, number>();
  for (const m of members ?? []) memberCount.set(m.trip_id, (memberCount.get(m.trip_id) ?? 0) + 1);

  const visitCount = new Map<string, number>();
  for (const v of visits ?? []) visitCount.set(v.trip_id, (visitCount.get(v.trip_id) ?? 0) + 1);

  const soloIds = soloTrips.map((t) => t.id);
  const personal = personalWorkspace(soloIds);

  const summaries: WorkspaceSummary[] = [
    {
      ...personal,
      visitCount: soloIds.reduce((sum, id) => sum + (visitCount.get(id) ?? 0), 0),
      isCurrent: currentId === PERSONAL_WORKSPACE_ID || !sharedTrips.some((t) => t.id === currentId),
    },
    ...sharedTrips.map((trip) => ({
      ...tripWorkspace(trip, memberCount.get(trip.id) ?? 1),
      visitCount: visitCount.get(trip.id) ?? 0,
      isCurrent: currentId === trip.id,
    })),
  ];

  return summaries;
}

async function readWorkspaceId(): Promise<string> {
  const store = await cookies();
  return store.get(WORKSPACE_COOKIE)?.value ?? PERSONAL_WORKSPACE_ID;
}

/**
 * いま開いているワークスペースを求める。
 * Cookie の値が使えない（退出した・削除された）場合は自分の旅に戻す。
 */
export async function resolveWorkspace(supabase: DB, userId: string): Promise<Workspace> {
  const id = await readWorkspaceId();

  if (id !== PERSONAL_WORKSPACE_ID && /^[0-9a-f-]{36}$/i.test(id)) {
    const { data } = await supabase.from("trips").select("*").eq("id", id).maybeSingle();
    const trip = data as TripRow | null;
    // RLS で取得できた時点で参加している。一人旅はワークスペースにしない
    if (trip && trip.trip_type === "shared") {
      const { count } = await supabase
        .from("trip_members")
        .select("id", { count: "exact", head: true })
        .eq("trip_id", trip.id);
      return tripWorkspace(trip, count ?? 1);
    }
  }

  const { data: soloTrips } = await supabase
    .from("trips")
    .select("id")
    .eq("trip_type", "solo")
    .eq("owner_id", userId);

  return personalWorkspace((soloTrips ?? []).map((t) => t.id));
}
