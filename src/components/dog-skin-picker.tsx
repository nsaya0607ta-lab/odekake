"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { DOG_SKINS, getFrenchieSrc, isSkinUnlocked, type DogSkinId } from "@/lib/dog-skins";
import { IconCheck, IconLock } from "./icons";

type Props = {
  currentSkin: DogSkinId;
  /** 図鑑の所持アイテムid一覧。Set はサーバー→クライアントの境界をまたがせず、配列で渡す */
  ownedItemIds: readonly string[];
};

export function DogSkinPicker({ currentSkin, ownedItemIds }: Props) {
  const router = useRouter();
  const owned = new Set(ownedItemIds);
  const [selected, setSelected] = useState<DogSkinId>(currentSkin);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  const choose = useCallback(
    async (skinId: DogSkinId) => {
      if (skinId === selected || pending) return;
      const previous = selected;
      setSelected(skinId);
      setPending(true);
      setError(false);

      try {
        const response = await fetch("/api/dog-skin", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ skinId }),
        });
        if (!response.ok) throw new Error();
        // ホーム・コイン画面などの犬は選択中スキンをサーバー側から読むので、
        // 表示をそこに揃えるには他の画面へ戻ったときの再取得が要る
        router.refresh();
      } catch {
        setSelected(previous);
        setError(true);
      } finally {
        setPending(false);
      }
    },
    [selected, pending, router],
  );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {DOG_SKINS.map((skin) => {
          const unlocked = isSkinUnlocked(skin, owned);
          const active = skin.id === selected;
          return (
            <button
              key={skin.id}
              type="button"
              disabled={!unlocked || pending}
              onClick={() => choose(skin.id)}
              aria-pressed={active}
              aria-label={unlocked ? skin.name : "シークレット（未所持）"}
              className={`rough-card overflow-hidden p-3 text-left transition ${
                active ? "border-leaf ring-2 ring-leaf/40" : unlocked ? "active:bg-paper-deep" : "border-ink-faint/30"
              }`}
            >
              <span className={`relative block aspect-square overflow-hidden rounded-xl ${unlocked ? "bg-paper-deep" : "bg-stone-200"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getFrenchieSrc(skin.id, "stand-happy")}
                  alt=""
                  draggable={false}
                  className={`h-full w-full object-contain p-3 ${
                    unlocked ? "" : "grayscale brightness-75 contrast-125 opacity-80"
                  }`}
                />
                {!unlocked ? (
                  <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-gradient-to-b from-transparent via-paper/10 to-ink/15">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink/70 text-white shadow-sm">
                      <IconLock size={17} />
                    </span>
                    <span className="rounded-full bg-ink/70 px-2 py-0.5 text-[9px] font-bold tracking-wider text-white">
                      シークレット
                    </span>
                  </span>
                ) : null}
                {active ? (
                  <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-leaf text-white shadow-sm">
                    <IconCheck size={14} />
                  </span>
                ) : null}
              </span>

              <p className={`mt-2 truncate text-sm font-bold ${unlocked ? "text-ink" : "text-ink-faint"}`}>
                {unlocked ? skin.name : "シークレット"}
              </p>
              <p className="mt-0.5 truncate text-[10px] text-ink-faint">
                {unlocked ? skin.description : "ガチャで手に入れると解放"}
              </p>
            </button>
          );
        })}
      </div>

      {error ? (
        <p className="text-center text-[11px] text-blossom">変更できませんでした。もう一度お試しください。</p>
      ) : null}
    </div>
  );
}
