"use client";

import { useEffect } from "react";

/**
 * Lane のラック再セット時に位置ロックが解除されても、
 * ユーザーが最初に OK した位置をゲーム中は自動で維持する。
 * × を押して手動解除した場合は、次に OK するまで自動ロックしない。
 */
export function BowlingPositionLockKeeper() {
  useEffect(() => {
    let confirmedOnce = false;
    let manuallyUnlocked = false;
    let currentLane: Element | null = null;
    let relockTimer: number | null = null;

    const getControls = () => {
      const lane = document.querySelector('[data-bowling-gesture-block="true"]');
      if (!lane) return { lane: null, ok: null, cancel: null };

      const buttons = Array.from(lane.querySelectorAll<HTMLButtonElement>('button[aria-pressed]'));
      const ok = buttons.find((button) => button.textContent?.includes("OK")) ?? null;
      const cancel = buttons.find((button) => button.textContent?.includes("×")) ?? null;
      return { lane, ok, cancel };
    };

    const syncLane = () => {
      const controls = getControls();
      if (controls.lane !== currentLane) {
        currentLane = controls.lane;
        confirmedOnce = false;
        manuallyUnlocked = false;
      }
      return controls;
    };

    const onPointerUpCapture = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest<HTMLButtonElement>('button[aria-pressed]');
      if (!button) return;

      const { ok, cancel } = syncLane();
      if (button === ok) {
        confirmedOnce = true;
        manuallyUnlocked = false;
      } else if (button === cancel) {
        manuallyUnlocked = true;
      }
    };

    const observer = new MutationObserver(() => {
      const { ok } = syncLane();
      if (!ok || !confirmedOnce || manuallyUnlocked) return;
      if (ok.getAttribute("aria-pressed") === "true") return;
      if (relockTimer !== null) return;

      relockTimer = window.setTimeout(() => {
        relockTimer = null;
        const latest = syncLane();
        if (!latest.ok || manuallyUnlocked || !confirmedOnce) return;
        if (latest.ok.getAttribute("aria-pressed") === "true") return;

        latest.ok.dispatchEvent(new PointerEvent("pointerup", {
          bubbles: true,
          cancelable: true,
          pointerType: "touch",
        }));
      }, 0);
    });

    document.addEventListener("pointerup", onPointerUpCapture, true);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["aria-pressed"],
    });

    return () => {
      document.removeEventListener("pointerup", onPointerUpCapture, true);
      observer.disconnect();
      if (relockTimer !== null) window.clearTimeout(relockTimer);
    };
  }, []);

  return null;
}
