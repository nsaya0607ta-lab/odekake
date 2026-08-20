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
export function SnsGroupSwitcher({ groups, activeGroupId }: { groups: FriendGroupRow[]; activeGroupId?: string }) {
  const router = useRouter();
  const [order, setOrder] = useState(groups);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const itemRefs = useRef(new Map<string, HTMLDivElement>());
  const prevOffsetsRef = useRef(new Map<string, number>());
  const dragStartOffsetRef = useRef(0);
  const dragDxRef = useRef(0);
  const dragState = useRef<{
    startX: number;
    longPressTimer: ReturnType<typeof setTimeout> | null;
    moved: boolean;
  } | null>(null);

  useLayoutEffect(() => setOrder(groups), [groups]);

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
      void reorderFriendGroupsAction(ids);
    } else if (state && !state.moved) {
      router.push(`/sns/groups/${id}`);
    }
    dragState.current = null;
  }

  return (
    <div className="-mx-4 flex items-center gap-3 overflow-x-auto bg-white px-4 py-1.5" style={{ scrollbarWidth: "none" }}>
      {order.map((group, index) => (
        <div key={group.id} className="flex shrink-0 items-center gap-3">
          {index === 1 ? <span aria-hidden className="h-10 w-px shrink-0 bg-line-strong" /> : null}
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
              label={group.name}
              active={activeGroupId === group.id}
              unread={group.has_unread}
              dragging={draggingId === group.id}
            />
          </div>
        </div>
      ))}
      <Link href="/sns/groups/new" aria-label="グループを作る" className="flex shrink-0 flex-col items-center gap-1">
        <span className="tap-target flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-line text-ink-faint active:bg-paper-deep">
          <IconPlus size={20} />
        </span>
        <span className="max-w-[3.5rem] truncate text-[10px] text-ink-faint">追加</span>
      </Link>
    </div>
  );
}

function GroupIcon({
  icon,
  label,
  active,
  unread,
  dragging,
}: {
  icon: string;
  label: string;
  active: boolean;
  unread?: boolean;
  dragging?: boolean;
}) {
  return (
    <div className={`flex select-none flex-col items-center gap-1 transition-transform ${dragging ? "scale-105" : ""}`}>
      <span className="relative">
        <span
          className={`tap-target flex h-14 w-14 items-center justify-center rounded-full border-2 text-2xl transition-colors ${
            active ? "border-leaf bg-leaf-soft" : "border-line bg-card"
          } ${dragging ? "shadow-md" : ""}`}
        >
          {icon}
        </span>
        {unread ? (
          <span className="absolute top-0 right-0 h-3 w-3 rounded-full bg-[#4a90d9] ring-2 ring-paper" />
        ) : null}
      </span>
      <span className={`max-w-[3.5rem] truncate text-[10px] font-semibold ${active ? "text-leaf-deep" : "text-ink-soft"}`}>
        {label}
      </span>
    </div>
  );
}
