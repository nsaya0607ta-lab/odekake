"use client";

import { WhiteCoinArt } from "@/components/coin-art";
import { TOWN_QUESTS, TOWN_RANKS, WHITE_LOGIN_COINS, townLevelReward, townLevelXp, townProgress, townRank, type TownSnapshot } from "@/lib/games/town-progression";
import styles from "./town-builder.module.css";

export function TownCrest({ level, large = false }: { level: number; large?: boolean }) {
  const rank = townRank(level);
  return <span className={`${styles.crest} ${large ? styles.largeCrest : ""}`} aria-hidden="true">
    <svg viewBox="0 0 52 60" fill="none"><path d="M26 2 48 12v25L26 57 4 37V12L26 2Z" fill="#263e3c" stroke={rank.color} strokeWidth="1.5" /><path d="m26 6 18 8v21L26 52 8 35V14l18-8Z" stroke={rank.color} strokeOpacity=".3" /><path d="m20 12 6-3 6 3M12 33l4 4m24-4-4 4M23 45h6" stroke={rank.color} strokeWidth="1.2" /></svg>
    <b style={{ color: rank.color }}>{level}</b>
  </span>;
}
export function WhitePrice({ amount }: { amount: number }) {
  return <span className={styles.whitePrice}><WhiteCoinArt />{amount.toLocaleString("ja-JP")}</span>;
}
export function TownRpgPanel({ metrics, snapshot, busy, tab, onTab, onClaim, onDaily }: { tab: "quests" | "growth"; onTab: (tab: "quests" | "growth") => void; metrics: Record<string, number>; snapshot: TownSnapshot | null; busy: boolean; onClaim: (id: string) => void; onDaily: () => void }) {
  const p = townProgress(snapshot?.xp ?? 0), rank = townRank(p.level);
  const claimed = snapshot?.claimedQuests ?? [];
  const nextRank = TOWN_RANKS.find(r => r.level > p.level);
  const available = TOWN_QUESTS.filter(q => !claimed.includes(q.id));
  const quests = [...available].sort((a, b) => {
    const score = (q: typeof a) => q.level > p.level ? 2 : (metrics[q.id] ?? 0) >= q.target ? 0 : 1;
    return score(a) - score(b) || a.level - b.level;
  });
  return <div className={styles.rpgPanel}>
    <div className={styles.categories} aria-label="冒険手帳の表示"><button type="button" aria-pressed={tab === "quests"} onClick={() => onTab("quests")}>クエスト</button><button type="button" aria-pressed={tab === "growth"} onClick={() => onTab("growth")}>成長と報酬</button></div>
    {tab === "growth" && <>
    <section className={styles.rpgProfile} aria-label="まちづくりの成長">
      <TownCrest level={p.level} large />
      <div><span className={styles.rpgEyebrow}>TOWN ADVENTURER</span><h3>{rank.title}</h3><p>まちづくり Lv.{p.level}</p>
        <div className={styles.expTrack} role="progressbar" aria-label="次のレベルまでの経験値" aria-valuenow={p.max ? 100 : p.current} aria-valuemin={0} aria-valuemax={p.max ? 100 : p.required}><i style={{ width: `${p.ratio * 100}%` }} /></div>
        <small>{p.max ? "最高レベルに到達！" : `${p.current.toLocaleString("ja-JP")} / ${p.required.toLocaleString("ja-JP")} EXP`}</small>
      </div>
    </section>
    <div className={styles.nextReward}>{p.max ? <span>あなたの街づくりは、まだまだ続く。</span> : <><span>Lv.{p.level + 1}の報酬</span>{p.level + 1 <= (snapshot?.maxLevel ?? 1) ? <span>受取済み</span> : <WhitePrice amount={townLevelReward(p.level + 1)} />}<small>{nextRank ? `Lv.${nextRank.level}で「${nextRank.title}」` : "最高の称号まで、あと少し"}</small></>}</div>
    <p className={styles.rpgHint}>建設・増築・部品購入で、白コイン10枚につき1 EXP。<br />クエスト達成でも経験値がたまります。</p>
    <div className={styles.questHeading}><h3>称号の旅</h3><span>6つのステージ</span></div>
    <ol className={styles.rankJourney}>{TOWN_RANKS.map(tier => <li key={tier.level} data-unlocked={p.level >= tier.level}><TownCrest level={tier.level} /><div><b>{tier.title}</b><small>Lv.{tier.level}{p.level >= tier.level ? " · 解放済み" : ` · あと${Math.max(0, townLevelXp(tier.level) - p.total).toLocaleString("ja-JP")} EXP`}</small></div><span aria-hidden="true">{p.level >= tier.level ? "✓" : "◇"}</span></li>)}</ol>
    <p className={styles.rpgHint}>工事を取り消すと、その工事のEXPも戻ります。<br />レベル報酬と各クエストの報酬は、アカウントごとに1回です。</p>
    </>}
    {tab === "quests" && <>
    <section className={styles.dailyQuest} aria-label="毎日の支援">
      <div><small>DAILY GIFT</small><h3>今日の開拓支援</h3><p>日本時間の0時に更新</p></div>
      <button type="button" disabled={busy || !snapshot || snapshot.dailyClaimed} onClick={onDaily}>{snapshot?.dailyClaimed ? "受取済み" : <><WhitePrice amount={WHITE_LOGIN_COINS} /><span>受け取る</span></>}</button>
    </section>
    <section className={styles.questCard} aria-label="今日の開拓クエスト">
      <div className={styles.questTop}><small>DAILY QUEST</small><b>{snapshot?.dailyQuestClaimed ? "✓ 達成済み" : `${Math.min(500, snapshot?.dailySpent ?? 0)} / 500`}</b></div>
      <h3>今日も、少しずつ。</h3><p>今日の建設・増築・部品に白コイン500枚を使う</p>
      <div className={styles.questTrack}><i style={{ width: `${Math.min(100, (snapshot?.dailySpent ?? 0) / 5)}%` }} /></div>
      <div className={styles.questFoot}><span><WhitePrice amount={250} /><em>+50 EXP</em></span><button type="button" disabled={busy || !snapshot || snapshot.dailySpent < 500 || snapshot.dailyQuestClaimed} onClick={() => onClaim("daily")}>{snapshot?.dailyQuestClaimed ? "受取済み" : snapshot && snapshot.dailySpent >= 500 ? "報酬を受け取る" : "挑戦中"}</button></div>
    </section>
    <div className={styles.questHeading}><h3>開拓のクエスト</h3><span>{claimed.length} / {TOWN_QUESTS.length}</span></div>
    {quests.map(q => {
      const value = Math.min(q.target, metrics[q.id] ?? 0), locked = p.level < q.level, ready = !locked && value >= q.target;
      return <section key={q.id} className={styles.questCard} data-ready={ready} data-locked={locked} aria-label={q.title}>
        <div className={styles.questTop}><small>{q.chapter}</small><b>{locked ? `Lv.${q.level}で解放` : ready ? "達成！" : `${value} / ${q.target}`}</b></div>
        <h3>{q.title}</h3><p>{q.detail}</p>
        <div className={styles.questTrack}><i style={{ width: `${value / q.target * 100}%` }} /></div>
        <div className={styles.questFoot}><span><WhitePrice amount={q.coins} /><em>+{q.xp} EXP</em></span><button type="button" disabled={busy || !ready || !snapshot} onClick={() => onClaim(q.id)}>{locked ? "未解放" : ready ? "報酬を受け取る" : "挑戦中"}</button></div>
      </section>;
    })}
    {claimed.length > 0 && <details className={styles.completedQuests}><summary>達成したクエスト · {claimed.length}</summary>{TOWN_QUESTS.filter(q => claimed.includes(q.id)).map(q => <p key={q.id}>✓ {q.title}<span>受取済み</span></p>)}</details>}
    </>}
  </div>;
}
