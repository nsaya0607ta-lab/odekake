"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { HomeCoinArt } from "@/components/home-coin-art";
import { getFrenchieSrc, isDogSkinId, type DogSkinId } from "@/lib/dog-skins";
import styles from "./grand-splash.module.css";
import {
  DOG_REACTIONS,
  GAME_SIGNS,
  MAP_PINS,
  MAP_RATIO,
  POLAROIDS,
  RARITY_COLOR,
  STARS,
  WEATHER_DROPS,
  WEATHER_LABEL,
  WEATHERS,
  drawGachaItem,
  skyPhaseOf,
  type SkyPhase,
  type Weather,
} from "./splash-data";

/**
 * アプリを開いたときの最初の画面。
 *
 * このアプリの全部（相棒の犬・日本地図と訪問・ガチャと図鑑・ミニゲーム・写真といいね・歩数・
 * 空から降るコイン・お天気）を、1枚の絵本のような景色に詰めこんだ。ほとんどのものはタップすると動く。
 *
 * - 空は端末の時刻で朝・昼・夕方・夜にかわる。太陽（月）をタップするとお天気がかわる（はれ→さくら→あめ→ゆき）
 * - 何もない空をタップすると、昼は紙ひこうき、夜は流れ星
 * - 地図のピンをタップすると訪問スタンプ、地図そのものをタップすると旅のルートを飛行機がたどる
 * - ガチャをタップするとカプセルが出て、図鑑のアイテムが出てくる（遊び。本物のガチャとは別）
 * - 犬をタップすると仕草がかわる。続けて5回でとっておき
 * - 写真をタップすると裏返って「いいね」がふえる。道しるべをタップするとミニゲームの紹介
 * - コインはタップで拾える（遊び。実際に拾えるのはホームの犬カード）
 * - 「はじめる」で、犬のまわりから円が閉じるように画面がひらく
 *
 * 起動のたびに出るので軽く作る：絵は public/splash/ の小さい画像と CSS、動きは CSS の animation が中心。
 * 「視差効果を減らす」設定の人には、くり返しの動きを止め、入り・出も短くする。
 * ログインボーナス（login-bonus.tsx）は、この画面が消えるのを [data-app-splash] で待っている。
 */

type FxKind = "heart" | "note" | "sparkle" | "star" | "confetti" | "paw" | "petal";
type Fx = { id: number; kind: FxKind; x: number; y: number; dx: number; dy: number; rot: number; delay: number; hue: number };
type Coin = { id: number; kind: "coin" | "blue"; tier: "common" | "rare" | "epic"; x: number; y: number; fallPx: number; state: "fall" | "ground" | "taken" | "gone" };
type Flyer = { id: number; kind: "plane" | "comet"; x: number; y: number };
type Label = { id: number; text: string; x: number; y: number; tone: "gold" | "pink" | "blue" | "ink" };

const DOG_POSES = ["stand", "walk", "stand-happy", "cheer", "wave", "wink", "bark", "sit", "sniff", "trot"] as const;
type DogPose = (typeof DOG_POSES)[number];
const IDLE_POSES: readonly DogPose[] = ["sniff", "sit", "wink", "stand-happy"];

const rand = (min: number, max: number) => min + Math.random() * (max - min);

/**
 * 写真を吊るすひも。viewBox（横 0〜100・縦 0〜10）の2次ベジェで、両はしの高さ END、まん中のたるみ SAG。
 * 写真はクリップがひもを挟む位置に吊るしたいので、ひもの高さをここから計算して写真の top に使う。
 * STRING_HEIGHT は .string の高さ（.bunting に対する％。CSS と合わせる）
 */
const STRING_END = 5;
const STRING_SAG = 14;
const STRING_HEIGHT = 34;
const STRING_D = `M0 ${STRING_END} Q 50 ${STRING_SAG} 100 ${STRING_END}`;
/** 横 x%（.bunting の幅に対する％）のところの、ひもの高さ（.bunting の高さに対する％） */
function stringTopAt(x: number): number {
  // 制御点の x がまん中（50）なので、横の位置 x はそのまま t（0〜1）になる
  const t = x / 100;
  const y = (1 - t) ** 2 * STRING_END + 2 * t * (1 - t) * STRING_SAG + t ** 2 * STRING_END;
  return (y / 10) * STRING_HEIGHT;
}

/** タップした要素のまん中を、景色（stage）に対する％で */
function centerOf(el: Element | null, stage: HTMLElement | null): { x: number; y: number } {
  if (!el || !stage) return { x: 50, y: 50 };
  const r = el.getBoundingClientRect();
  const s = stage.getBoundingClientRect();
  return { x: ((r.left + r.width / 2 - s.left) / s.width) * 100, y: ((r.top + r.height / 2 - s.top) / s.height) * 100 };
}

export function GrandSplash({ onFinish }: { onFinish: () => void }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(1);
  const nextId = () => idRef.current++;
  const reducedRef = useRef(false);

  const [phase, setPhase] = useState<SkyPhase>("day");
  const [weather, setWeather] = useState<Weather>("clear");
  const [rainbowKey, setRainbowKey] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [interacted, setInteracted] = useState(false);
  const [hint, setHint] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [fx, setFx] = useState<Fx[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [flyers, setFlyers] = useState<Flyer[]>([]);
  const [coins, setCoins] = useState<Coin[]>([]);
  const coinToastShown = useRef(false);

  // ---- 犬 ----
  const [skin, setSkin] = useState<DogSkinId | null>(null);
  const [dog, setDog] = useState<{ x: number; pose: DogPose; walking: boolean; jump: number; spin: boolean }>({
    x: 118,
    pose: "walk",
    walking: false,
    jump: 0,
    spin: false,
  });
  const [stepUp, setStepUp] = useState(false);
  const [bubble, setBubble] = useState<{ id: number; text: string } | null>(null);
  const dogTaps = useRef<number[]>([]);
  const dogTapCount = useRef(0);
  const lastDogTouch = useRef(0);
  const [dogArrived, setDogArrived] = useState(false);

  // ---- 地図・ガチャ・写真・道しるべ・歩数・タイトル ----
  const [stamped, setStamped] = useState<Record<string, number>>({});
  const [pinTag, setPinTag] = useState<{ code: string; key: number } | null>(null);
  const [route, setRoute] = useState(0);
  const routePathRef = useRef<SVGPathElement>(null);
  const planeRef = useRef<SVGGElement>(null);
  const [gacha, setGacha] = useState<{ step: "idle" | "shake" | "drop" | "open" | "show"; key: number; item: ReturnType<typeof drawGachaItem> | null; colors: [string, string] }>({
    step: "idle",
    key: 0,
    item: null,
    colors: ["#ff9fb8", "#fff4f7"],
  });
  const [photos, setPhotos] = useState<Record<string, { flipped: boolean; likes: number; key: number }>>(() =>
    Object.fromEntries(POLAROIDS.map((p) => [p.id, { flipped: false, likes: p.likes, key: 0 }])),
  );
  const [signs, setSigns] = useState<Record<string, number>>({});
  const [signSay, setSignSay] = useState<{ id: string; key: number } | null>(null);
  const [titleWave, setTitleWave] = useState(0);
  const [balloonKey, setBalloonKey] = useState(0);
  const [sunKey, setSunKey] = useState(0);
  const [steps, setSteps] = useState<number | null>(null);
  const [stepsShown, setStepsShown] = useState(0);
  const [pawKey, setPawKey] = useState(0);
  const [house, setHouse] = useState(0);

  // ---------------------------------------------------------------- 準備
  useEffect(() => {
    reducedRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setPhase(skyPhaseOf(new Date()));

    // 相棒のすがた（Cookie は httpOnly なので API で読む）。遅いときは、いつもの犬で始める
    let settled = false;
    const settle = (id: DogSkinId) => {
      if (settled) return;
      settled = true;
      setSkin(id);
    };
    const fallback = window.setTimeout(() => settle("default"), 1400);
    // ログインしていないときはログイン画面へ転送されるので、転送はたどらずに「いつもの」にする
    fetch("/api/dog-skin", { cache: "no-store", redirect: "manual" })
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { skinId?: unknown } | null) => settle(isDogSkinId(body?.skinId) ? body.skinId : "default"))
      .catch(() => settle("default"));

    // 今日の歩数（ログインしていなければ取れないので、そのときは「てくてく」）
    fetch("/api/steps/today", { cache: "no-store", redirect: "manual" })
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { ok?: boolean; todaySteps?: unknown } | null) => {
        if (body?.ok && typeof body.todaySteps === "number") setSteps(body.todaySteps);
      })
      .catch(() => {});

    const hintTimer = window.setTimeout(() => setHint(true), 3200);
    return () => {
      window.clearTimeout(fallback);
      window.clearTimeout(hintTimer);
    };
  }, []);

  // 何か触ったら、ヒントはしまう
  useEffect(() => {
    if (!interacted) return;
    const id = window.setTimeout(() => setHint(false), 600);
    return () => window.clearTimeout(id);
  }, [interacted]);
  useEffect(() => {
    if (!hint) return;
    const id = window.setTimeout(() => setHint(false), 5200);
    return () => window.clearTimeout(id);
  }, [hint]);

  // 歩数のカウントアップ
  useEffect(() => {
    if (steps === null) return;
    if (reducedRef.current) {
      setStepsShown(steps);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / 1600);
      setStepsShown(Math.round(steps * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    const delay = window.setTimeout(() => (raf = requestAnimationFrame(tick)), 900);
    return () => {
      window.clearTimeout(delay);
      cancelAnimationFrame(raf);
    };
  }, [steps]);

  // ---------------------------------------------------------------- 犬：歩いて登場
  useEffect(() => {
    if (!skin) return;
    // 歩く絵と立ち姿だけ先に読み、ほかの仕草はあとから
    const later = window.setTimeout(() => {
      for (const pose of DOG_POSES) {
        const img = new Image();
        img.src = getFrenchieSrc(skin, pose);
      }
    }, 1800);
    if (reducedRef.current) {
      setDog((d) => ({ ...d, x: 50, pose: "stand-happy", walking: false }));
      setDogArrived(true);
      return () => window.clearTimeout(later);
    }
    const startWalk = window.setTimeout(() => setDog((d) => ({ ...d, x: 50, walking: true })), 120);
    const arrive = window.setTimeout(() => {
      setDog((d) => ({ ...d, walking: false, pose: "stand-happy" }));
      setDogArrived(true);
      setBubble({ id: Date.now(), text: "いっしょに おでかけしよう！" });
    }, 120 + 2500);
    return () => {
      window.clearTimeout(later);
      window.clearTimeout(startWalk);
      window.clearTimeout(arrive);
    };
  }, [skin]);

  // 歩いている間は、立ち姿と踏み出しを入れ替える
  useEffect(() => {
    if (!dog.walking) {
      setStepUp(false);
      return;
    }
    setStepUp(true);
    const id = window.setInterval(() => setStepUp((v) => !v), 290);
    return () => window.clearInterval(id);
  }, [dog.walking]);

  // ふきだしは少したったら消す
  useEffect(() => {
    if (!bubble) return;
    const id = window.setTimeout(() => setBubble(null), bubble.text.length > 8 ? 2800 : 1600);
    return () => window.clearTimeout(id);
  }, [bubble]);

  // さわらずにいると、犬がときどき別の仕草をする
  useEffect(() => {
    if (!dogArrived || reducedRef.current) return;
    const id = window.setInterval(() => {
      if (Date.now() - lastDogTouch.current < 4000) return;
      const pose = IDLE_POSES[Math.floor(Math.random() * IDLE_POSES.length)]!;
      setDog((d) => (d.walking ? d : { ...d, pose }));
      window.setTimeout(() => setDog((d) => (d.walking || d.pose !== pose ? d : { ...d, pose: "stand" })), 2200);
    }, 6000);
    return () => window.clearInterval(id);
  }, [dogArrived]);

  // ---------------------------------------------------------------- 空から降るコイン
  useEffect(() => {
    if (reducedRef.current) return;
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      setCoins((list) => {
        const live = list.filter((c) => c.state !== "gone");
        if (live.length >= 4 || Math.random() > 0.55) return live;
        const stage = stageRef.current;
        const r = Math.random();
        const coin: Coin = {
          id: nextId(),
          kind: Math.random() < 0.5 ? "blue" : "coin",
          tier: r < 0.06 ? "epic" : r < 0.26 ? "rare" : "common",
          x: rand(8, 92),
          y: rand(70, 86),
          fallPx: (stage?.clientHeight ?? 800) * 0.95,
          state: "fall",
        };
        window.setTimeout(() => setCoins((l) => l.map((c) => (c.id === coin.id && c.state === "fall" ? { ...c, state: "ground" } : c))), 1100);
        // 拾われなかったコインは、しばらくすると消える
        window.setTimeout(() => setCoins((l) => l.map((c) => (c.id === coin.id && c.state === "ground" ? { ...c, state: "gone" } : c))), 9000);
        window.setTimeout(() => setCoins((l) => l.filter((c) => c.id !== coin.id)), 9800);
        return [...live, coin];
      });
    }, 1900);
    return () => window.clearInterval(id);
  }, []);

  // ---------------------------------------------------------------- 演出の道具
  const spawn = useCallback((kind: FxKind, x: number, y: number, count: number, spread = 1) => {
    if (reducedRef.current) count = Math.min(count, 3);
    const items: Fx[] = Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2 + rand(-0.4, 0.4);
      const dist = rand(5, 11) * spread;
      return {
        id: idRef.current++,
        kind,
        x,
        y,
        dx: Math.cos(angle) * dist,
        dy: Math.sin(angle) * dist * 0.8 - (kind === "heart" || kind === "note" ? 6 : 2),
        rot: rand(-180, 180),
        delay: Math.round(rand(0, 120)),
        hue: Math.round(rand(0, 360)),
      };
    });
    setFx((list) => [...list.slice(-90), ...items]);
    const ids = new Set(items.map((f) => f.id));
    window.setTimeout(() => setFx((list) => list.filter((f) => !ids.has(f.id))), 1500);
  }, []);

  const say = useCallback((text: string, x: number, y: number, tone: Label["tone"] = "ink") => {
    const label = { id: idRef.current++, text, x, y, tone };
    setLabels((list) => [...list.slice(-5), label]);
    window.setTimeout(() => setLabels((list) => list.filter((l) => l.id !== label.id)), 1700);
  }, []);

  const touch = useCallback(() => setInteracted(true), []);

  // ---------------------------------------------------------------- 空・天気
  const onSkyPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || leaving) return;
    const stage = stageRef.current;
    if (!stage) return;
    const s = stage.getBoundingClientRect();
    const x = ((event.clientX - s.left) / s.width) * 100;
    const y = ((event.clientY - s.top) / s.height) * 100;
    // 地面のあたりは空ではないので何もしない
    if (y > 56) return;
    touch();
    const flyer: Flyer = { id: nextId(), kind: phase === "night" ? "comet" : "plane", x, y };
    setFlyers((list) => [...list.slice(-3), flyer]);
    window.setTimeout(() => setFlyers((list) => list.filter((f) => f.id !== flyer.id)), 2400);
    spawn("sparkle", x, y, 4, 0.6);
  };

  const onSun = (event: React.MouseEvent<HTMLButtonElement>) => {
    touch();
    const next = WEATHERS[(WEATHERS.indexOf(weather) + 1) % WEATHERS.length]!;
    if (weather === "rain") setRainbowKey((k) => k + 1);
    setWeather(next);
    setSunKey((k) => k + 1);
    const c = centerOf(event.currentTarget, stageRef.current);
    spawn(next === "sakura" ? "petal" : "sparkle", c.x, c.y, 8, 0.9);
    say(WEATHER_LABEL[next], c.x, c.y + 6, next === "rain" ? "blue" : next === "sakura" ? "pink" : "gold");
  };

  // ---------------------------------------------------------------- タイトル・気球
  const onTitle = (event: React.MouseEvent<HTMLButtonElement>) => {
    touch();
    setTitleWave((k) => k + 1);
    const c = centerOf(event.currentTarget, stageRef.current);
    spawn("star", c.x, c.y, 10, 1.6);
  };
  const onBalloon = (event: React.MouseEvent<HTMLButtonElement>) => {
    touch();
    setBalloonKey((k) => k + 1);
    const c = centerOf(event.currentTarget, stageRef.current);
    spawn("confetti", c.x, c.y + 4, 10, 1);
    say("ふわ〜っ", c.x, c.y - 6, "pink");
  };

  // ---------------------------------------------------------------- 地図
  const onPin = (event: React.MouseEvent<HTMLButtonElement>, code: string, name: string) => {
    event.stopPropagation();
    touch();
    setStamped((m) => ({ ...m, [code]: (m[code] ?? 0) + 1 }));
    setPinTag({ code, key: Date.now() });
    const c = centerOf(event.currentTarget, stageRef.current);
    spawn("sparkle", c.x, c.y, 7, 0.7);
    say(`${name} 訪問！`, c.x, c.y - 5, "pink");
  };
  useEffect(() => {
    if (!pinTag) return;
    const id = window.setTimeout(() => setPinTag(null), 1800);
    return () => window.clearTimeout(id);
  }, [pinTag]);

  const onMap = () => {
    touch();
    setRoute((k) => k + 1);
  };
  // 旅のルート：線を引きながら、飛行機がピンを順にたどる
  useEffect(() => {
    if (!route) return;
    const path = routePathRef.current;
    const plane = planeRef.current;
    if (!path || !plane) return;
    const total = path.getTotalLength();
    const duration = reducedRef.current ? 1 : 2600;
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / duration);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      const at = path.getPointAtLength(total * e);
      const ahead = path.getPointAtLength(Math.min(total, total * e + 0.5));
      const angle = (Math.atan2(ahead.y - at.y, ahead.x - at.x) * 180) / Math.PI;
      plane.setAttribute("transform", `translate(${at.x} ${at.y}) rotate(${angle})`);
      path.style.strokeDashoffset = `${total * (1 - e)}`;
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    path.style.strokeDasharray = `${total}`;
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [route]);

  // ---------------------------------------------------------------- ガチャ
  const onGacha = (event: React.MouseEvent<HTMLButtonElement>) => {
    touch();
    if (gacha.step !== "idle" && gacha.step !== "show") return;
    const palettes: [string, string][] = [["#ff9fb8", "#fff4f7"], ["#8fd0ff", "#f2faff"], ["#ffd36e", "#fffaf0"], ["#a8e08a", "#f6fff0"], ["#c7a6ff", "#faf6ff"]];
    const item = drawGachaItem();
    const key = Date.now();
    const quick = reducedRef.current;
    setGacha({ step: "shake", key, item, colors: palettes[Math.floor(Math.random() * palettes.length)]! });
    const c = centerOf(event.currentTarget, stageRef.current);
    // 「視差効果を減らす」ときは、出てくるまでの動きを飛ばして、景品だけを見せる
    const later = (ms: number, fn: () => void) => window.setTimeout(fn, quick ? (ms >= 4200 ? 2600 : 0) : ms);
    later(520, () => setGacha((g) => (g.key === key ? { ...g, step: "drop" } : g)));
    later(1100, () => setGacha((g) => (g.key === key ? { ...g, step: "open" } : g)));
    later(1450, () => {
      setGacha((g) => (g.key === key ? { ...g, step: "show" } : g));
      const rare = ["SSR", "UR", "LR", "MR"].includes(item.rarity);
      spawn(rare ? "confetti" : "sparkle", c.x + 4, c.y - 14, rare ? 18 : 8, rare ? 1.6 : 1);
    });
    later(4200, () => setGacha((g) => (g.key === key ? { ...g, step: "idle" } : g)));
  };

  // ---------------------------------------------------------------- 写真・道しるべ・歩数
  const onPhoto = (event: React.MouseEvent<HTMLButtonElement>, id: string) => {
    touch();
    setPhotos((m) => {
      const cur = m[id]!;
      return { ...m, [id]: { flipped: !cur.flipped, likes: cur.likes + 1, key: cur.key + 1 } };
    });
    const c = centerOf(event.currentTarget, stageRef.current);
    spawn("heart", c.x, c.y, 5, 0.7);
  };
  const onSign = (event: React.MouseEvent<HTMLButtonElement>, id: string, text: string) => {
    touch();
    setSigns((m) => ({ ...m, [id]: (m[id] ?? 0) + 1 }));
    setSignSay({ id, key: Date.now() });
    const c = centerOf(event.currentTarget, stageRef.current);
    spawn("star", c.x, c.y, 7, 0.8);
    say(text, c.x - 8, c.y - 6, "gold");
  };
  const onHouse = (event: React.MouseEvent<HTMLButtonElement>) => {
    touch();
    setHouse((k) => k + 1);
    const c = centerOf(event.currentTarget, stageRef.current);
    spawn("sparkle", c.x, c.y - 2, 5, 0.6);
    say("マイルーム", c.x, c.y - 7, "ink");
  };
  const onSteps = () => {
    touch();
    setPawKey((k) => k + 1);
    // 道のうえに足あとを、手前から奥へ
    for (let i = 0; i < 6; i++) {
      window.setTimeout(() => spawn("paw", 50 + (i % 2 ? 3 : -3) * (1 - i / 8), 92 - i * 6.5, 1, 0.1), i * 120);
    }
  };

  // ---------------------------------------------------------------- コイン
  const onCoin = (event: React.MouseEvent<HTMLButtonElement>, coin: Coin) => {
    event.stopPropagation();
    touch();
    if (coin.state === "taken" || coin.state === "gone") return;
    setCoins((list) => list.map((c) => (c.id === coin.id ? { ...c, state: "taken" } : c)));
    window.setTimeout(() => setCoins((list) => list.filter((c) => c.id !== coin.id)), 900);
    spawn(coin.tier === "common" ? "sparkle" : "confetti", coin.x, coin.y, coin.tier === "epic" ? 18 : coin.tier === "rare" ? 10 : 5, coin.tier === "epic" ? 1.5 : 1);
    say(coin.tier === "epic" ? "おおばん！" : coin.tier === "rare" ? "きらきら！" : "ゲット！", coin.x, coin.y - 6, coin.kind === "blue" ? "blue" : "gold");
    if (!coinToastShown.current) {
      coinToastShown.current = true;
      setToast("コインは ホームの空からも 降ってくるよ");
      window.setTimeout(() => setToast(null), 2600);
    }
  };

  // ---------------------------------------------------------------- 犬をタップ
  const onDog = (event: React.MouseEvent<HTMLButtonElement>) => {
    touch();
    if (!dogArrived || leaving) return;
    lastDogTouch.current = Date.now();
    const now = Date.now();
    dogTaps.current = [...dogTaps.current.filter((t) => now - t < 2200), now];
    const c = centerOf(event.currentTarget, stageRef.current);
    if (dogTaps.current.length >= 5) {
      dogTaps.current = [];
      setDog((d) => ({ ...d, pose: "trot", jump: d.jump + 1, spin: true }));
      spawn("confetti", c.x, c.y - 6, 22, 1.8);
      spawn("heart", c.x, c.y - 8, 6, 1);
      setBubble({ id: now, text: "だいすき！" });
      window.setTimeout(() => setDog((d) => ({ ...d, spin: false, pose: "stand-happy" })), 1100);
      return;
    }
    const reaction = DOG_REACTIONS[dogTapCount.current % DOG_REACTIONS.length]!;
    dogTapCount.current += 1;
    setDog((d) => ({ ...d, pose: reaction.pose, jump: d.jump + 1, spin: false }));
    spawn(reaction.fx, c.x, c.y - 10, reaction.fx === "note" ? 4 : 6, 0.9);
    setBubble({ id: now, text: reaction.say });
  };

  // ---------------------------------------------------------------- はじめる
  const onStart = () => {
    if (leaving) return;
    setLeaving(true);
    setHint(false);
    setDog((d) => ({ ...d, pose: "cheer", jump: d.jump + 1, walking: false }));
    window.setTimeout(onFinish, reducedRef.current ? 260 : 1050);
  };

  // ---------------------------------------------------------------- 描画
  const activePose: DogPose = dog.walking ? (stepUp ? "walk" : "stand") : dog.pose;
  const routeD = (() => {
    const pts = [...MAP_PINS].reverse().map((p) => [p.x, p.y / MAP_RATIO] as const);
    let d = `M ${pts[0]![0]} ${pts[0]![1]}`;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1]!;
      const [x1, y1] = pts[i]!;
      const mx = (x0 + x1) / 2;
      const my = (y0 + y1) / 2 - 6;
      d += ` Q ${mx} ${my} ${x1} ${y1}`;
    }
    return d;
  })();

  return (
    <main
      data-app-splash=""
      data-phase={phase}
      data-weather={weather}
      className={`${styles.root} ${leaving ? styles.leaving : ""}`}
      aria-label="おでかけ記録のスタート画面"
      style={{ ["--dog-x" as string]: `${dog.x}%` }}
    >
      {/* ---------- 空 ---------- */}
      <div className={styles.sky} aria-hidden="true">
        <span className={`${styles.skyLayer} ${styles.skyMorning}`} />
        <span className={`${styles.skyLayer} ${styles.skyDay}`} />
        <span className={`${styles.skyLayer} ${styles.skyEvening}`} />
        <span className={`${styles.skyLayer} ${styles.skyNight}`} />
        <span className={styles.stars}>
          {STARS.map(([x, y, d], i) => (
            <i key={i} style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${d}s` }} />
          ))}
        </span>
        <span className={styles.weatherShade} />
        {rainbowKey > 0 ? <span key={rainbowKey} className={styles.rainbow} /> : null}
        <span className={`${styles.cloud} ${styles.cloud1}`} />
        <span className={`${styles.cloud} ${styles.cloud2}`} />
        <span className={`${styles.cloud} ${styles.cloud3}`} />
      </div>

      <div ref={stageRef} className={styles.stage} onPointerDown={onSkyPointer}>
        {/* ---------- 歩数・お天気 ---------- */}
        <button type="button" className={styles.steps} onClick={onSteps} aria-label={steps === null ? "てくてく" : `今日の歩数 ${steps}歩`}>
          <span key={pawKey} className={styles.stepsPaw} aria-hidden="true">
            <svg viewBox="0 0 24 24"><g fill="currentColor"><ellipse cx="12" cy="15.5" rx="5" ry="4.2" /><ellipse cx="6" cy="10" rx="2" ry="2.5" /><ellipse cx="9.6" cy="6.4" rx="2.1" ry="2.6" /><ellipse cx="14.4" cy="6.4" rx="2.1" ry="2.6" /><ellipse cx="18" cy="10" rx="2" ry="2.5" /></g></svg>
          </span>
          <span className={styles.stepsText}>
            <small>{steps === null ? "おさんぽ" : "今日の歩数"}</small>
            <b>{steps === null ? "てくてく" : `${stepsShown.toLocaleString("ja-JP")}歩`}</b>
          </span>
        </button>

        <button type="button" className={styles.sun} onClick={onSun} aria-label={`お天気をかえる（いまは${WEATHER_LABEL[weather]}）`}>
          <span key={sunKey} className={`${styles.sunBody} ${sunKey ? styles.sunBounce : ""}`}>
            {phase === "night" ? (
              <svg viewBox="0 0 64 64" aria-hidden="true">
                <defs>
                  <radialGradient id="splash-moon" cx="0.4" cy="0.35" r="0.7"><stop offset="0" stopColor="#fffbe6" /><stop offset="1" stopColor="#f3d98a" /></radialGradient>
                </defs>
                <circle cx="32" cy="32" r="26" fill="rgba(255,240,180,.18)" />
                <path d="M40 10a22 22 0 1 0 14 34A19 19 0 0 1 40 10Z" fill="url(#splash-moon)" />
                <path d="M26 33q3 3 6 0" stroke="#8a6a3a" strokeWidth="1.8" fill="none" strokeLinecap="round" />
                <path d="M20 27q2.5 -2 5 0" stroke="#8a6a3a" strokeWidth="1.8" fill="none" strokeLinecap="round" />
                <circle cx="20" cy="34" r="2.4" fill="#f6a9a0" opacity=".6" />
              </svg>
            ) : (
              <svg viewBox="0 0 64 64" aria-hidden="true">
                <defs>
                  <radialGradient id="splash-sun" cx="0.4" cy="0.35" r="0.7"><stop offset="0" stopColor="#fff6c9" /><stop offset="1" stopColor={phase === "evening" ? "#ff9d5c" : "#ffc93d"} /></radialGradient>
                </defs>
                <g className={styles.sunRays} fill={phase === "evening" ? "#ffb27a" : "#ffd35c"}>
                  {Array.from({ length: 10 }, (_, i) => (
                    <path key={i} d="M32 2 L35 11 L29 11 Z" transform={`rotate(${i * 36} 32 32)`} />
                  ))}
                </g>
                <circle cx="32" cy="32" r="17" fill="url(#splash-sun)" />
                <circle cx="26" cy="31" r="1.9" fill="#7a5530" />
                <circle cx="38" cy="31" r="1.9" fill="#7a5530" />
                <path d="M28 37q4 3.5 8 0" stroke="#7a5530" strokeWidth="1.8" fill="none" strokeLinecap="round" />
                <circle cx="23" cy="36" r="2.4" fill="#ff9c8a" opacity=".55" />
                <circle cx="41" cy="36" r="2.4" fill="#ff9c8a" opacity=".55" />
              </svg>
            )}
          </span>
          <span className={styles.sunLabel}>{WEATHER_LABEL[weather]}</span>
        </button>

        {/* ---------- 気球 ---------- */}
        <button type="button" className={styles.balloon} onClick={onBalloon} aria-label="気球">
          <span key={balloonKey} className={`${styles.balloonBody} ${balloonKey ? styles.balloonLoop : ""}`} aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/splash/balloon.webp" alt="" draggable={false} />
          </span>
        </button>

        {/* ---------- タイトル ---------- */}
        <div className={styles.title}>
          <h1>
            <button type="button" key={titleWave} className={`${styles.titleText} ${titleWave ? styles.titleWave : ""}`} onClick={onTitle}>
              {"自分の旅".split("").map((ch, i) => (
                <span key={i} style={{ ["--i" as string]: i }}>{ch}</span>
              ))}
            </button>
          </h1>
          <svg className={styles.titleLine} viewBox="0 0 220 16" aria-hidden="true">
            <path d="M6 10 C 50 3, 110 14, 214 6" />
          </svg>
          <p className={styles.subtitle}>おでかけの記録を、一生の思い出に。</p>
        </div>

        {/* ---------- 日本地図 ---------- */}
        <div className={styles.map}>
          <div className={styles.mapFloat}>
          <button type="button" className={styles.mapBody} onClick={onMap} aria-label="旅のルートをえがく">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/splash/japan.webp" alt="" draggable={false} />
          </button>
          <svg className={styles.route} viewBox={`0 0 100 ${100 / MAP_RATIO}`} aria-hidden="true" data-on={route > 0 ? "" : undefined}>
            <path key={route} ref={routePathRef} d={routeD} />
            <g ref={planeRef} className={styles.plane}>
              <path d="M3 0 L-2.4 -2.2 L-1.4 0 L-2.4 2.2 Z" />
              <path d="M0.4 0 L-1 -3.6 L-1.8 -3.6 L-1 0 L-1.8 3.6 L-1 3.6 Z" opacity=".85" />
            </g>
          </svg>
          {MAP_PINS.map((pin, i) => (
            <button
              type="button"
              key={pin.code}
              className={`${styles.pin} ${stamped[pin.code] ? styles.pinVisited : ""}`}
              style={{ left: `${pin.x}%`, top: `${pin.y}%`, ["--i" as string]: i }}
              onClick={(e) => onPin(e, pin.code, pin.name)}
              aria-label={`${pin.name}に訪問スタンプ`}
            >
              <span className={styles.pinHead} />
              {stamped[pin.code] ? <span key={stamped[pin.code]} className={styles.stamp}>済</span> : null}
              {pinTag?.code === pin.code ? <span key={pinTag.key} className={styles.pinTag}>{pin.name}</span> : null}
            </button>
          ))}
          </div>
        </div>

        {/* ---------- 地面 ---------- */}
        <div className={styles.ground} aria-hidden="true">
          <span className={styles.mountains} />
          <span className={styles.hillBack} />
          <span className={styles.road} />
          <span className={styles.hillFront} />
          <span className={styles.footprints}>
            {Array.from({ length: 7 }, (_, i) => {
              const t = i / 7;
              return (
                <svg
                  key={i}
                  viewBox="0 0 24 24"
                  style={{
                    left: `${50 + (i % 2 ? 1 : -1) * (3.2 * (1 - t) + 0.4)}%`,
                    bottom: `${4 + t * 64}%`,
                    width: `${22 * (1 - t * 0.72)}px`,
                    animationDelay: `${i * 0.38}s`,
                  }}
                >
                  <g fill="currentColor"><ellipse cx="12" cy="15.5" rx="5" ry="4.2" /><ellipse cx="6" cy="10" rx="2" ry="2.5" /><ellipse cx="9.6" cy="6.4" rx="2.1" ry="2.6" /><ellipse cx="14.4" cy="6.4" rx="2.1" ry="2.6" /><ellipse cx="18" cy="10" rx="2" ry="2.5" /></g>
                </svg>
              );
            })}
          </span>
          <span className={styles.flowers}>
            {[8, 18, 31, 68, 80, 91].map((x, i) => (
              <i key={x} style={{ left: `${x}%`, ["--i" as string]: i }} />
            ))}
          </span>
        </div>

        {/* ---------- マイルーム（遠くの小さな家）：タップで明かりがつき、えんとつから煙 ---------- */}
        <button type="button" className={`${styles.house} ${house ? styles.houseLit : ""}`} onClick={onHouse} aria-label="マイルーム">
          <span key={house} className={`${styles.houseBody} ${house ? styles.houseBump : ""}`} aria-hidden="true">
            <i className={styles.houseShadow} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/splash/house.webp" alt="" draggable={false} />
            {/* 窓の明かり（夜と、タップしたとき） */}
            <i className={`${styles.houseWindow} ${styles.houseWindowLeft}`} />
            <i className={`${styles.houseWindow} ${styles.houseWindowRight}`} />
            {/* えんとつの煙 */}
            <i className={styles.smoke} />
            <i className={styles.smoke} />
            <i className={styles.smoke} />
          </span>
        </button>
        {/* 家のとなり（左）の、遠くの木 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.backTree} src="/splash/tree-b.webp" alt="" aria-hidden="true" draggable={false} />

        {/* ---------- 写真（ひもに吊るしたポラロイド） ---------- */}
        <div className={styles.bunting}>
          {/* ひもの両はしは、木の横にのびた枝の先に結んである（右の木は左右反転した絵） */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={`${styles.tree} ${styles.treeLeft}`} src="/splash/tree-a.webp" alt="" aria-hidden="true" draggable={false} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={`${styles.tree} ${styles.treeRight}`} src="/splash/tree-a-flip.webp" alt="" aria-hidden="true" draggable={false} />
          <svg className={styles.string} viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true">
            <path d={STRING_D} />
            {/* 両はしは木の枝に結んである */}
            <circle className={styles.knot} cx="0.6" cy={STRING_END} r="0.9" />
            <circle className={styles.knot} cx="99.4" cy={STRING_END} r="0.9" />
          </svg>
          {POLAROIDS.map((photo, i) => {
            const state = photos[photo.id]!;
            const x = 20 + i * 30;
            return (
              <button
                type="button"
                key={photo.id}
                className={`${styles.photo} ${state.flipped ? styles.photoFlipped : ""}`}
                // 写真の上はしを、ひもの少し上に。クリップ（上へ 6px はみ出す）がひもを挟む
                style={{ left: `${x}%`, top: `calc(${stringTopAt(x).toFixed(2)}% - 2px)`, ["--tilt" as string]: `${photo.tilt}deg`, ["--i" as string]: i }}
                onClick={(e) => onPhoto(e, photo.id)}
                aria-label={`写真「${photo.caption}」いいね ${state.likes}`}
              >
                <span className={styles.photoInner}>
                  <span className={styles.photoFront}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.src} alt="" draggable={false} loading="lazy" />
                  </span>
                  <span className={styles.photoBack}>
                    <span className={styles.photoHeart} key={state.key}>♥</span>
                    <b>{state.likes}</b>
                    <small>{photo.caption}</small>
                  </span>
                </span>
                <span className={styles.clip} aria-hidden="true" />
              </button>
            );
          })}
        </div>

        {/* ---------- ガチャ ---------- */}
        <div className={styles.gacha}>
          <button
            type="button"
            className={`${styles.gachaMachine} ${gacha.step === "shake" ? styles.shake : ""}`}
            key={`m-${gacha.key}-${gacha.step === "shake"}`}
            onClick={onGacha}
            aria-label="ガチャをまわす"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/splash/gacha-machine.webp" alt="" draggable={false} />
          </button>
          {gacha.step !== "idle" && gacha.item ? (
            <>
              {gacha.step !== "show" ? (
                <span
                  key={gacha.key}
                  className={`${styles.capsule} ${gacha.step === "drop" ? styles.capsuleDrop : ""} ${gacha.step === "open" ? styles.capsuleOpen : ""}`}
                  style={{ ["--c1" as string]: gacha.colors[0], ["--c2" as string]: gacha.colors[1] }}
                  aria-hidden="true"
                >
                  <i />
                  <i />
                </span>
              ) : null}
              {gacha.step === "show" ? (
                <span key={`i-${gacha.key}`} className={styles.prize} role="status" style={{ ["--glow" as string]: RARITY_COLOR[gacha.item.rarity].glow }}>
                  <span className={styles.prizeRays} aria-hidden="true" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/splash/items/${gacha.item.id}.webp`} alt="" draggable={false} />
                  <span className={styles.prizeBand} style={{ background: RARITY_COLOR[gacha.item.rarity].band, color: RARITY_COLOR[gacha.item.rarity].text }}>
                    <b>{gacha.item.rarity}</b>
                    {gacha.item.name}
                  </span>
                </span>
              ) : null}
            </>
          ) : null}
        </div>

        {/* ---------- ミニゲームの道しるべ ---------- */}
        <div className={styles.signpost}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.post} src="/splash/signpost.webp" alt="" aria-hidden="true" draggable={false} />
          <span className={styles.signTop}>ミニゲーム</span>
          {GAME_SIGNS.map((sign, i) => (
            <button
              type="button"
              key={sign.id}
              className={`${styles.sign} ${i ? styles.sign2 : styles.sign1}`}
              onClick={(e) => onSign(e, sign.id, sign.say)}
              aria-label={sign.label}
            >
              <span key={signs[sign.id] ?? 0} className={styles.signBoard}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className={styles.signWood} src={`/splash/sign-board-${i + 1}.webp`} alt="" draggable={false} />
                <span className={styles.signText}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={sign.icon} alt="" draggable={false} className={signSay?.id === sign.id ? styles.signIconHop : ""} key={signSay?.id === sign.id ? signSay.key : 0} />
                  <span>
                    {sign.lines[0]}
                    <br />
                    {sign.lines[1]}
                  </span>
                </span>
              </span>
            </button>
          ))}
        </div>

        {/* ---------- コイン ---------- */}
        {coins.map((coin) => (
          <button
            type="button"
            key={coin.id}
            className={`${styles.coin} ${styles[`coin_${coin.state}`]} ${styles[`tier_${coin.tier}`]}`}
            style={{ left: `${coin.x}%`, top: `${coin.y}%`, ["--fall" as string]: `${coin.fallPx}px` }}
            onClick={(e) => onCoin(e, coin)}
            aria-label={coin.kind === "blue" ? "青コイン" : "コイン"}
          >
            <span className={styles.coinShadow} aria-hidden="true" />
            <span className={styles.coinFall}>
              <span className={styles.coinSpin}>
                <HomeCoinArt kind={coin.kind} tier={coin.tier} />
              </span>
            </span>
          </button>
        ))}

        {/* ---------- 相棒の犬 ---------- */}
        <div className={`${styles.dog} ${dog.walking ? styles.dogWalking : ""} ${dogArrived ? styles.dogArrived : ""}`} style={{ left: `${dog.x}%` }}>
          {bubble ? (
            <span key={bubble.id} className={styles.bubble}>
              {bubble.text}
            </span>
          ) : null}
          <button type="button" className={styles.dogButton} onClick={onDog} aria-label="相棒の犬">
            <span key={dog.jump} className={`${styles.dogLayer} ${dog.jump ? styles.dogJump : ""} ${dog.spin ? styles.dogSpin : ""}`}>
              <span className={styles.dogBob}>
                {skin
                  ? DOG_POSES.map((pose) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={pose}
                        src={getFrenchieSrc(skin, pose)}
                        alt=""
                        draggable={false}
                        width={300}
                        height={254}
                        loading={pose === "walk" || pose === "stand" || pose === "stand-happy" ? "eager" : "lazy"}
                        className={pose === "stand" ? styles.dogBase : styles.dogPose}
                        style={{ opacity: pose === activePose ? 1 : 0 }}
                      />
                    ))
                  : null}
              </span>
            </span>
            <span className={styles.dogShadow} aria-hidden="true" />
          </button>
        </div>

        {/* ---------- 天気の粒 ---------- */}
        <div className={styles.weather} aria-hidden="true">
          {weather !== "clear"
            ? WEATHER_DROPS.map((d, i) => (
                <i
                  key={`${weather}-${i}`}
                  style={{ left: `${d.x}%`, animationDelay: `${d.delay}s`, animationDuration: `${(weather === "rain" ? 0.7 : weather === "snow" ? 5 : 6) * d.dur}s`, ["--s" as string]: d.size }}
                />
              ))
            : null}
        </div>

        {/* ---------- 紙ひこうき・流れ星 ---------- */}
        {flyers.map((f) => (
          <span key={f.id} className={f.kind === "plane" ? styles.paperPlane : styles.comet} style={{ left: `${f.x}%`, top: `${f.y}%` }} aria-hidden="true">
            {f.kind === "plane" ? (
              <svg viewBox="0 0 40 24">
                <path d="M38 2 L2 11 L14 14 Z" fill="#fff" />
                <path d="M38 2 L14 14 L18 22 Z" fill="#dfe8f5" />
                <path d="M38 2 L14 14" stroke="#b8c6dc" strokeWidth=".8" />
              </svg>
            ) : null}
          </span>
        ))}

        {/* ---------- きらきら・ハートなど ---------- */}
        <div className={styles.fxLayer} aria-hidden="true">
          {fx.map((f) => (
            <i
              key={f.id}
              className={styles[`fx_${f.kind}`]}
              style={{
                left: `${f.x}%`,
                top: `${f.y}%`,
                animationDelay: `${f.delay}ms`,
                ["--dx" as string]: `${f.dx * 4}px`,
                ["--dy" as string]: `${f.dy * 4}px`,
                ["--rot" as string]: `${f.rot}deg`,
                ["--hue" as string]: f.hue,
              } as CSSProperties}
            >
              {f.kind === "heart" ? "♥" : f.kind === "note" ? "♪" : null}
            </i>
          ))}
          {labels.map((l) => (
            <span key={l.id} className={`${styles.label} ${styles[`label_${l.tone}`]}`} style={{ left: `${l.x}%`, top: `${l.y}%` }}>
              {l.text}
            </span>
          ))}
        </div>

        {/* ---------- 下：ヒントと、はじめる ---------- */}
        {toast ? <p className={styles.toast}>{toast}</p> : null}
        <p className={`${styles.hint} ${hint && !leaving ? styles.hintOn : ""}`} aria-hidden={!hint}>
          いろんなところを タップしてみてね
        </p>
        <button type="button" className={styles.start} onClick={onStart} disabled={leaving}>
          <span className={styles.startShine} aria-hidden="true" />
          <svg viewBox="0 0 24 24" aria-hidden="true"><g fill="currentColor"><ellipse cx="12" cy="15.5" rx="5" ry="4.2" /><ellipse cx="6" cy="10" rx="2" ry="2.5" /><ellipse cx="9.6" cy="6.4" rx="2.1" ry="2.6" /><ellipse cx="14.4" cy="6.4" rx="2.1" ry="2.6" /><ellipse cx="18" cy="10" rx="2" ry="2.5" /></g></svg>
          はじめる
        </button>
      </div>

      {/* 白くひらく幕（開くときにだけ見える） */}
      <span className={styles.curtain} aria-hidden="true" />
    </main>
  );
}
