"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
import { reorderFriendGroupsAction } from "@/app/actions/sns";
import { IconPlus } from "@/components/icons";
import type { FriendGroupRow } from "@/lib/supabase/types";

const LONG_PRESS_MS = 400;
const MOVE_CANCEL_PX = 8;
const SETTLE_TRANSITION = "transform 180ms cubic-bezier(0.2, 0, 0, 1)";

/** /sns/groups/[groupId] の上部に出す、グループアイコンの横スクロール切り替え。
 * 一番左が既定のグループ（区切り線で示す）。長押しでドラッグして並び替えできる。
 * ドラッグ中の本人は指に追従、他のアイコンは FLIP でなめらかに位置を譲る */
export function SnsGroupSwitcher({
  groups,
  activeGroupId,
  iconUrls = {},
}: {
  groups: FriendGroupRow[];
  activeGroupId?: string;
  iconUrls?: Record<string, string>;
}) {
  const router = useRouter();
  const [order, setOrder] = useState(groups);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState("");
  const committedOrderRef = useRef(groups);
  const itemRefs = useRef(new Map<string, HTMLDivElement>());
  const prevOffsetsRef = useRef(new Map<string, number>());
  const dragStartOffsetRef = useRef(0);
  const dragDxRef = useRef(0);
  const dragState = useRef<{
    startX: number;
    longPressTimer: ReturnType<typeof setTimeout> | null;
    moved: boolean;
  } | null>(null);

  useLayoutEffect(() => {
    setOrder(groups);
    committedOrderRef.current = groups;
  }, [groups]);

  function captureOffsets() {
    const map = new Map<string, number>();
    for (const [id, el] of itemRefs.current) map.set(id, el.offsetLeft);
    prevOffsetsRef.current = map;
  }

  // FLIP: 並び順が変わったら、直前の位置からの差分だけ逆方向にずらしておき、
  // 次のフレームで 0 に戻すことで「移動してくる」ように見せる
  useLayoutEffect(() => {
    for (const group of order) {
      const el = itemRefs.current.get(group.id);
      if (!el) continue;
      const prevLeft = prevOffsetsRef.current.get(group.id);
      if (prevLeft === undefined) continue;

      if (group.id === draggingId) {
        // ドラッグ中の本人は指の位置に固定し続ける（レイアウト変化を打ち消す）
        el.style.transition = "none";
        el.style.zIndex = "10";
        el.style.transform = `translateX(${dragStartOffsetRef.current - el.offsetLeft + dragDxRef.current}px)`;
        continue;
      }

      const delta = prevLeft - el.offsetLeft;
      if (delta === 0) continue;
      el.style.transition = "none";
      el.style.transform = `translateX(${delta}px)`;
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      el.offsetHeight; // reflow を強制してから戻すことでアニメーションさせる
      requestAnimationFrame(() => {
        el.style.transition = SETTLE_TRANSITION;
        el.style.transform = "translateX(0)";
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order]);

  function handlePointerDown(e: React.PointerEvent, id: string) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    // 全グループを一斉取得するとモバイル回線を圧迫するため、触れた1件だけ先読みする。
    router.prefetch(`/sns/groups/${id}`);
    dragState.current = { startX: e.clientX, longPressTimer: null, moved: false };
    const target = e.currentTarget;
    const timer = setTimeout(() => {
      if (dragState.current && !dragState.current.moved) {
        target.setPointerCapture(e.pointerId);
        const el = itemRefs.current.get(id);
        dragStartOffsetRef.current = el?.offsetLeft ?? 0;
        dragDxRef.current = 0;
        setDraggingId(id);
        if (navigator.vibrate) navigator.vibrate(8);
      }
    }, LONG_PRESS_MS);
    dragState.current.longPressTimer = timer;
  }

  function handlePointerMove(e: React.PointerEvent, id: string) {
    const state = dragState.current;
    if (!state) return;

    if (!draggingId) {
      if (Math.abs(e.clientX - state.startX) > MOVE_CANCEL_PX) {
        state.moved = true;
        if (state.longPressTimer) clearTimeout(state.longPressTimer);
      }
      return;
    }

    if (draggingId !== id) return;
    e.preventDefault();

    dragDxRef.current = e.clientX - state.startX;
    const el = itemRefs.current.get(id);
    if (el) {
      el.style.transition = "none";
      el.style.zIndex = "10";
      el.style.transform = `translateX(${dragStartOffsetRef.current - el.offsetLeft + dragDxRef.current}px)`;
    }

    const pointerX = e.clientX;
    const draggedIndex = order.findIndex((g) => g.id === draggingId);
    if (draggedIndex === -1) return;

    let targetIndex = draggedIndex;
    for (let i = 0; i < order.length; i++) {
      if (i === draggedIndex) continue;
      const candidate = order[i];
      if (!candidate) continue;
      const candidateEl = itemRefs.current.get(candidate.id);
      if (!candidateEl) continue;
      const rect = candidateEl.getBoundingClientRect();
      const mid = rect.left + rect.width / 2;
      if (i < draggedIndex && pointerX < mid) targetIndex = Math.min(targetIndex, i);
      if (i > draggedIndex && pointerX > mid) targetIndex = Math.max(targetIndex, i);
    }
    if (targetIndex === draggedIndex) return;

    captureOffsets();
    setOrder((prev) => {
      const from = prev.findIndex((g) => g.id === draggingId);
      if (from === -1) return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      if (!item) return prev;
      next.splice(targetIndex, 0, item);
      return next;
    });
  }

  function handlePointerUp(id: string) {
    const state = dragState.current;
    if (state?.longPressTimer) clearTimeout(state.longPressTimer);

    if (draggingId) {
      const el = itemRefs.current.get(draggingId);
      if (el) {
        el.style.transition = SETTLE_TRANSITION;
        el.style.transform = "translateX(0)";
        window.setTimeout(() => {
          el.style.zIndex = "";
        }, 200);
      }
      setDraggingId(null);
      const ids = order.map((g) => g.id);
      const previousOrder = committedOrderRef.current;
      void (async () => {
        try {
          const result = await reorderFriendGroupsAction(ids);
          if (!result.ok) {
            setOrder(previousOrder);
            setSaveMessage(result.error);
          } else {
            committedOrderRef.current = order;
            setSaveMessage("並び順を保存しました。");
          }
        } catch {
          setOrder(previousOrder);
          setSaveMessage("並び順を保存できませんでした。");
        }
        window.setTimeout(() => setSaveMessage(""), 2400);
      })();
    } else if (state && !state.moved) {
      navigator.vibrate?.(6);
      router.push(`/sns/groups/${id}`);
    }
    dragState.current = null;
  }

  return (
    <section className="sns-rail-panel sns-group-switcher-panel" aria-labelledby="sns-groups-title">
      <div className="mb-2 flex items-center justify-between gap-3 px-1">
        <h2 id="sns-groups-title" className="text-xs font-black text-ink-soft">グループを切り替える</h2>
        <p className="text-[9px] text-ink-faint">長押しで並び替え</p>
      </div>
      <div className="flex items-start gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {order.map((group) => (
          <div key={group.id} className="flex shrink-0 items-center gap-3">
            <div
              ref={(el) => {
                if (el) itemRefs.current.set(group.id, el);
                else itemRefs.current.delete(group.id);
              }}
              style={{ touchAction: "pan-x" }}
              onPointerDown={(e) => handlePointerDown(e, group.id)}
              onPointerMove={(e) => handlePointerMove(e, group.id)}
              onPointerUp={() => handlePointerUp(group.id)}
              onPointerCancel={() => handlePointerUp(group.id)}
            >
              <GroupIcon
                icon={group.icon}
                iconUrl={group.icon_path ? iconUrls[group.icon_path] : undefined}
                label={group.name}
                active={activeGroupId === group.id}
                unread={group.has_unread}
                dragging={draggingId === group.id}
              />
            </div>
          </div>
        ))}
        <Link
          href="/sns/groups/new"
          data-haptic="light"
          aria-label="グループを作る"
          className="flex w-14 shrink-0 flex-col items-center gap-1"
        >
          <span className="sns-new-group tap-target flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed text-ink-faint shadow-sm active:bg-paper-deep">
            <IconPlus size={20} />
          </span>
          <span className="max-w-[4rem] truncate text-[10px] font-bold text-ink-faint">新規作成</span>
        </Link>
      </div>
      {saveMessage ? <p className="sns-settings-inline-message mt-2" role="status">{saveMessage}</p> : null}
    </section>
  );
}

function GroupIcon({
  icon,
  iconUrl,
  label,
  active,
  unread,
  dragging,
}: {
  icon: string;
  iconUrl?: string;
  label: string;
  active: boolean;
  unread?: boolean;
  dragging?: boolean;
}) {
  return (
    <div className={`flex w-14 select-none flex-col items-center gap-1 transition-transform ${dragging ? "scale-105" : ""}`}>
      <span className="relative">
        <span
          className={`tap-target flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border-[3px] text-xl transition-colors ${
            active ? "sns-group-icon-active" : "border-card bg-card ring-1 ring-line"
          } ${dragging ? "shadow-md" : ""}`}
        >
          {iconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={iconUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
          ) : (
            icon
          )}
        </span>
        {unread ? (
          <span className="sns-unread-dot absolute top-0 right-0 h-3.5 w-3.5 rounded-full ring-[3px] ring-card" />
        ) : null}
      </span>
      <span className={`max-w-[4rem] truncate text-[10px] font-bold ${active ? "sns-group-label-active" : "text-ink-soft"}`}>
        {label}
      </span>
    </div>
  );
}
