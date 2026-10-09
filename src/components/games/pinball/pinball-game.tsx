"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { RedCoinArt } from "@/components/coin-art";
import type { PinballStageInfo } from "@/lib/data/pinball";
import { RARITY_STYLES } from "@/lib/gacha/config";
import { STAMP_COUNT } from "@/lib/games/pinball/config";
import { DEFAULT_MAP_ID, resolvePinballMapId } from "@/lib/games/pinball/maps";
import { emptyStage, ownedPinballParts, type PinballPartId, type StageSpec } from "@/lib/games/pinball/stage";
import type { PinballLobby } from "@/lib/games/pinball/tables";
import { getPinballTheme, stageTheme } from "@/lib/games/pinball/themes";
import { PinballMapPreview } from "./pinball-map-preview";
import { PinballPartsShop } from "./pinball-parts-shop";
import { courseKey, PinballPlay, type PinballCourse, type PinballResult } from "./pinball-play";
import { PINBALL_RANKING_REFRESH_EVENT, PinballRanking } from "./pinball-ranking";
import { PinballStageEditor, type StageDraft } from "./pinball-stage-editor";
import { PinballStages } from "./pinball-stages";

type Props = {
  lobby: PinballLobby;
  /** 台（マップ）ごとの自分のベスト */
  bests: Record<string, number>;
  /** 赤コインの残高（仕組みがまだ無い環境では null） */
  redCoins: number | null;
  /** 自分のステージと、フレンドが公開したステージ（ステージの仕組みがまだ無い環境では null） */
  stages: PinballStageInfo[] | null;
  /** 買った部品の数（はじめから持っているぶんは入らない） */
  boughtParts: Record<string, number> | null;
};

function MapCard({ mapId, best, onPlay }: { mapId: string; best: number | null; onPlay: () => void }) {
  const theme = getPinballTheme(mapId);
  const style = {
    background: `linear-gradient(135deg, ${theme.colors.bg0}, ${theme.colors.bg1})`,
    borderColor: `${theme.colors.accent}55`,
  } as CSSProperties;
  return (
    <button type="button" onClick={onPlay} className="pressable relative block w-full overflow-hidden rounded-[26px] border p-3.5 text-left active:scale-[0.99]" style={style} aria-label={`${theme.name}で遊ぶ`}>
      <span aria-hidden="true" className="absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-30 blur-2xl" style={{ background: theme.colors.accent }} />
      <span className="relative flex gap-3">
        <span className="flex h-[132px] w-[70px] shrink-0 items-center justify-center rounded-[16px] border border-white/10 bg-black/30 p-1">
          <PinballMapPreview mapId={mapId} theme={theme} className="h-full w-full" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-center gap-1.5">
            <span className="rounded-full px-2 py-0.5 text-[9px] font-black text-black" style={{ background: theme.colors.accent }}>
              {theme.title}
            </span>
            <span className="text-[10px] font-black tracking-[0.05em] text-white/70" aria-label={`むずかしさ ${theme.difficulty}`}>
              {"★".repeat(theme.difficulty)}
              <span className="text-white/25">{"★".repeat(3 - theme.difficulty)}</span>
            </span>
          </span>
          <span className="mt-1 block text-[19px] font-black leading-tight text-white">{theme.name}</span>
          <span className="mt-1.5 flex flex-wrap gap-1">
            {theme.features.map((f) => (
              <span key={f} className="rounded-full border border-white/15 bg-black/25 px-2 py-0.5 text-[10px] font-black" style={{ color: theme.colors.accent }}>
                {f}
              </span>
            ))}
          </span>
          <span className="mt-1.5 block text-[11px] font-bold leading-relaxed text-white/70">{theme.lead}</span>
          <span className="mt-auto flex items-center justify-between pt-1.5">
            <span className="text-[10px] font-black tabular-nums text-white/70">{best !== null ? `ベスト ${best.toLocaleString("ja-JP")}` : "まだ遊んでいません"}</span>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg font-black text-black" style={{ background: theme.colors.accent }}>
              ›
            </span>
          </span>
        </span>
      </span>
    </button>
  );
}

export function PinballGame({ lobby, bests: initialBests, redCoins: initialCoins, stages: initialStages, boughtParts: initialBought }: Props) {
  const router = useRouter();
  const [playing, setPlaying] = useState<PinballCourse | null>(null);
  const [runKey, setRunKey] = useState(0);
  const [bests, setBests] = useState(initialBests);
  const [redCoins, setRedCoins] = useState(initialCoins);
  const [stages, setStages] = useState(initialStages);
  const [bought, setBought] = useState(initialBought);
  const [editing, setEditing] = useState<StageDraft | null>(null);
  // エディターを開くたびに変える（保存して番号がついても、エディターを作りなおさない）
  const [editorKey, setEditorKey] = useState(0);
  const [testName, setTestName] = useState("テストプレイ");
  const [shopOpen, setShopOpen] = useState(false);

  // サーバーから新しい一覧が来たら（保存・削除のあと router.refresh したとき）、それにそろえる
  useEffect(() => setStages(initialStages), [initialStages]);
  useEffect(() => setBought(initialBought), [initialBought]);
  useEffect(() => setRedCoins(initialCoins), [initialCoins]);

  const owned = useMemo(() => ownedPinballParts(bought ?? {}), [bought]);
  const stageBests = useMemo(() => Object.fromEntries((stages ?? []).flatMap((s) => (s.myBest !== null ? [[`stage:${s.id}`, s.myBest]] : []))), [stages]);
  const theme = useMemo(() => {
    if (!playing) return null;
    if (playing.type === "map") return getPinballTheme(playing.id);
    const stage = stages?.find((s) => s.id === playing.id);
    return stageTheme(playing.spec.look, playing.test ? testName : stage?.name ?? "ステージ");
  }, [playing, stages, testName]);
  // ランキングに出す台の名前（前の「県の台」の記録は、同じ形のいつもの台として出す）
  const tableName = useCallback((id: string) => getPinballTheme(resolvePinballMapId(id) ?? id).name, []);

  const onRecorded = useCallback((key: string, result: PinballResult) => {
    if (key.startsWith("stage:")) {
      const id = key.slice(6);
      setStages((prev) => prev?.map((s) => (s.id === id && result.score > (s.myBest ?? -1) ? { ...s, myBest: result.score, topScore: Math.max(s.topScore ?? 0, result.score) } : s)) ?? prev);
    } else {
      setBests((prev) => (result.score > (prev[key] ?? -1) ? { ...prev, [key]: result.score } : prev));
      window.dispatchEvent(new Event(PINBALL_RANKING_REFRESH_EVENT));
    }
    if (result.balance !== null) setRedCoins(result.balance);
  }, []);

  const play = (course: PinballCourse) => {
    setPlaying(course);
    setRunKey((k) => k + 1);
  };

  const playStage = (stage: PinballStageInfo) => {
    if (stage.spec) play({ type: "stage", id: stage.id, spec: stage.spec, test: false });
  };

  const onBought = useCallback((part: PinballPartId, total: number, balance: number | null) => {
    const info = ownedPinballParts({});
    // 持っている数（はじめのぶん＋買ったぶん）から、買ったぶんにもどす
    setBought((prev) => ({ ...(prev ?? {}), [part]: Math.max(0, total - info[part]) }));
    if (balance !== null) setRedCoins(balance);
  }, []);

  const afterSave = useCallback(
    (saved: StageDraft & { id: string }) => {
      setEditing(saved);
      setStages((prev) => {
        const list = prev ?? [];
        const existing = list.find((s) => s.id === saved.id);
        if (existing) return list.map((s) => (s.id === saved.id ? { ...s, name: saved.name, spec: saved.spec, shared: saved.shared, valid: true } : s));
        const added: PinballStageInfo = {
          id: saved.id,
          ownerId: "",
          ownerName: "",
          ownerAvatarUrl: null,
          name: saved.name,
          spec: saved.spec,
          valid: true,
          shared: saved.shared,
          updatedAt: new Date().toISOString(),
          isMine: true,
          myBest: null,
          topScore: null,
          topName: null,
          plays: 0,
        };
        return [added, ...list];
      });
      router.refresh();
    },
    [router],
  );

  const afterDelete = useCallback(
    (id: string) => {
      setEditing(null);
      setStages((prev) => prev?.filter((s) => s.id !== id) ?? prev);
      router.refresh();
    },
    [router],
  );

  const testPlay = useCallback((spec: StageSpec, name: string) => {
    setTestName(name);
    play({ type: "stage", id: null, spec, test: true });
  }, []);

  const openEditor = (draft: StageDraft) => {
    setEditorKey((k) => k + 1);
    setEditing(draft);
  };

  const best = playing ? (playing.type === "map" ? bests[playing.id] ?? null : playing.test ? null : stageBests[courseKey(playing)] ?? null) : null;

  return (
    <div className="min-h-dvh bg-[radial-gradient(120%_60%_at_50%_0%,#3a1418_0%,#0b0d14_55%,#07090e_100%)] pb-10 text-white">
      <header data-dark-header className="sticky top-0 z-20 flex items-center gap-3 border-b border-white/10 bg-[#0b0d14]/85 px-3 py-2 backdrop-blur" style={{ paddingTop: "max(8px, env(safe-area-inset-top))" }}>
        <Link href="/games" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-lg font-black active:scale-95" aria-label="ゲーム一覧へ戻る">
          ‹
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-[8px] font-black tracking-[0.18em] text-[#ff8a80]">GAME 05</p>
          <h1 className="truncate text-[16px] font-black">ご当地ピンボール</h1>
        </div>
        {redCoins !== null ? (
          <span className="flex shrink-0 items-center gap-1 rounded-full border border-[#ff8a80]/40 bg-[#3a1418] px-2.5 py-1" aria-label={`赤コイン ${redCoins.toLocaleString("ja-JP")}枚`}>
            <RedCoinArt className="h-[18px] w-[18px]" />
            <span className="text-[13px] font-black tabular-nums text-[#ffd3cd]">{redCoins.toLocaleString("ja-JP")}</span>
          </span>
        ) : null}
      </header>

      <main className="mx-auto max-w-[480px] space-y-4 px-4 pt-4">
        <section className="relative overflow-hidden rounded-[28px] border border-[#ff8a80]/25 bg-[linear-gradient(135deg,#2a1116,#121521)] p-5">
          <span aria-hidden="true" className="absolute -right-6 -top-8 h-28 w-28 rounded-full bg-[#ff6b6b]/25 blur-2xl" />
          <p className="relative text-[10px] font-black tracking-[0.1em] text-[#ff8a80]">はじいて、集めて、制覇！</p>
          <p className="relative mt-1 text-[22px] font-black leading-tight">ご当地アイテムの台で遊ぼう</p>
          <p className="relative mt-2 text-[11px] font-bold leading-relaxed text-white/70">
            台に浮かぶご当地アイテムにボールを当てて集めると、その場でスキルが発動。どれでも{STAMP_COUNT}つ集めると「制覇！」でマルチボール。台はマップごとに形がちがいます。3球で終わり、スコアに応じて赤コインがもらえます（赤コインで部品を買うと、自分のステージも作れます）。
          </p>
          <div className="relative mt-3 grid grid-cols-3 gap-2 text-center">
            {[
              ["左右をタップ", "フリッパー"],
              ["右下を引いて離す", "打ち出し"],
              ["3球", "1ゲーム"],
            ].map(([a, b]) => (
              <span key={a} className="rounded-2xl border border-white/10 bg-black/25 px-1.5 py-2">
                <span className="block text-[11px] font-black">{a}</span>
                <span className="block text-[9px] font-bold text-white/55">{b}</span>
              </span>
            ))}
          </div>
          <div className="relative mt-3 rounded-2xl border border-white/10 bg-black/25 p-3">
            <p className="flex items-center justify-between gap-2 text-[11px] font-black">
              <span>台に出るご当地アイテム</span>
              <span className="tabular-nums text-white/75">
                {lobby.ownedCount} / {lobby.totalCount}種
              </span>
            </p>
            <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-white/10">
              <span className="block h-full rounded-full bg-[#ffd166]" style={{ width: `${lobby.totalCount ? (lobby.ownedCount / lobby.totalCount) * 100 : 0}%` }} />
            </span>
            {lobby.preview.length ? (
              <span className="mt-2 flex items-center gap-1.5">
                {lobby.preview.map((item) => (
                  <span key={item.id} className="relative h-9 w-9 overflow-hidden rounded-full border border-white/20 bg-white/90" title={item.name}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.image} alt="" className="h-full w-full object-cover" />
                    <span className={`absolute bottom-0 left-0 right-0 text-center text-[7px] font-black leading-[10px] ${RARITY_STYLES[item.rarity].badge}`}>{item.rarity}</span>
                  </span>
                ))}
                {lobby.ownedCount > lobby.preview.length ? <span className="text-[10px] font-black text-white/60">ほか{lobby.ownedCount - lobby.preview.length}種</span> : null}
              </span>
            ) : null}
            <p className="mt-2 text-[10px] font-bold leading-relaxed text-white/60">
              {lobby.ownedCount > 0
                ? <>持っているアイテムは、どの県のものも全部どのマップにも出ます。<b className="text-[#ffe08a]">図鑑ボーナス ×{lobby.zukan.toFixed(2)}</b>（すべての得点）</>
                : <>都道府県ガチャでご当地アイテムを当てると、台に出てきてスキルが使えます（いまは ？カプセルが出ます）。</>}
            </p>
          </div>
        </section>

        <section className="space-y-3" aria-label="マップをえらぶ">
          <div className="flex items-end justify-between px-1">
            <h2 className="text-[15px] font-black">マップをえらぶ</h2>
            <span className="text-[10px] font-bold text-white/55">{lobby.maps.length}つのマップ</span>
          </div>
          {lobby.maps.map((id) => (
            <MapCard
              key={id}
              mapId={id}
              best={bests[id] ?? null}
              onPlay={() => play({ type: "map", id })}
            />
          ))}
        </section>

        {stages !== null ? (
          <PinballStages
            stages={stages}
            redCoins={redCoins}
            onPlay={playStage}
            onEdit={(stage) => stage.spec && openEditor({ id: stage.id, name: stage.name, spec: stage.spec, shared: stage.shared })}
            onCreate={() => openEditor({ id: null, name: "わたしのステージ", spec: emptyStage(), shared: true })}
            onOpenShop={() => setShopOpen(true)}
          />
        ) : null}

        <Link href="/games/pinball/guide" className="flex items-center gap-3 rounded-[22px] border border-white/10 bg-white/[0.04] p-4 active:scale-[0.99]">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#ff6b6b]/20 text-lg">📖</span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-black">ルールとスキルを見る</span>
            <span className="mt-0.5 block text-[11px] font-bold text-white/55">マップのしかけ・得点・アイテムごとのスキル</span>
          </span>
          <span className="text-white/40">›</span>
        </Link>

        <PinballRanking tableName={tableName} />
      </main>

      {editing ? (
        <PinballStageEditor
          key={editorKey}
          draft={editing}
          suspended={playing !== null || shopOpen}
          lobby={lobby}
          owned={owned}
          redCoins={redCoins}
          onClose={() => setEditing(null)}
          onSaved={afterSave}
          onDeleted={afterDelete}
          onTestPlay={testPlay}
          onOpenShop={() => setShopOpen(true)}
        />
      ) : null}

      {shopOpen ? (
        <PinballPartsShop
          theme={getPinballTheme(DEFAULT_MAP_ID)}
          bumperItem={lobby.bumperItems[0] ?? null}
          owned={owned}
          redCoins={redCoins}
          onClose={() => setShopOpen(false)}
          onBought={onBought}
        />
      ) : null}

      {playing && theme ? (
        <PinballPlay
          key={runKey}
          course={playing}
          lobby={lobby}
          theme={theme}
          best={best}
          onExit={() => setPlaying(null)}
          onRestart={() => setRunKey((k) => k + 1)}
          onRecorded={onRecorded}
        />
      ) : null}
    </div>
  );
}
