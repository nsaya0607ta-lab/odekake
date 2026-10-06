"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { GachaRarity } from "@/lib/gacha/config";
import { LEVEL_REWARDS, getTotalExpForLevel } from "@/lib/exp";
import { CapsuleArt } from "@/components/gacha/capsule-art";
import { BlueCoinArt, CoinArt, GachaMachineArt } from "@/components/coin-art";
import { HomeCoinArt } from "@/components/home-coin-art";
import {
  GACHA_DUPLICATE_COINS,
  GACHA_PLANS,
  GUIDE_RARITIES,
  GUIDE_RATES,
  HOME_DROP,
  LEVEL_MILESTONE_COIN_BONUSES,
  LOGIN_BONUS_SCHEDULE,
  SKILL_LEVEL_THRESHOLDS,
  STEP_EXP_MARKS,
  VISIT_EXP,
  levelUpCoins,
  stepCoins,
  stepExp,
} from "./guide-data";
import styles from "./rulebook.module.css";

const TABS = [
  { id: "start", label: "はじめに", emoji: "📖" },
  { id: "record", label: "記録・地図", emoji: "🗾" },
  { id: "level", label: "レベル・コイン", emoji: "⭐" },
  { id: "gacha", label: "ガチャ・図鑑", emoji: "🎁" },
  { id: "games", label: "ミニゲーム", emoji: "🎮" },
  { id: "room", label: "おへや・ショップ", emoji: "🏠" },
  { id: "home", label: "ホーム", emoji: "🐶" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const isTab = (value: string): value is TabId => TABS.some((tab) => tab.id === value);

/** アプリのルールブック。タブで分け、数字はアプリ本体と同じものを使ったシミュレーターで見せる */
export function Rulebook() {
  const [tab, setTab] = useState<TabId>("start");
  const tabsRef = useRef<HTMLDivElement>(null);

  // URL の #タブ名 で開く・戻る
  useEffect(() => {
    const fromHash = () => {
      const hash = window.location.hash.slice(1);
      if (isTab(hash)) setTab(hash);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, []);

  const choose = useCallback((next: TabId) => {
    setTab(next);
    window.history.replaceState(null, "", `#${next}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // 選んだタブを、タブの列のまん中へ
  useEffect(() => {
    const active = tabsRef.current?.querySelector<HTMLElement>(`[data-tab="${tab}"]`);
    active?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [tab]);

  const index = TABS.findIndex((item) => item.id === tab);
  const prev = TABS[index - 1];
  const next = TABS[index + 1];

  return (
    <div className={styles.book}>
      <div className={styles.tabs} ref={tabsRef} role="tablist" aria-label="ルールブックの章">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            data-tab={item.id}
            aria-selected={tab === item.id}
            className={styles.tab}
            onClick={() => choose(item.id)}
          >
            <span aria-hidden="true">{item.emoji}</span>
            {item.label}
          </button>
        ))}
      </div>

      <div key={tab} className={styles.page} role="tabpanel">
        {tab === "start" ? <StartChapter onGo={choose} /> : null}
        {tab === "record" ? <RecordChapter /> : null}
        {tab === "level" ? <LevelChapter /> : null}
        {tab === "gacha" ? <GachaChapter /> : null}
        {tab === "games" ? <GamesChapter /> : null}
        {tab === "room" ? <RoomChapter /> : null}
        {tab === "home" ? <HomeChapter /> : null}
      </div>

      <nav className={styles.pager} aria-label="前後の章">
        {prev ? (
          <button type="button" onClick={() => choose(prev.id)}>
            ← {prev.label}
          </button>
        ) : <span />}
        {next ? (
          <button type="button" className={styles.pagerNext} onClick={() => choose(next.id)}>
            {next.label} →
          </button>
        ) : null}
      </nav>
    </div>
  );
}

/* ------------------------------------------------------------------ 部品 */

function Section({ title, kicker, children }: { title: string; kicker?: string; children: ReactNode }) {
  return (
    <section className={styles.section}>
      {kicker ? <p className={styles.kicker}>{kicker}</p> : null}
      <h2 className={styles.h2}>{title}</h2>
      {children}
    </section>
  );
}

function Hero({ title, lead, art }: { title: string; lead: string; art: ReactNode }) {
  return (
    <header className={styles.hero}>
      <div className={styles.heroArt} aria-hidden="true">{art}</div>
      <div>
        <h1 className={styles.h1}>{title}</h1>
        <p className={styles.lead}>{lead}</p>
      </div>
    </header>
  );
}

function Tip({ children }: { children: ReactNode }) {
  return <p className={styles.tip}>{children}</p>;
}

function Num({ value, unit }: { value: number; unit?: string }) {
  return (
    <b className={styles.num}>
      {value.toLocaleString()}
      {unit ? <small>{unit}</small> : null}
    </b>
  );
}

/** 本物の画面を小さく見せる、スマホのわく */
function Phone({ children, label }: { children: ReactNode; label: string }) {
  return (
    <figure className={styles.phone} aria-label={label}>
      <div className={styles.phoneScreen}>{children}</div>
      <figcaption>{label}</figcaption>
    </figure>
  );
}

/* ------------------------------------------------------------------ はじめに */

const NAV = [
  { id: "home", label: "ホーム", icon: "/icons/navigation/home.webp", text: "わんこと今日の歩数・レベル・コイン。カードを並べかえたり、横にスワイプして背景だけ眺めたりできます。" },
  { id: "sns", label: "SNS", icon: "/icons/navigation/sns.svg", text: "おでかけの写真を、フレンドやグループと見せ合います。" },
  { id: "map", label: "地図", icon: "/icons/navigation/map.webp", text: "行った市区町村が日本地図に色づいていきます。" },
  { id: "add", label: "追加", icon: "/icons/navigation/add.webp", text: "行った場所を登録・旅行を作る入口。ここから記録が始まります。" },
  { id: "records", label: "記録", icon: "/icons/navigation/records.webp", text: "訪問・旅行・スポットの一覧。お気に入りや また行きたい もここ。" },
  { id: "shop", label: "ショップ", icon: "/icons/navigation/shop.svg", text: "青コインで、アプリ全体の背景を買えます。" },
  { id: "mypage", label: "マイページ", icon: "/icons/navigation/mypage.webp", text: "プロフィール・コインの履歴・歩数の連携・わんこの着せかえなど。" },
] as const;

const LOOP = [
  { label: "おでかけ", sub: "記録する", emoji: "🚶" },
  { label: "コイン", sub: "たまる", emoji: "🪙" },
  { label: "ガチャ", sub: "回す", emoji: "🎁" },
  { label: "図鑑", sub: "スキルが育つ", emoji: "📕" },
  { label: "ゲーム", sub: "高得点", emoji: "🎮" },
] as const;

function StartChapter({ onGo }: { onGo: (tab: TabId) => void }) {
  const [nav, setNav] = useState<(typeof NAV)[number]["id"]>("home");
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setStep((current) => (current + 1) % LOOP.length), 1500);
    return () => window.clearInterval(id);
  }, []);
  const current = NAV.find((item) => item.id === nav) ?? NAV[0];

  return (
    <>
      <Hero
        title="ルールブック"
        lead="出かけるほど、わんことアプリが育っていく。このアプリのしくみを、ぜんぶここにまとめました。"
        art={<Image src="/splash/gacha-machine.webp" alt="" width={84} height={123} />}
      />

      <Section kicker="しくみ" title="おでかけが、ぜんぶつながっている">
        <div className={styles.loop}>
          {LOOP.map((item, i) => (
            <div key={item.label} className={styles.loopNode} data-active={i === step}>
              <span className={styles.loopEmoji}>{item.emoji}</span>
              <b>{item.label}</b>
              <small>{item.sub}</small>
            </div>
          ))}
          <svg className={styles.loopRing} viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" r="38" />
          </svg>
        </div>
        <p className={styles.body}>
          場所を記録したり歩いたりすると <b>EXP</b> と <b>コイン</b> がたまります。コインでガチャを回して <b>図鑑</b> を集めると、
          アイテムの <b>スキル</b> が育ち、ミニゲームでもっと点が取れるように。ミニゲームでもコインがもらえて、また回せます。
        </p>
      </Section>

      <Section kicker="画面の見かた" title="下のナビをさわってみよう">
        <div className={styles.navDemo}>
          <div className={styles.navText} aria-live="polite">
            <b>{current.label}</b>
            <p>{current.text}</p>
          </div>
          <div className={styles.navBar} role="group" aria-label="ナビの見本">
            {NAV.map((item) => (
              <button key={item.id} type="button" data-active={nav === item.id} onClick={() => setNav(item.id)} aria-pressed={nav === item.id}>
                <Image src={item.icon} alt="" width={26} height={26} />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </Section>

      <Section kicker="2つのコイン" title="黄色いコインと、青いコイン">
        <div className={styles.twoCol}>
          <div className={styles.coinCard}>
            <span className={styles.coinIcon}><CoinArt className="h-full w-full" /></span>
            <b>おでかけコイン</b>
            <p>歩数・ログイン・レベルアップ・ミニゲームでたまる。ガチャに使う。</p>
            <button type="button" onClick={() => onGo("level")}>ためかた →</button>
          </div>
          <div className={styles.coinCard} data-blue>
            <span className={styles.coinIcon}><BlueCoinArt className="h-full w-full" /></span>
            <b>青コイン</b>
            <p>はじめての土地・通算ログイン・おさんぽフレンチーでたまる。背景・家具・都道府県ガチャに使う。</p>
            <button type="button" onClick={() => onGo("room")}>使いみち →</button>
          </div>
        </div>
      </Section>

      <Section kicker="目次" title="知りたいところから読めます">
        <div className={styles.toc}>
          {TABS.slice(1).map((item) => (
            <button key={item.id} type="button" onClick={() => onGo(item.id)}>
              <span aria-hidden="true">{item.emoji}</span>
              {item.label}
            </button>
          ))}
        </div>
      </Section>
    </>
  );
}

/* ------------------------------------------------------------------ 記録・地図 */

function RecordChapter() {
  const [picked, setPicked] = useState<Record<string, boolean>>({ visit: true, firstSpot: true, comment: false, rating: true, firstCity: false, firstPref: false, firstRegion: false });
  const total = VISIT_EXP.reduce((sum, item) => {
    if ("always" in item && item.always) return sum + item.exp;
    if (item.id === "firstSpot") return sum + (picked.firstSpot ? item.exp : item.alt.exp);
    return sum + (picked[item.id] ? item.exp : 0);
  }, 0);
  const blue = VISIT_EXP.reduce((sum, item) => sum + ("blue" in item && picked[item.id] ? item.blue : 0), 0);

  return (
    <>
      <Hero title="記録・地図" lead="行った場所を残すほど、地図が色づき、EXPがたまります。" art={<Image src="/splash/japan.webp" alt="" width={96} height={100} />} />

      <Section kicker="記録のしかた" title="3ステップで記録">
        <ol className={styles.steps}>
          <li><b>追加</b>タブ →「行った場所を登録」</li>
          <li>地図で場所をえらび、日付・写真・感想・評価を入れる</li>
          <li>保存。同じ場所には「登録済みの場所に記録」から何度でも</li>
        </ol>
        <Tip>入力の途中で閉じても、下書きが自動で残ります。旅行をつくると、いくつもの訪問を1つにまとめられます。</Tip>
      </Section>

      <Section kicker="シミュレーター" title="この記録で、どれだけEXPがもらえる？">
        <div className={styles.sim}>
          <ul className={styles.checks}>
            {VISIT_EXP.map((item) => {
              const always = "always" in item && item.always;
              const on = always || picked[item.id];
              return (
                <li key={item.id}>
                  <label data-on={on} data-always={always}>
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={always}
                      onChange={(event) => setPicked((current) => ({ ...current, [item.id]: event.target.checked }))}
                    />
                    <span className={styles.checkLabel}>
                      {item.id === "firstSpot" && !on ? item.alt.label : item.label}
                    </span>
                    <span className={styles.checkExp}>
                      +{item.id === "firstSpot" && !on ? item.alt.exp : item.exp}
                      {"blue" in item ? <em>＋青{item.blue}</em> : null}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          <div className={styles.simResult} aria-live="polite">
            <span>この記録で</span>
            <Num value={total} unit="EXP" />
            {blue > 0 ? (
              <span className={styles.simBlue}>
                <span className={styles.miniCoin}><BlueCoinArt className="h-full w-full" /></span>＋青コイン {blue.toLocaleString()}枚
              </span>
            ) : null}
          </div>
        </div>
        <Tip>同じ市区町村で5スポット・1つの県で5市区町村のような節目にも、ボーナスEXPがあります。</Tip>
      </Section>

      <Section kicker="地図" title="色づいていく日本地図">
        <JapanFill />
        <p className={styles.body}>地図タブでは、記録した市区町村が塗られていきます。都道府県をタップすると、その県の記録が見られます。</p>
      </Section>
    </>
  );
}

function JapanFill() {
  const [filled, setFilled] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setFilled((value) => (value + 1) % 9), 700);
    return () => window.clearInterval(id);
  }, []);
  const pins = [[81.5, 15], [71, 47], [62, 66], [55, 63], [51, 63], [42, 69.5], [27, 72.6], [14.7, 79.4]];
  return (
    <div className={styles.japan}>
      <Image src="/splash/japan.webp" alt="日本地図の見本" width={320} height={334} />
      {pins.map(([x, y], i) => (
        <span key={i} className={styles.japanPin} data-on={i < filled} style={{ left: `${x}%`, top: `${y}%` }} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ レベル・コイン */

function LevelChapter() {
  const [steps, setSteps] = useState(6500);
  const [day, setDay] = useState(0);
  const [level, setLevel] = useState(10);
  useEffect(() => {
    const id = window.setInterval(() => setDay((value) => (value + 1) % 7), 900);
    return () => window.clearInterval(id);
  }, []);
  const coins = stepCoins(steps);
  const exp = stepExp(steps);
  const reward = LEVEL_REWARDS.find((item) => item.level === level);
  const total = getTotalExpForLevel(level);

  return (
    <>
      <Hero title="レベル・コイン" lead="歩いて、記録して、毎日ひらく。それだけでどんどんたまります。" art={<span className={styles.coinStack}><CoinArt className="h-full w-full" /></span>} />

      <Section kicker="シミュレーター" title="今日の歩数で、いくらもらえる？">
        <div className={styles.sim}>
          <div className={styles.stepsMeter}>
            <span className={styles.stepsValue}>{steps.toLocaleString()}<small>歩</small></span>
            <input
              type="range"
              min={0}
              max={20000}
              step={100}
              value={steps}
              onChange={(event) => setSteps(Number(event.target.value))}
              aria-label="歩数"
              className={styles.range}
            />
            <div className={styles.rangeMarks} aria-hidden="true">
              <span>0</span><span>5,000</span><span>10,000</span><span>15,000</span><span>20,000</span>
            </div>
          </div>
          <div className={styles.twoCol}>
            <div className={styles.stat}>
              <span className={styles.miniCoin}><CoinArt className="h-full w-full" /></span>
              <Num value={coins} unit="コイン" />
              <small>500歩ごとに60＋3,000歩から節目ボーナス</small>
            </div>
            <div className={styles.stat}>
              <span className={styles.statIcon}>⭐</span>
              <Num value={exp} unit="EXP" />
              <small>1,000歩から段階的に（2万歩で1,000）</small>
            </div>
          </div>
          <div className={styles.expBars} aria-hidden="true">
            {STEP_EXP_MARKS.map(([at, value]) => (
              <span key={at} data-on={steps >= at} style={{ height: `${Math.max(8, value / 10)}%` }} title={`${at}歩 ${value}EXP`} />
            ))}
          </div>
        </div>
        <Tip>歩数は「マイページ → 歩数の連携」でショートカットを設定すると自動で届きます。ホームのわんこがボードに書きこんでくれます。</Tip>
      </Section>

      <Section kicker="毎日" title="ログインボーナス（7日でひとめぐり）">
        <div className={styles.calendar}>
          {LOGIN_BONUS_SCHEDULE.map((amount, i) => (
            <div key={i} className={styles.calDay} data-today={i === day} data-done={i < day} data-big={i === 6}>
              <small>{i + 1}日目</small>
              <span className={styles.miniCoin}><CoinArt className="h-full w-full" /></span>
              <b>{amount}</b>
            </div>
          ))}
        </div>
        <Tip>開いた日を通算で数えるので、休んでも1日目には戻りません。通算7日ごとに青コイン400枚もおまけ。</Tip>
      </Section>

      <Section kicker="シミュレーター" title="レベルを上げると">
        <div className={styles.sim}>
          <div className={styles.levelRow}>
            <button type="button" onClick={() => setLevel((value) => Math.max(2, value - 1))} aria-label="レベルを下げる">−</button>
            <div className={styles.levelBadge}>
              <small>Lv.</small>
              {level}
            </div>
            <button type="button" onClick={() => setLevel((value) => Math.min(60, value + 1))} aria-label="レベルを上げる">＋</button>
          </div>
          <input type="range" min={2} max={60} value={level} onChange={(event) => setLevel(Number(event.target.value))} aria-label="レベル" className={styles.range} />
          <dl className={styles.facts}>
            <div><dt>ここまでの合計EXP</dt><dd>{total.toLocaleString()}</dd></div>
            <div><dt>レベルアップのコイン</dt><dd>{level <= 30 ? levelUpCoins(level).toLocaleString() : "必要EXPに応じて"}</dd></div>
            <div><dt>ごほうび</dt><dd>{reward ? `わんこの新しいしぐさ「${reward.name}」` : level > 30 ? "コイン（50・100・200…レベルは特別ボーナス）" : "—"}</dd></div>
          </dl>
        </div>
        <Tip>
          Lv.30まではレベルごとに、ホームのわんこが新しいしぐさを覚えます。Lv.31からは上限なし。
          {LEVEL_MILESTONE_COIN_BONUSES.map((item) => `Lv.${item.level}で+${item.coins.toLocaleString()}`).join("・")}の節目ボーナスも。
        </Tip>
      </Section>
    </>
  );
}

/* ------------------------------------------------------------------ ガチャ・図鑑 */

function drawRarity(): GachaRarity {
  const total = GUIDE_RARITIES.reduce((sum, rarity) => sum + GUIDE_RATES[rarity], 0);
  let roll = Math.random() * total;
  for (const rarity of GUIDE_RARITIES) {
    roll -= GUIDE_RATES[rarity];
    if (roll <= 0) return rarity;
  }
  return "N";
}

const RARITY_COLORS: Record<GachaRarity, string> = { N: "#cfc5b0", R: "#7fbfe8", SR: "#e8b443", SSR: "#e46fb5", UR: "#d8323c", LR: "#3a2e1e", MR: "#5b46c9" };

function GachaChapter() {
  const [results, setResults] = useState<GachaRarity[]>([]);
  const [round, setRound] = useState(0);
  const [tally, setTally] = useState<Record<string, number>>({});
  const pull = (count: number) => {
    const next = Array.from({ length: count }, drawRarity);
    setResults(next);
    setRound((value) => value + 1);
    setTally((current) => {
      const copy = { ...current };
      for (const rarity of next) copy[rarity] = (copy[rarity] ?? 0) + 1;
      return copy;
    });
  };
  const pulled = Object.values(tally).reduce((sum, value) => sum + value, 0);
  const best = useMemo(() => results.reduce<GachaRarity | null>((top, rarity) => (!top || GUIDE_RARITIES.indexOf(rarity) > GUIDE_RARITIES.indexOf(top) ? rarity : top), null), [results]);

  return (
    <>
      <Hero title="ガチャ・図鑑" lead="コインでガチャを回して、図鑑を埋めよう。同じものが出るとスキルが育ちます。" art={<span className={styles.machineArt}><GachaMachineArt className="h-full w-auto" /></span>} />

      <Section kicker="まわしかた" title="1回・10連・100連">
        <div className={styles.planRow}>
          {(Object.keys(GACHA_PLANS) as (keyof typeof GACHA_PLANS)[]).map((plan) => (
            <div key={plan} className={styles.plan}>
              <b>{GACHA_PLANS[plan].draws}回</b>
              <span><span className={styles.miniCoin}><CoinArt className="h-full w-full" /></span>{GACHA_PLANS[plan].cost.toLocaleString()}</span>
            </div>
          ))}
        </div>
        <ol className={styles.steps}>
          <li>ハンドルを指で回す（タップでもOK）。ランプが光る色で、いいものが出るか予告します</li>
          <li>出てきたカプセルをタップして開ける</li>
          <li>10連・100連は受け皿に並びます。「ぜんぶ開ける」でまとめて。SSR以上は大きな演出で開きます</li>
        </ol>
        <Tip>右上の「AUTO」でタップを待たずに進み、「×2・×3」で速くなります。いつでもスキップできます。100連はSR以上が少し出やすくなります。</Tip>
      </Section>

      <Section kicker="排出率" title="どのくらい出る？">
        <div className={styles.rateList}>
          {GUIDE_RARITIES.map((rarity) => (
            <div key={rarity} className={styles.rateRow}>
              <span className={styles.rateCapsule}><CapsuleArt rarity={rarity} small /></span>
              <b style={{ color: RARITY_COLORS[rarity] }}>{rarity}</b>
              <span className={styles.rateBar}><i style={{ width: `${Math.max(1.5, (GUIDE_RATES[rarity] / 50) * 100)}%`, background: RARITY_COLORS[rarity] }} /></span>
              <span className={styles.ratePct}>{GUIDE_RATES[rarity]}%</span>
            </div>
          ))}
        </div>
      </Section>

      <Section kicker="おためし" title="回してみよう（コインは使いません）">
        <div className={styles.sim}>
          <div className={styles.pullButtons}>
            <button type="button" onClick={() => pull(1)}>1回</button>
            <button type="button" onClick={() => pull(10)}>10連</button>
          </div>
          <div className={styles.tray} key={round} data-empty={results.length === 0}>
            {results.length === 0 ? <p>ボタンを押すと、カプセルが出てきます</p> : null}
            {results.map((rarity, i) => (
              <span key={i} className={styles.trayCapsule} style={{ animationDelay: `${i * 70}ms` }} data-rare={GUIDE_RARITIES.indexOf(rarity) >= 3}>
                <CapsuleArt rarity={rarity} small />
                <b>{rarity}</b>
              </span>
            ))}
          </div>
          {best ? <p className={styles.trayBest} aria-live="polite">いちばん良かったのは <b style={{ color: RARITY_COLORS[best] }}>{best}</b>！</p> : null}
          {pulled > 0 ? (
            <div className={styles.tally}>
              <span>これまで {pulled}回：</span>
              {GUIDE_RARITIES.map((rarity) => (tally[rarity] ? <span key={rarity}>{rarity} {tally[rarity]}</span> : null))}
              <button type="button" onClick={() => { setTally({}); setResults([]); }}>リセット</button>
            </div>
          ) : null}
        </div>
      </Section>

      <Section kicker="図鑑とスキル" title="同じアイテムが出るほど、スキルLvが上がる">
        <div className={styles.skillTable}>
          <div className={styles.skillHead}><span>レア</span>{[1, 2, 3, 4, 5].map((lv) => <span key={lv}>{lv === 5 ? "MAX" : `Lv${lv}`}</span>)}</div>
          {GUIDE_RARITIES.filter((rarity) => SKILL_LEVEL_THRESHOLDS[rarity].length > 0).map((rarity) => (
            <div key={rarity} className={styles.skillRow}>
              <b style={{ color: RARITY_COLORS[rarity] }}>{rarity}</b>
              {SKILL_LEVEL_THRESHOLDS[rarity].map((count, i) => <span key={i}>{count}個</span>)}
            </div>
          ))}
        </div>
        <Tip>
          R以上のアイテムにはミニゲーム用のスキルがあり、集めた数でLvが上がります（Nはスキルなし）。
          同じものが出たときは、コインも少し戻ります（{(Object.entries(GACHA_DUPLICATE_COINS) as [string, number][]).map(([rarity, coins]) => `${rarity} ${coins}`).join("・")}）。
        </Tip>
      </Section>
    </>
  );
}

/* ------------------------------------------------------------------ ミニゲーム */

const GAMES = [
  { id: "item-catch", name: "アイテムキャッチ", icon: "/games/item-catch/menu-icon-v2.webp", how: "箱を左右に動かして、落ちてくるお宝をキャッチ", time: "約50秒", reward: "100スコアごとに1コイン", tip: "図鑑のスキルが効く。時間が延びるアイテムもあります。ゲーム内のルールブックでスキルの効果を全部見られます。" },
  { id: "osanpo-run", name: "おさんぽフレンチー", icon: "/games/osanpo-run/menu-icon.webp", how: "タップでジャンプ。跳んで・くぐって・拾い集める", time: "エンドレス", reward: "青コイン（毎日のミッション1つ30・全部で+100、週1の協力チャレンジ100）", tip: "道には自分の図鑑アイテムが落ちています。進むほど障害物が増えます。" },
  { id: "wanko-bowling", name: "わんこボウリング", icon: "/games/wanko-bowling/menu-icon-v2.webp", how: "スワイプで投球。お気に入りのボールでストライクを狙う", time: "最後まで", reward: "倒したピンのスコア5点ごとに1コイン", tip: "ボールによって曲がり方や重さがちがいます。" },
  { id: "snack-trail", name: "わんこのおやつ道", icon: "/games/snack-trail/menu-icon-preview.webp", how: "スワイプで方向転換。おやつを集めて足あとをのばす", time: "エンドレス", reward: "ハイスコアをめざす", tip: "自分の足あとにぶつからないように。" },
] as const;

function GamesChapter() {
  const [open, setOpen] = useState<string>(GAMES[0].id);
  return (
    <>
      <Hero title="ミニゲーム" lead="すきま時間にひと遊び。図鑑で育てたスキルが、ゲームで役に立ちます。" art={<Image src="/splash/game-item-catch.webp" alt="" width={92} height={92} />} />
      <Section kicker="4つのゲーム" title="遊びかたと、もらえるもの">
        <div className={styles.gameList}>
          {GAMES.map((game) => {
            const isOpen = open === game.id;
            return (
              <article key={game.id} className={styles.game} data-open={isOpen}>
                <button type="button" className={styles.gameHead} onClick={() => setOpen(isOpen ? "" : game.id)} aria-expanded={isOpen}>
                  <Image src={game.icon} alt="" width={56} height={56} className={styles.gameIcon} />
                  <span>
                    <b>{game.name}</b>
                    <small>{game.how}</small>
                  </span>
                  <span className={styles.chev} aria-hidden="true">⌄</span>
                </button>
                {isOpen ? (
                  <div className={styles.gameBody}>
                    <dl className={styles.facts}>
                      <div><dt>プレイ時間</dt><dd>{game.time}</dd></div>
                      <div><dt>もらえるもの</dt><dd>{game.reward}</dd></div>
                    </dl>
                    <p className={styles.body}>{game.tip}</p>
                    <Link href={`/games/${game.id}`} className={styles.cta}>遊びにいく →</Link>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
        <CatchDemo />
      </Section>
    </>
  );
}

/** アイテムキャッチの見本：箱が左右に動いて、落ちてくるカプセルを受けとめる */
function CatchDemo() {
  const [score, setScore] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setScore((value) => (value >= 990 ? 0 : value + 30)), 600);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className={styles.catchDemo} aria-label="アイテムキャッチの見本アニメーション">
      <span className={styles.catchScore}>SCORE {score}</span>
      {(["R", "N", "SR", "R", "SSR"] as const).map((rarity, i) => (
        <span key={i} className={styles.catchItem} style={{ left: `${12 + i * 18}%`, animationDelay: `${i * 0.6}s` }}>
          <CapsuleArt rarity={rarity} small />
        </span>
      ))}
      <span className={styles.catchBox} />
    </div>
  );
}

/* ------------------------------------------------------------------ おへや・ショップ */

function RoomChapter() {
  return (
    <>
      <Hero title="おへや・ショップ" lead="わんこのお部屋を飾ったり、アプリの背景を変えたり。青コインの使いみちです。" art={<Image src="/splash/house.webp" alt="" width={110} height={92} />} />

      <Section kicker="青コイン" title="ためかた">
        <ul className={styles.earnList}>
          <li><span>🗺️</span>はじめての市区町村を記録<b>100</b></li>
          <li><span>🏯</span>はじめての都道府県を記録<b>600</b></li>
          <li><span>📅</span>通算ログインが7の倍数の日<b>400</b></li>
          <li><span>🐶</span>おさんぽフレンチーの毎日のミッション<b>30〜</b></li>
          <li><span>🤝</span>おさんぽフレンチーの協力チャレンジ（週1）<b>100</b></li>
          <li><span>✨</span>ホームの犬カードに降ってくる青コイン<b>5〜100</b></li>
        </ul>
      </Section>

      <Section kicker="ショップ" title="アプリ全体の背景を着せかえ">
        <div className={styles.shopDemo}>
          {["paw", "watercolor", "starry", "aurora", "dog-parade"].map((id, i) => (
            <span key={id} className={styles.swatch} data-bg={id} style={{ animationDelay: `${i * 1.6}s` }} />
          ))}
          <span className={styles.shopLabel}>ショップ → 見本をタップ →「アプリでためす」で、買う前にホームで見られます</span>
        </div>
        <Tip>動く背景・さわれる背景もあります。買った背景はいつでも「いつもの」に戻せます。</Tip>
      </Section>

      <Section kicker="おへや" title="わんこのお部屋">
        <ul className={styles.steps}>
          <li>家具を青コインで買って、好きな場所に置く</li>
          <li>おさんぽで拾った <b>おみやげ</b> を飾る。飾らない分は材料にして、壁に飾る作品をクラフトできる</li>
          <li>フレンドのお部屋にあそびに行って、おみやげを置いてこられる</li>
          <li>家具やおみやげをタップすると、わんこがいっしょに遊びます（ごきげんが上がる）</li>
        </ul>
      </Section>

      <Section kicker="都道府県ガチャ" title="ご当地アイテム">
        <p className={styles.body}>青コインで回す、ご当地の名物や観光地のアイテムが出るガチャです。ご当地のフレブルの着せかえもあります。</p>
      </Section>
    </>
  );
}

/* ------------------------------------------------------------------ ホーム */

type FallingCoin = { id: number; x: number; kind: "coin" | "blue"; tier: "common" | "rare" | "epic" };

function HomeChapter() {
  const [coins, setCoins] = useState<FallingCoin[]>([]);
  const [got, setGot] = useState(0);
  const seq = useRef(0);
  useEffect(() => {
    const id = window.setInterval(() => {
      const roll = Math.random() * 100;
      const tier = roll < HOME_DROP.tiers[2].rate ? "epic" : roll < HOME_DROP.tiers[2].rate + HOME_DROP.tiers[1].rate ? "rare" : "common";
      seq.current += 1;
      const coin: FallingCoin = { id: seq.current, x: 10 + Math.random() * 80, kind: Math.random() < 0.5 ? "blue" : "coin", tier };
      setCoins((current) => [...current.slice(-5), coin]);
    }, 1100);
    return () => window.clearInterval(id);
  }, []);

  return (
    <>
      <Hero title="ホーム" lead="わんこが暮らしている、あなたのホーム。さわって・待って・眺めて楽しめます。" art={<Image src="/splash/photo-osanpo.webp" alt="" width={92} height={92} className={styles.heroPhoto} />} />

      <Section kicker="降ってくるコイン" title={`${HOME_DROP.everySeconds}秒ごとに${HOME_DROP.chance}%で、空からコイン`}>
        <div className={styles.dropStage} aria-label="コインが降ってくる見本。タップで拾えます">
          {coins.map((coin) => (
            <button
              key={coin.id}
              type="button"
              className={styles.dropCoin}
              data-tier={coin.tier}
              style={{ left: `${coin.x}%` }}
              onClick={() => {
                const amount = HOME_DROP.tiers.find((item) => item.tier === coin.tier)?.amount ?? 5;
                setGot((value) => value + amount);
                setCoins((current) => current.filter((item) => item.id !== coin.id));
              }}
              aria-label="コインを拾う"
            >
              <HomeCoinArt kind={coin.kind} tier={coin.tier} />
            </button>
          ))}
          <span className={styles.dropGot}>拾った：{got}枚</span>
        </div>
        <div className={styles.tierRow}>
          {HOME_DROP.tiers.map((item) => (
            <div key={item.tier} className={styles.tier}>
              <span className={styles.tierCoin}><HomeCoinArt kind="coin" tier={item.tier} /></span>
              <span className={styles.tierCoin}><HomeCoinArt kind="blue" tier={item.tier} /></span>
              <b>{item.label}</b>
              <small>{item.rate}%・{item.amount}枚</small>
            </div>
          ))}
        </div>
        <Tip>落ちたコインは、わんこが走って取りに行ってくれます。黄色と青は半々。</Tip>
      </Section>

      <Section kicker="ホームでできること" title="さわってみよう">
        <div className={styles.featureGrid}>
          {[
            ["✍️", "歩数を書く", "アプリを開くと、わんこがペンで今日の歩数をボードに書きこみます"],
            ["🐾", "奥・手前に歩く", "わんこは奥へ行くと小さく、手前に来ると大きく見えます"],
            ["👆", "カードの並べかえ", "ホームのカードは順番を入れかえられます"],
            ["🌅", "背景だけ見る", "ホームを横にスワイプすると、背景だけをゆっくり眺められます"],
            ["🌦️", "天気と時間", "空の色や天気が、時間に合わせて変わります"],
            ["📚", "このルールブック", "右上の本のアイコンから、いつでも開けます"],
          ].map(([emoji, title, text]) => (
            <div key={title} className={styles.feature}>
              <span>{emoji}</span>
              <b>{title}</b>
              <small>{text}</small>
            </div>
          ))}
        </div>
      </Section>

      <Phone label="右上のアイコン">
        <div className={styles.headerDemo}>
          <span className={styles.headerAvatar} />
          <span className={styles.headerName} />
          <span className={styles.headerCoins} />
          <span className={styles.headerGuide}>📖</span>
          <span className={styles.headerFriend}>👥</span>
        </div>
      </Phone>
    </>
  );
}
