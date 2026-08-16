module.exports = function previewItemCatchHazardsLoader(source) {
  let out = source;

  const replace = (from, to, label) => {
    if (!out.includes(from)) {
      throw new Error(`[preview hazards] source pattern not found: ${label}`);
    }
    out = out.replace(from, to);
  };

  replace(
`const BAG_SPAWN_CHANCE = 0.03;
const BAG_MAX_STOCK = 3;
const COMBO_SHIELD_MAX = 4;`,
`const BAG_SPAWN_CHANCE = 0.03;
const BAG_MAX_STOCK = 3;

// Preview-only negative items.
const TIME_MINUS_ITEM_ID = "hazard_time_minus";
const TIME_MINUS_IMAGE = "/collection/items/hazard-time-minus.webp";
const TIME_MINUS_SPAWN_CHANCE = 0.015;
const TIME_MINUS_SECONDS = 3;
const BOX_SHRINK_ITEM_ID = "hazard_box_shrink";
const BOX_SHRINK_IMAGE = "/collection/items/hazard-box-shrink.webp";
const BOX_SHRINK_SPAWN_CHANCE = 0.02;
const BOX_SHRINK_SCALE = 0.8;
const BOX_SHRINK_SECONDS = 3;
const BLACKOUT_ITEM_ID = "hazard_blackout_squid";
const BLACKOUT_IMAGE = "/collection/items/hazard-blackout-squid.webp";
const BLACKOUT_SPAWN_CHANCE = 0.01;
const BLACKOUT_SECONDS = 3;
const STUN_ITEM_ID = "hazard_stun_battery";
const STUN_IMAGE = "/collection/items/hazard-stun-battery.webp";
const STUN_SPAWN_CHANCE = 0.02;
const STUN_SECONDS = 1;
const NEGATIVE_HAZARD_IDS = new Set([TIME_MINUS_ITEM_ID, BOX_SHRINK_ITEM_ID, BLACKOUT_ITEM_ID, STUN_ITEM_ID]);
const SPAWN_INTERVAL_MIN_MS = 650;
const SPAWN_INTERVAL_MAX_MS = 780;
const NORMAL_ENTITY_CAP = 10;
const DOUBLE_ENTITY_CAP = 15;
const TRIPLE_ENTITY_CAP = 18;

const COMBO_SHIELD_MAX = 4;`,
"hazard constants"
  );

  replace(
`  const spawnRateBoostUntilRef = useRef(0);
  const spawnRateBoostValueRef = useRef(SPAWN_RATE_BOOST);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);`,
`  const spawnRateBoostUntilRef = useRef(0);
  const spawnRateBoostValueRef = useRef(SPAWN_RATE_BOOST);
  const boxShrinkUntilRef = useRef(0);
  const blackoutUntilRef = useRef(0);
  const stunUntilRef = useRef(0);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);`,
"hazard refs"
  );

  replace(
`  const [boxBounce, setBoxBounce] = useState(false);
  const [coinReward, setCoinReward] = useState<number | null>(null);`,
`  const [boxBounce, setBoxBounce] = useState(false);
  const [blackoutActive, setBlackoutActive] = useState(false);
  const [stunned, setStunned] = useState(false);
  const [coinReward, setCoinReward] = useState<number | null>(null);`,
"hazard states"
  );

  replace(
`    if (now < spawnRateBoostUntilRef.current) labels.push(\`アイテム出現量×\${spawnRateBoostValueRef.current}中\`);
    if (now < boxWideUntilRef.current) labels.push(\`ダンボール×\${boxWideScaleRef.current}拡大中\`);
    if (urBoostRef.current > 0) labels.push(\`UR出現率+\${Math.min(urBoostRef.current, UR_BOOST_MAX)}\`);`,
`    if (now < spawnRateBoostUntilRef.current) labels.push(\`アイテム出現量×\${spawnRateBoostValueRef.current}中\`);
    if (now < boxShrinkUntilRef.current) labels.push("ダンボール0.8倍");
    else if (now < boxWideUntilRef.current) labels.push(\`ダンボール×\${boxWideScaleRef.current}拡大中\`);
    if (now < blackoutUntilRef.current) labels.push("上半分ブラックアウト中");
    if (now < stunUntilRef.current) labels.push("しびれ中");
    if (urBoostRef.current > 0) labels.push(\`UR出現率+\${Math.min(urBoostRef.current, UR_BOOST_MAX)}\`);`,
"hazard status labels"
  );

  replace(
`    if (hazardRoll < POOP_SPAWN_CHANCE + MYSTERY_SPAWN_CHANCE + BAG_SPAWN_CHANCE && bagStockRef.current < BAG_MAX_STOCK) {
      return {
        ...base,
        itemId: BAG_ITEM_ID,
        kind: "item",
        name: "ビニール袋",
        image: BAG_IMAGE,
        rarity: null,
        level: 0,
        size: 13 + Math.random() * 3,
        spin: (Math.random() - 0.5) * 30,
      };
    }

    if (itemPool.length === 0) {`,
`    if (hazardRoll < POOP_SPAWN_CHANCE + MYSTERY_SPAWN_CHANCE + BAG_SPAWN_CHANCE && bagStockRef.current < BAG_MAX_STOCK) {
      return {
        ...base,
        itemId: BAG_ITEM_ID,
        kind: "item",
        name: "ビニール袋",
        image: BAG_IMAGE,
        rarity: null,
        level: 0,
        size: 13 + Math.random() * 3,
        spin: (Math.random() - 0.5) * 30,
      };
    }

    const timeMinusThreshold = POOP_SPAWN_CHANCE + MYSTERY_SPAWN_CHANCE + BAG_SPAWN_CHANCE + TIME_MINUS_SPAWN_CHANCE;
    const shrinkThreshold = timeMinusThreshold + BOX_SHRINK_SPAWN_CHANCE;
    const blackoutThreshold = shrinkThreshold + BLACKOUT_SPAWN_CHANCE;
    const stunThreshold = blackoutThreshold + STUN_SPAWN_CHANCE;

    if (hazardRoll < timeMinusThreshold) {
      return { ...base, itemId: TIME_MINUS_ITEM_ID, kind: "item", name: "時間 -3秒", image: TIME_MINUS_IMAGE, rarity: null, level: 0, size: 13 + Math.random() * 3, spin: (Math.random() - 0.5) * 28 };
    }
    if (hazardRoll < shrinkThreshold) {
      return { ...base, itemId: BOX_SHRINK_ITEM_ID, kind: "item", name: "ダンボール縮小", image: BOX_SHRINK_IMAGE, rarity: null, level: 0, size: 13 + Math.random() * 3, spin: (Math.random() - 0.5) * 28 };
    }
    if (hazardRoll < blackoutThreshold) {
      return { ...base, itemId: BLACKOUT_ITEM_ID, kind: "item", name: "イカスミ", image: BLACKOUT_IMAGE, rarity: null, level: 0, size: 14 + Math.random() * 3, spin: (Math.random() - 0.5) * 22 };
    }
    if (hazardRoll < stunThreshold) {
      return { ...base, itemId: STUN_ITEM_ID, kind: "item", name: "しびれバッテリー", image: STUN_IMAGE, rarity: null, level: 0, size: 12.5 + Math.random() * 3, spin: (Math.random() - 0.5) * 30 };
    }

    if (itemPool.length === 0) {`,
"hazard spawn entities"
  );

  replace(
`      if (spawnRateBoostUntilRef.current > 0 && now >= spawnRateBoostUntilRef.current) {
        spawnRateBoostUntilRef.current = 0;
        timedEffectChanged = true;
      }
      if (timedEffectChanged) refreshEffectStatus(now);`,
`      if (spawnRateBoostUntilRef.current > 0 && now >= spawnRateBoostUntilRef.current) {
        spawnRateBoostUntilRef.current = 0;
        timedEffectChanged = true;
      }
      if (boxShrinkUntilRef.current > 0 && now >= boxShrinkUntilRef.current) {
        boxShrinkUntilRef.current = 0;
        timedEffectChanged = true;
      }
      if (blackoutUntilRef.current > 0 && now >= blackoutUntilRef.current) {
        blackoutUntilRef.current = 0;
        setBlackoutActive(false);
        timedEffectChanged = true;
      }
      if (stunUntilRef.current > 0 && now >= stunUntilRef.current) {
        stunUntilRef.current = 0;
        setStunned(false);
        timedEffectChanged = true;
      }
      if (timedEffectChanged) refreshEffectStatus(now);`,
"hazard expiry"
  );

  replace(
`      const dt = Math.min(0.035, Math.max(0, (now - last) / 1000));
      last = now;
      if (now >= nextSpawnRef.current && entitiesRef.current.length < 10) {
        entitiesRef.current.push(createEntity());
        const spawnRate = now < spawnRateBoostUntilRef.current ? spawnRateBoostValueRef.current : 1;
        nextSpawnRef.current = now + (790 - Math.min(1, elapsed / ROUND_SECONDS) * 250 + Math.random() * 170) / spawnRate;
      }

      const boxWide = now < boxWideUntilRef.current;
      const effBoxHalf = boxWide ? BOX_HALF * boxWideScaleRef.current : BOX_HALF;
      const effBoxWidth = boxWide ? BOX_WIDTH * boxWideScaleRef.current : BOX_WIDTH;`,
`      const dt = Math.min(0.035, Math.max(0, (now - last) / 1000));
      last = now;
      const spawnRate = now < spawnRateBoostUntilRef.current ? spawnRateBoostValueRef.current : 1;
      const entityCap = spawnRate >= 3 ? TRIPLE_ENTITY_CAP : spawnRate >= 2 ? DOUBLE_ENTITY_CAP : NORMAL_ENTITY_CAP;
      if (now >= nextSpawnRef.current && entitiesRef.current.length < entityCap) {
        entitiesRef.current.push(createEntity());
        nextSpawnRef.current = now + (SPAWN_INTERVAL_MIN_MS + Math.random() * (SPAWN_INTERVAL_MAX_MS - SPAWN_INTERVAL_MIN_MS)) / spawnRate;
      }

      const boxWide = now < boxWideUntilRef.current;
      const boxShrink = now < boxShrinkUntilRef.current;
      const effectiveBoxScale = boxShrink ? BOX_SHRINK_SCALE : boxWide ? boxWideScaleRef.current : 1;
      const effBoxHalf = BOX_HALF * effectiveBoxScale;
      const effBoxWidth = BOX_WIDTH * effectiveBoxScale;`,
"spawn cadence and entity caps"
  );

  replace(
`        if (magnetActive && entity.status === "falling" && entity.y > 20 && entity.itemId !== POOP_ITEM_ID) {`,
`        if (magnetActive && entity.status === "falling" && entity.y > 20 && entity.itemId !== POOP_ITEM_ID && !NEGATIVE_HAZARD_IDS.has(entity.itemId ?? "")) {`,
"magnet excludes negative items"
  );

  replace(
`            if (entity.itemId === BAG_ITEM_ID) {
              caughtRef.current += 1;
              setCaught(caughtRef.current);
              if (bagStockRef.current < BAG_MAX_STOCK) {
                bagStockRef.current += 1;
                setBagStock(bagStockRef.current);
                showCatch(entity, 0, \`ビニール袋 \${bagStockRef.current}/\${BAG_MAX_STOCK}\`);
              } else {
                showCatch(entity, 0, "ビニール袋は満タン");
              }
              next.push(entity);
              continue;
            }

            const basePoints = entity.kind === "dog"`,
`            if (entity.itemId === BAG_ITEM_ID) {
              caughtRef.current += 1;
              setCaught(caughtRef.current);
              if (bagStockRef.current < BAG_MAX_STOCK) {
                bagStockRef.current += 1;
                setBagStock(bagStockRef.current);
                showCatch(entity, 0, \`ビニール袋 \${bagStockRef.current}/\${BAG_MAX_STOCK}\`);
              } else {
                showCatch(entity, 0, "ビニール袋は満タン");
              }
              next.push(entity);
              continue;
            }

            if (NEGATIVE_HAZARD_IDS.has(entity.itemId ?? "")) {
              caughtRef.current += 1;
              setCaught(caughtRef.current);
              if (entity.itemId === TIME_MINUS_ITEM_ID) {
                endAtRef.current -= TIME_MINUS_SECONDS * 1000;
                const nextRemaining = Math.max(0, (endAtRef.current - now) / 1000);
                setTimeLeft(Math.ceil(nextRemaining));
                showCatch(entity, 0, `残り時間 -${TIME_MINUS_SECONDS}秒`);
                if (endAtRef.current <= now) {
                  endAtRef.current = now;
                  setTimeLeft(0);
                  setPhase("finished");
                }
              } else if (entity.itemId === BOX_SHRINK_ITEM_ID) {
                boxShrinkUntilRef.current = now + BOX_SHRINK_SECONDS * 1000;
                showCatch(entity, 0, `${BOX_SHRINK_SECONDS}秒間 ダンボール0.8倍`);
              } else if (entity.itemId === BLACKOUT_ITEM_ID) {
                blackoutUntilRef.current = now + BLACKOUT_SECONDS * 1000;
                setBlackoutActive(true);
                showCatch(entity, 0, `${BLACKOUT_SECONDS}秒間 上半分が見えない！`);
              } else if (entity.itemId === STUN_ITEM_ID) {
                stunUntilRef.current = now + STUN_SECONDS * 1000;
                draggingRef.current = false;
                setStunned(true);
                showCatch(entity, 0, `${STUN_SECONDS}秒間 しびれ！`);
              }
              refreshEffectStatus(now);
              next.push(entity);
              continue;
            }

            const basePoints = entity.kind === "dog"`,
"hazard catch effects"
  );

  replace(
`        if (entity.y > 110 || entity.x < -18 || entity.x > 118) {
          if (entity.status !== "caught" && entity.itemId !== POOP_ITEM_ID) breakCombo(entity);`,
`        if (entity.y > 110 || entity.x < -18 || entity.x > 118) {
          if (entity.status !== "caught" && entity.itemId !== POOP_ITEM_ID && !NEGATIVE_HAZARD_IDS.has(entity.itemId ?? "")) breakCombo(entity);`,
"negative item misses do not break combo"
  );

  replace(
`    spawnRateBoostUntilRef.current = 0;
    bagStockRef.current = 0;
    setBagStock(0);`,
`    spawnRateBoostUntilRef.current = 0;
    boxShrinkUntilRef.current = 0;
    blackoutUntilRef.current = 0;
    stunUntilRef.current = 0;
    setBlackoutActive(false);
    setStunned(false);
    bagStockRef.current = 0;
    setBagStock(0);`,
"hazard reset"
  );

  replace(
`  const moveBox = useCallback((clientX: number) => {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    const pointerX = ((clientX - rect.left) / rect.width) * 100;
    const nextX = clamp(pointerX - dragOffsetRef.current, BOX_MIN_X, BOX_MAX_X);
    boxXRef.current = nextX;
    setBoxX(nextX);
  }, []);`,
`  const moveBox = useCallback((clientX: number) => {
    if (performance.now() < stunUntilRef.current) return;
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    const pointerX = ((clientX - rect.left) / rect.width) * 100;
    const now = performance.now();
    const boxScale = now < boxShrinkUntilRef.current
      ? BOX_SHRINK_SCALE
      : now < boxWideUntilRef.current
        ? boxWideScaleRef.current
        : 1;
    const dynamicHalf = BOX_HALF * boxScale;
    const nextX = clamp(pointerX - dragOffsetRef.current, dynamicHalf + 1, 100 - dynamicHalf - 1);
    boxXRef.current = nextX;
    setBoxX(nextX);
  }, []);`,
"stun and dynamic movement bounds"
  );

  replace(
`  const pointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (phase !== "playing") return;`,
`  const pointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (phase !== "playing" || performance.now() < stunUntilRef.current) return;`,
"stun pointer down"
  );

  replace(
`  const pointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (phase === "playing" && draggingRef.current) moveBox(event.clientX);`,
`  const pointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (phase === "playing" && draggingRef.current && performance.now() >= stunUntilRef.current) moveBox(event.clientX);`,
"stun pointer move"
  );

  replace(
`        {activeEffects.length > 0 ? (`,
`        {blackoutActive ? (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-[25] h-1/2 bg-black/95" aria-label="上半分ブラックアウト" />
        ) : null}

        {activeEffects.length > 0 ? (`,
"blackout overlay"
  );

  replace(
`          style={{
            left: \`\${boxX}%\`,
            width: \`\${BOX_WIDTH * (performance.now() < boxWideUntilRef.current ? boxWideScaleRef.current : 1)}%\`,
            height: \`\${BOX_HEIGHT}%\`,
            transform: \`translateX(-50%) scaleY(\${boxBounce ? 1.015 : 1})\`,
          }}`,
`          style={{
            left: \`\${boxX}%\`,
            width: \`\${BOX_WIDTH * (performance.now() < boxShrinkUntilRef.current ? BOX_SHRINK_SCALE : performance.now() < boxWideUntilRef.current ? boxWideScaleRef.current : 1)}%\`,
            height: \`\${BOX_HEIGHT}%\`,
            transform: \`translateX(-50%) scaleY(\${boxBounce ? 1.015 : 1})\`,
          }}`,
"visual box shrink"
  );

  replace(
`          <Image src={BOX_IMAGE} alt="拾ってくだブーと書かれた段ボール" fill priority draggable={false} sizes="38vw" className={\`pointer-events-none \${performance.now() < boxWideUntilRef.current ? "object-fill" : "object-contain"}\`} />
        </div>`,
`          <Image src={BOX_IMAGE} alt="拾ってくだブーと書かれた段ボール" fill priority draggable={false} sizes="38vw" className={\`pointer-events-none \${performance.now() < boxWideUntilRef.current && performance.now() >= boxShrinkUntilRef.current ? "object-fill" : "object-contain"}\`} />
          {stunned ? <span className="pointer-events-none absolute -right-4 top-1/2 -translate-y-1/2 text-2xl drop-shadow-[0_2px_2px_rgba(0,0,0,0.25)]" aria-label="しびれ中">⚡</span> : null}
        </div>`,
"stun marker"
  );

  return out;
};
