"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  BLOCK_DEFINITIONS,
  HOTBAR_BLOCK_IDS,
  INITIAL_BLOCK_INVENTORY,
  type PlaceableBlockId,
} from "@/lib/games/block-garden-config";
import {
  BlockGardenEngine,
  type BlockGardenTarget,
} from "@/components/block-garden/block-garden-engine";
import styles from "./block-garden-game.module.css";

type TouchLookGesture = {
  pointerId: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  startedAt: number;
  moved: boolean;
  longPressed: boolean;
};

export default function BlockGardenGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<BlockGardenEngine | null>(null);
  const joystickKnobRef = useRef<HTMLSpanElement>(null);
  const joystickPointerRef = useRef<number | null>(null);
  const lookGestureRef = useRef<TouchLookGesture | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const selectedRef = useRef<PlaceableBlockId>("grass");
  const inventoryRef = useRef({ ...INITIAL_BLOCK_INVENTORY });

  const [selected, setSelected] = useState<PlaceableBlockId>("grass");
  const [inventory, setInventory] = useState({ ...INITIAL_BLOCK_INVENTORY });
  const [target, setTarget] = useState<BlockGardenTarget>(null);
  const [guideOpen, setGuideOpen] = useState(true);
  const [holding, setHolding] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 1600);
  }, []);

  const breakBlock = useCallback(() => {
    const result = engineRef.current?.breakTarget();
    if (!result) return;
    if (!result.ok) {
      showToast(result.message);
      return;
    }

    if (result.inventoryId) {
      const nextInventory = {
        ...inventoryRef.current,
        [result.inventoryId]: inventoryRef.current[result.inventoryId] + 1,
      };
      inventoryRef.current = nextInventory;
      setInventory(nextInventory);
    }
    showToast(`${BLOCK_DEFINITIONS[result.blockId].icon} ${result.label}を1個ゲット！`);
  }, [showToast]);

  const placeBlock = useCallback(() => {
    const blockId = selectedRef.current;
    const currentCount = inventoryRef.current[blockId];
    if (currentCount <= 0) {
      showToast(`${BLOCK_DEFINITIONS[blockId].shortLabel}を持っていません`);
      return;
    }

    const result = engineRef.current?.placeTarget(blockId);
    if (!result) return;
    if (!result.ok) {
      showToast(result.message);
      return;
    }

    const nextInventory = {
      ...inventoryRef.current,
      [blockId]: currentCount - 1,
    };
    inventoryRef.current = nextInventory;
    setInventory(nextInventory);
    showToast(`${BLOCK_DEFINITIONS[blockId].icon} ${result.label}を置きました`);
  }, [showToast]);

  const chooseBlock = useCallback((blockId: PlaceableBlockId) => {
    selectedRef.current = blockId;
    setSelected(blockId);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let engine: BlockGardenEngine | null = null;
    try {
      engine = new BlockGardenEngine(canvas, {
        onTargetChange: setTarget,
        onContextLost: () => setRenderError("3D画面が一時停止しました。ゲーム一覧から開き直してください。"),
      });
      engineRef.current = engine;
      engine.start();
    } catch {
      setRenderError("この端末では3D画面を準備できませんでした。ブラウザを更新してもう一度お試しください。");
    }

    return () => {
      engine?.dispose();
      if (engineRef.current === engine) engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    const body = document.body;
    const html = document.documentElement;
    const scrollY = window.scrollY;
    const previous = {
      bodyOverflow: body.style.overflow,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyWidth: body.style.width,
      bodyOverscroll: body.style.overscrollBehavior,
      htmlOverflow: html.style.overflow,
      htmlOverscroll: html.style.overscrollBehavior,
    };

    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    body.style.overscrollBehavior = "none";
    html.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";

    const preventGameScroll = (event: TouchEvent) => {
      const element = event.target instanceof Element ? event.target : null;
      if (!element?.closest("[data-block-garden-root]")) return;
      if (element.closest("[data-block-garden-scroll]")) return;
      event.preventDefault();
    };
    document.addEventListener("touchmove", preventGameScroll, { passive: false, capture: true });

    return () => {
      document.removeEventListener("touchmove", preventGameScroll, true);
      body.style.overflow = previous.bodyOverflow;
      body.style.position = previous.bodyPosition;
      body.style.top = previous.bodyTop;
      body.style.width = previous.bodyWidth;
      body.style.overscrollBehavior = previous.bodyOverscroll;
      html.style.overflow = previous.htmlOverflow;
      html.style.overscrollBehavior = previous.htmlOverscroll;
      window.scrollTo(0, scrollY);
    };
  }, []);

  useEffect(() => {
    const movementKeys = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"]);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (movementKeys.has(event.code)) {
        event.preventDefault();
        engineRef.current?.setKey(event.code, true);
        return;
      }
      if (/^Digit[1-5]$/.test(event.code)) {
        const index = Number(event.code.slice(-1)) - 1;
        const blockId = HOTBAR_BLOCK_IDS[index];
        if (blockId) chooseBlock(blockId);
      }
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (movementKeys.has(event.code)) engineRef.current?.setKey(event.code, false);
    };
    const handleMouseMove = (event: MouseEvent) => {
      if (document.pointerLockElement === canvasRef.current) {
        engineRef.current?.addLookDelta(event.movementX, event.movementY, 0.00215);
      }
    };
    const releaseKeys = () => {
      for (const code of movementKeys) engineRef.current?.setKey(code, false);
      engineRef.current?.setTouchMovement(0, 0);
    };

    window.addEventListener("keydown", handleKeyDown, { passive: false });
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", releaseKeys);
    document.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", releaseKeys);
      document.removeEventListener("mousemove", handleMouseMove);
    };
  }, [chooseBlock]);

  useEffect(() => {
    const canvas = canvasRef.current;
    return () => {
      if (longPressTimerRef.current !== null) window.clearTimeout(longPressTimerRef.current);
      if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
      if (document.pointerLockElement === canvas) document.exitPointerLock();
    };
  }, []);

  const clearLongPress = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    setHolding(false);
  };

  const handleCanvasPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (event.pointerType === "mouse") {
      event.preventDefault();
      if (event.button === 2) {
        placeBlock();
      } else if (document.pointerLockElement === event.currentTarget) {
        breakBlock();
      } else {
        void event.currentTarget.requestPointerLock();
      }
      return;
    }

    if (lookGestureRef.current) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    lookGestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      startedAt: performance.now(),
      moved: false,
      longPressed: false,
    };
    setHolding(true);
    longPressTimerRef.current = window.setTimeout(() => {
      const gesture = lookGestureRef.current;
      if (!gesture || gesture.moved) return;
      gesture.longPressed = true;
      setHolding(false);
      breakBlock();
    }, 520);
  };

  const handleCanvasPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const gesture = lookGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;

    const totalDistance = Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY);
    if (totalDistance > 7 && !gesture.moved) {
      gesture.moved = true;
      clearLongPress();
    }
    if (gesture.moved) {
      const deltaX = event.clientX - gesture.lastX;
      const deltaY = event.clientY - gesture.lastY;
      engineRef.current?.addLookDelta(deltaX, deltaY, 0.0041);
    }
    gesture.lastX = event.clientX;
    gesture.lastY = event.clientY;
  };

  const finishLookGesture = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const gesture = lookGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    clearLongPress();
    if (!gesture.moved && !gesture.longPressed && performance.now() - gesture.startedAt < 520) breakBlock();
    lookGestureRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const cancelLookGesture = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const gesture = lookGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    clearLongPress();
    lookGestureRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const updateJoystick = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (joystickPointerRef.current !== event.pointerId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const deltaX = event.clientX - (rect.left + rect.width / 2);
    const deltaY = event.clientY - (rect.top + rect.height / 2);
    const maxDistance = rect.width * 0.34;
    const distance = Math.hypot(deltaX, deltaY);
    const scale = distance > maxDistance ? maxDistance / distance : 1;
    const visualX = deltaX * scale;
    const visualY = deltaY * scale;
    if (joystickKnobRef.current) {
      joystickKnobRef.current.style.transform = `translate3d(${visualX}px, ${visualY}px, 0)`;
    }
    engineRef.current?.setTouchMovement(visualX / maxDistance, -visualY / maxDistance);
  };

  const handleJoystickDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (joystickPointerRef.current !== null) return;
    joystickPointerRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    updateJoystick(event);
  };

  const finishJoystick = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (joystickPointerRef.current !== event.pointerId) return;
    joystickPointerRef.current = null;
    engineRef.current?.setTouchMovement(0, 0);
    if (joystickKnobRef.current) joystickKnobRef.current.style.transform = "translate3d(0, 0, 0)";
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const targetDefinition = target ? BLOCK_DEFINITIONS[target.blockId] : null;

  return (
    <div className={styles.root} data-block-garden-root>
      <div className={styles.canvasWrap}>
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          aria-label="ブロックガーデンの3Dフィールド"
          onContextMenu={(event) => event.preventDefault()}
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handleCanvasPointerMove}
          onPointerUp={finishLookGesture}
          onPointerCancel={cancelLookGesture}
        />
      </div>

      <header className={styles.header}>
        <Link href="/games" className={styles.backButton} aria-label="ミニゲーム一覧へ戻る">
          ‹
        </Link>
        <div className={styles.titleWrap}>
          <div className={styles.eyebrow}>
            <span aria-hidden="true">🐾</span>
            おでかけクラフト
            <span className={styles.prototypeBadge}>PROTOTYPE</span>
          </div>
          <h1 className={styles.title}>わんこのブロックガーデン</h1>
        </div>
        <button type="button" className={styles.helpButton} onClick={() => setGuideOpen(true)} aria-label="遊び方を見る">
          ?
        </button>
      </header>

      <div className={styles.targetBadge} aria-live="polite">
        <span className={styles.targetDot} aria-hidden="true" />
        {targetDefinition ? `${targetDefinition.icon} ${targetDefinition.label}` : "照準をブロックに合わせよう"}
      </div>

      <div className={`${styles.crosshair} ${holding ? styles.holding : ""}`} aria-hidden="true">
        <span className={styles.holdRing} />
      </div>

      <div
        className={styles.joystick}
        aria-label="移動ジョイスティック"
        role="group"
        onPointerDown={handleJoystickDown}
        onPointerMove={updateJoystick}
        onPointerUp={finishJoystick}
        onPointerCancel={finishJoystick}
      >
        <span ref={joystickKnobRef} className={styles.joystickKnob} aria-hidden="true">
          🐾
        </span>
      </div>

      <div className={styles.actionButtons} aria-label="ブロック操作">
        <button type="button" className={styles.actionButton} onClick={breakBlock}>
          <span className={styles.actionIcon} aria-hidden="true">⛏️</span>
          <span className={styles.actionLabel}>こわす</span>
        </button>
        <button type="button" className={`${styles.actionButton} ${styles.actionPlace}`} onClick={placeBlock}>
          <span className={styles.actionIcon} aria-hidden="true">＋</span>
          <span className={styles.actionLabel}>おく</span>
        </button>
      </div>

      <ol className={styles.hotbar} aria-label="素材ホットバー">
        {HOTBAR_BLOCK_IDS.map((blockId, index) => {
          const definition = BLOCK_DEFINITIONS[blockId];
          const isSelected = selected === blockId;
          return (
            <li key={blockId} className={styles.hotbarItem}>
              <button
                type="button"
                className={`${styles.hotbarButton} ${isSelected ? styles.hotbarSelected : ""}`}
                aria-pressed={isSelected}
                aria-label={`${definition.label}、${inventory[blockId]}個`}
                onClick={() => chooseBlock(blockId)}
              >
                <span className={styles.hotbarCount}>{inventory[blockId]}</span>
                <span className={styles.hotbarIcon} aria-hidden="true">{definition.icon}</span>
                <span className={styles.hotbarName}>{definition.shortLabel}</span>
                <span className={styles.keyNumber} aria-hidden="true">{index + 1}</span>
              </button>
            </li>
          );
        })}
      </ol>

      <p className={styles.desktopHint}>WASDで移動 ・ クリックで視点 ・ 左クリックで壊す ・ 右クリックで置く</p>

      {toast ? <div className={styles.toast} role="status">{toast}</div> : null}

      {guideOpen ? (
        <div className={styles.guideBackdrop} role="presentation">
          <section
            className={styles.guideCard}
            role="dialog"
            aria-modal="true"
            aria-labelledby="block-garden-guide-title"
            data-block-garden-scroll
          >
            <div className={styles.guideIcon} aria-hidden="true">🌱</div>
            <h2 id="block-garden-guide-title" className={styles.guideTitle}>小さな庭をつくろう</h2>
            <p className={styles.guideLead}>歩いて、集めて、好きな場所にブロックを置けます。</p>
            <ul className={styles.guideList}>
              <li className={styles.guideItem}>
                <span className={styles.guideItemIcon} aria-hidden="true">🐾</span>
                <span><strong>移動と見回し</strong><span>左の肉球で移動、右側をスワイプして視点を動かします。</span></span>
              </li>
              <li className={styles.guideItem}>
                <span className={styles.guideItemIcon} aria-hidden="true">⛏️</span>
                <span><strong>ブロックを壊す</strong><span>照準を合わせてタップ、長押し、または「こわす」を押します。</span></span>
              </li>
              <li className={styles.guideItem}>
                <span className={styles.guideItemIcon} aria-hidden="true">🌸</span>
                <span><strong>ブロックを置く</strong><span>下の素材を選び、置きたい面へ照準を合わせて「おく」を押します。</span></span>
              </li>
            </ul>
            <button type="button" className={styles.startButton} onClick={() => setGuideOpen(false)}>庭づくりをはじめる</button>
          </section>
        </div>
      ) : null}

      {renderError ? (
        <div className={styles.errorBackdrop}>
          <section className={styles.errorCard} role="alert">
            <div className={styles.errorIcon} aria-hidden="true">🌿</div>
            <h2 className={styles.errorTitle}>3D画面を開けませんでした</h2>
            <p className={styles.errorText}>{renderError}</p>
            <Link href="/games" className={styles.errorButton}>ゲーム一覧へ戻る</Link>
          </section>
        </div>
      ) : null}
    </div>
  );
}
