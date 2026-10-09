import { getImageProps } from "next/image";
import Link from "next/link";
import { RedCoinArt } from "@/components/coin-art";
import { GACHA_RARITIES } from "@/lib/gacha/config";
import { getSkillLevel } from "@/lib/gacha/skill-levels";
import {
  BALL_SAVE_SEC,
  BONUS,
  COIN_MAX,
  COIN_POINTS,
  COMBO_WINDOW_SEC,
  CONQUEST_EXTRA_BALLS,
  ENCORE_POINTS,
  ENCORE_SEC,
  GACHA_AWARDS,
  ITEM_POINTS,
  ITEM_RELOCATE_SEC,
  MAX_BONUS_X,
  MAX_COMBO,
  MAX_SCORE_MULT,
  PINBALL_BALLS,
  POINTS,
  STAMP_COUNT,
  STAR_MAX,
  STAR_RATE,
  ZUKAN_BONUS_MAX,
  zukanBonus,
} from "@/lib/games/pinball/config";
import { pinballItems, pinballPrefCodes, pinballPrefItems } from "@/lib/games/pinball/items";
import { PINBALL_MAP_IDS } from "@/lib/games/pinball/maps";
import { describeSkillLevels, getPinballSkill, starsForCount } from "@/lib/games/pinball/skills";
import { PINBALL_PARTS, STAGE_GAP, STAGE_LIMIT } from "@/lib/games/pinball/stage";
import { getPinballTheme } from "@/lib/games/pinball/themes";
import { PREFECTURE_NAMES } from "@/lib/geo/prefecture-names";
import { PinballSkillTabs, type GuidePref } from "./pinball-guide";
import { PinballMapPreview } from "./pinball-map-preview";

const n = (v: number) => v.toLocaleString("ja-JP");

function Title({ no, eyebrow, title }: { no: string; eyebrow: string; title: string }) {
  return (
    <div className="flex items-end gap-3">
      <span className="text-xl font-black tabular-nums text-[#ff8a80]">{no}</span>
      <div className="min-w-0 pb-0.5">
        <p className="text-[8px] font-black tracking-[0.2em] text-white/45">{eyebrow}</p>
        <h2 className="mt-0.5 text-base font-black text-white">{title}</h2>
      </div>
      <span className="mb-1 h-px flex-1 bg-gradient-to-r from-[#ff8a80]/60 to-transparent" />
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-[22px] border border-white/10 bg-white/[0.04] p-3.5 ${className}`}>{children}</div>;
}

/** スキル一覧の県のタブの色（県の順にくり返す） */
const PREF_ACCENTS = ["#f2a541", "#c7e8f3", "#f2c14e", "#9fd356", "#f5c542", "#e8d5b5", "#ff8a80", "#7df9ff"];

const GADGETS: { icon: string; name: string; body: string }[] = [
  { icon: "🎯", name: "スキルショット", body: `打ち出しで、光っているレーン（お・で・か・け）にぴったり入れると${n(POINTS.skillShot)}点。打ち出しゲージの目印が、入りやすい強さです。光る場所は、打ち出す前にフリッパーで動かせます。` },
  { icon: "🔤", name: "上のレーン「お・で・か・け」", body: `玉が通るとレーンが光り、4つそろうとボーナス倍率+1（最大×${MAX_BONUS_X}）。フリッパーを押すたびに光がとなりへ動くので、空いているところへ寄せられます。` },
  { icon: "🎏", name: "かざぐるま（風車）", body: `いつもゆっくり回っている羽根。当たると${n(POINTS.pinwheel)}点で、強く当てるほど速く回ります。どこへはね返るかは、羽根の向きしだい。` },
  { icon: "💥", name: "バンパー", body: `当たると${n(POINTS.bumper)}点で強くはじき返します。上にのっているのは、あなたの持っているご当地アイテム（レア度の高い順）です。` },
  { icon: "📍", name: "くぎ（くぎと風車の台）", body: "パチンコのくぎ。当たると、玉がカチカチと向きを変えながら落ちてきます。得点はありません。" },
  { icon: "🌀", name: "オービット（左右の外まわり）", body: `外まわりのレーンを1周すると${n(POINTS.orbit)}点。左のオービットの入口にはスピナーがあり、勢いよく通るほど回って点が入ります。` },
  { icon: "🛝", name: "ランプ（左右の坂道）", body: `坂をのぼりきると${n(POINTS.ramp)}点。弱いと途中で戻ってきます。のぼった玉の行き先はマップしだい（いつもの台は同じがわのインレーンへ戻るので、左右交互に「8の字」でつなぐのがコツ）。` },
  { icon: "⚡", name: "コンボ", body: `オービット・ランプ・ガチャ穴を${COMBO_WINDOW_SEC}秒以内に続けて決めると、得点が×2、×3…（最大×${MAX_COMBO}）。` },
  { icon: "🚩", name: "スタンドアップターゲット（左右の上のすみ）", body: `倒れない的が3つずつ。前から当てると光り（${n(POINTS.standup)}点）、3つ全部光らせると${n(POINTS.standupsAll)}点＋アイテムをもう1か所よびます。反対がわのフリッパーから、ガチャ穴の横をぬけてランプの下を通すと届きます。` },
  { icon: "🎰", name: "ドロップターゲットとガチャ穴", body: `まん中の3つの的を全部倒すと、奥の「ガチャ穴」が開きます（キックバックも点灯）。穴に入れるとカプセルから何かが出ます。くぎと風車の台のガチャ穴は上もあいていて、上から落ちてきた玉も入ります。` },
  { icon: "🦵", name: "キックバック", body: "アウトレーン（いちばん外側）に落ちても、「キック」のランプが点いていれば打ち返してくれます。左はボールを出すたびに点いた状態で始まり、使ったらドロップターゲットを全部倒すと点けなおせます。右はガチャ穴やスキルで点きます。" },
  { icon: "🛟", name: "ボールセーブ", body: `打ち出してから${BALL_SAVE_SEC}秒は、落としてもボールが戻ってきます。フリッパーの間の「セーブ」が光っている間です。` },
];

/** ご当地ピンボールのルールブック（owned = アイテムID → 持っている数） */
/** スキルの説明に出てくることば */
const SKILL_WORDS: [string, string][] = [
  ["セーブ", "落としてもボールが戻ってくる"],
  ["ふさぐ", "アウトレーンの光の扉が玉をはね返す"],
  ["ボール+1", "もう1つ出てマルチボール"],
  ["得点2倍・3倍", `重なるとかけ算（最大×${MAX_SCORE_MULT}）`],
  ["スロー", "台の動きがゆっくりになる"],
  ["全倒し", "ターゲットが倒れて穴が開く"],
  ["よぶ", "台に浮かぶアイテムが増える"],
  ["コンボ受付", "コンボがつながる時間がのびる"],
  ["マグネット", "ガチャ穴が開いて、前を通る玉を吸い寄せる"],
  ["スタンプ2倍", "その間に取ったアイテムは、スタンプが2つ進む"],
  ["おかわり", `さっき取ったアイテムがもう一度出る（${ENCORE_SEC}秒で消える）`],
  ["JP予約", "次のランプがジャックポットになる"],
];

export function PinballRulebook({ owned }: { owned: ReadonlyMap<string, number> }) {
  const optimize = (src: string) => getImageProps({ src, alt: "", width: 96, height: 96 }).props.src;

  const allItems = pinballItems();
  const ownedKinds = allItems.filter((item) => (owned.get(item.id) ?? 0) > 0).length;
  const zukan = zukanBonus(ownedKinds, allItems.length);
  const prefs: GuidePref[] = pinballPrefCodes().map((code, index) => {
    const name = PREFECTURE_NAMES.find((p) => p.code === code)?.name ?? "ご当地";
    const rows = pinballPrefItems(code)
      .slice()
      .sort((a, b) => GACHA_RARITIES.indexOf(b.rarity) - GACHA_RARITIES.indexOf(a.rarity))
      .map((item) => {
        const count = owned.get(item.id) ?? 0;
        const stars = starsForCount(item.rarity, count);
        const desc = describeSkillLevels(item.id, item.name, item.rarity);
        return {
          id: item.id,
          name: item.name,
          image: item.image ? optimize(item.image) : null,
          rarity: item.rarity,
          title: desc?.title ?? null,
          levels: desc?.levels ?? null,
          count,
          level: count > 0 && item.rarity !== "N" ? Math.max(1, getSkillLevel(item.rarity, count)) : 0,
          stars,
          starText: stars > 0 ? (getPinballSkill(item.id, item.name, item.rarity, 5, stars)?.text ?? null) : null,
        };
      });
    return { id: code, name, accent: PREF_ACCENTS[index % PREF_ACCENTS.length]!, rows };
  });

  return (
    <div className="min-h-dvh bg-[radial-gradient(120%_50%_at_50%_0%,#3a1418_0%,#0b0d14_55%,#07090e_100%)] pb-10 text-white">
      <header data-dark-header className="sticky top-0 z-20 flex items-center gap-3 border-b border-white/10 bg-[#0b0d14]/85 px-3 py-2 backdrop-blur" style={{ paddingTop: "max(8px, env(safe-area-inset-top))" }}>
        <Link href="/games/pinball" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-lg font-black active:scale-95" aria-label="ご当地ピンボールへ戻る">
          ‹
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-[8px] font-black tracking-[0.18em] text-[#ff8a80]">RULE BOOK</p>
          <h1 className="truncate text-[16px] font-black">ご当地ピンボールのルール</h1>
        </div>
      </header>

      <main className="mx-auto max-w-[480px] space-y-5 px-4 pt-4">
        <section className="rounded-[28px] border border-[#ff8a80]/25 bg-[linear-gradient(135deg,#2a1116,#121521)] p-5">
          <p className="text-[10px] font-black tracking-[0.1em] text-[#ff8a80]">本物そっくりの台で、ご当地アイテムを集める</p>
          <p className="mt-1 text-[21px] font-black leading-tight">{PINBALL_BALLS}球で、どこまで行ける？</p>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            {[
              ["BALL", `${PINBALL_BALLS}球`, "1ゲーム"],
              ["STAMP", `${STAMP_COUNT}個`, "で制覇"],
              ["REWARD", `÷${n(COIN_POINTS)}`, "赤コイン"],
            ].map(([label, value, note]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-black/25 px-1 py-2.5">
                <span className="block text-[8px] font-black tracking-[0.14em] text-white/45">{label}</span>
                <span className="mt-0.5 block text-base font-black tabular-nums">{value}</span>
                <span className="block text-[9px] text-white/55">{note}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <Title no="01" eyebrow="HOW TO PLAY" title="遊びかた" />
          <Card>
            <ul className="space-y-2 text-[11.5px] leading-relaxed text-white/80">
              <li><b className="text-white">フリッパー</b>：画面の左半分を押すと左、右半分を押すと右。押している間は上がったまま（玉を止めて狙えます）。</li>
              <li><b className="text-white">打ち出し</b>：玉が右下にあるとき、右下を指で下へ引いて離す。引いた強さで飛び方が変わります。</li>
              <li><b className="text-white">パソコン</b>：左は Z か ←、右は / か →、打ち出しはスペース（長く押すほど強い）、一時停止は Esc。</li>
              <li><b className="text-white">終わり</b>：{PINBALL_BALLS}球を落としたら終わり。ボールが終わるたびに「ボーナス」が入ります。</li>
            </ul>
          </Card>
        </section>

        <section className="space-y-2">
          <Title no="02" eyebrow="MAPS" title="マップ" />
          <Card>
            <p className="text-[11.5px] leading-relaxed text-white/80">
              台は{PINBALL_MAP_IDS.length}つのマップから選べます。どのマップも、フリッパー・スリングショット・上のレーン・オービット・ランプの入口・ガチャ穴の場所は同じで、上半分のしかけとランプの行き先がちがいます。ルールと得点・スキルはどのマップも同じです。
            </p>
          </Card>
          <div className="space-y-2">
            {PINBALL_MAP_IDS.map((id) => {
              const theme = getPinballTheme(id);
              return (
                <Card key={id}>
                  <div className="flex items-start gap-3">
                    <PinballMapPreview mapId={id} theme={theme} className="h-[96px] w-[51px] shrink-0" />
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5">
                        <span className="text-[13px] font-black">{theme.name}</span>
                        <span className="text-[10px] font-black text-white/70">
                          {"★".repeat(theme.difficulty)}
                          <span className="text-white/25">{"★".repeat(3 - theme.difficulty)}</span>
                        </span>
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-relaxed text-white/70">{theme.lead}</span>
                      <span className="mt-1 flex flex-wrap gap-1">
                        {theme.features.map((f) => (
                          <span key={f} className="rounded-full border border-white/10 bg-black/25 px-2 py-0.5 text-[9.5px] font-bold" style={{ color: theme.colors.accent }}>
                            {f}
                          </span>
                        ))}
                      </span>
                    </span>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>

        <section className="space-y-2">
          <Title no="03" eyebrow="TABLE" title="台のしかけ" />
          <div className="space-y-2">
            {GADGETS.map((g) => (
              <Card key={g.name}>
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-lg">{g.icon}</span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-black">{g.name}</span>
                    <span className="mt-0.5 block text-[11px] leading-relaxed text-white/70">{g.body}</span>
                  </span>
                </div>
              </Card>
            ))}
          </div>
          <Card>
            <p className="text-[11px] font-black text-white/80">ガチャ穴から出るもの</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {GACHA_AWARDS.map((a) => (
                <span key={a.id} className="rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-[10px] font-bold text-white/80">
                  {a.label}
                </span>
              ))}
            </div>
          </Card>
        </section>

        <section className="space-y-2">
          <Title no="04" eyebrow="STAMP" title="アイテムを集める" />
          <Card>
            <ul className="space-y-2 text-[11.5px] leading-relaxed text-white/80">
              <li>台には、<b className="text-white">持っているご当地アイテムが全部</b>（どの県のものも、どのマップにも）出てきます（このゲームでまだ出ていないものが先）。どれでも <b className="text-white">{STAMP_COUNT}つ</b> 取ると、画面の上のスタンプ帳がうまります。持っているのが{STAMP_COUNT}種類より少ないと、足りないぶんは「？カプセル」になります。</li>
              <li>アイテムは台の上に1つずつ浮かびます。<b className="text-white">ボールを当てると取れて、その場でスキルが発動</b>。レア度が高いものほど、ランプやオービットの入口など狙いにくい場所に出ます。</li>
              <li>{ITEM_RELOCATE_SEC}秒たっても取れないと、別の場所へうつります。まだ出ていないアイテムがあれば、そのアイテムに入れかわります（まわりの輪が残り時間）。</li>
              <li>スキルがあるのは R 以上のアイテム。N と ？カプセルは得点だけです。スキルLvは図鑑と同じで、同じアイテムを集めるほど強くなります。</li>
            </ul>
          </Card>
        </section>

        <section className="space-y-2">
          <Title no="05" eyebrow="COLLECTION" title="ガチャで集めるほど強くなる" />
          <Card>
            <ul className="space-y-2 text-[11.5px] leading-relaxed text-white/80">
              <li><b className="text-white">図鑑ボーナス</b>：台に出るご当地アイテム（全部の県で{allItems.length}種）を何種類持っているかで、<b className="text-white">すべての得点</b>にかかる倍率。全部そろえると ×{(1 + ZUKAN_BONUS_MAX).toFixed(2)}（半分なら ×{zukanBonus(1, 2).toFixed(2)}）。いまのあなたは {ownedKinds}種で <b className="text-[#ffe08a]">×{zukan.toFixed(2)}</b>。台えらびと、遊んでいる画面の上にも出ます。</li>
              <li><b className="text-white">Lv5で覚醒</b>：同じアイテムを集めてスキルLvが MAX（Lv5）になると、スキルの効果がひとつ増えます（下のスキル一覧の「覚醒」）。</li>
              <li><b className="text-white">限界突破 ★</b>：Lv5 のあとも同じアイテムを引くと、1つごとに★がつきます（最大★{STAR_MAX}）。★1つで、そのアイテムのスキルの秒数と得点、取ったときの得点が +{Math.round(STAR_RATE * 100)}%。</li>
              <li><b className="text-white">おかわり</b>で出たアイテムは、取ってもスタンプは増えませんが、スキルがもう一度発動します（得点は{ENCORE_POINTS === 0.5 ? "半分" : `${ENCORE_POINTS}倍`}）。</li>
            </ul>
          </Card>
        </section>

        <section className="space-y-2">
          <Title no="06" eyebrow="CONQUEST" title="制覇とジャックポット" />
          <Card>
            <ul className="space-y-2 text-[11.5px] leading-relaxed text-white/80">
              <li>スタンプが{STAMP_COUNT}つそろうと「<b className="text-white">制覇！</b>」で {n(POINTS.conquest)}点 × 制覇した回数。ボールが{CONQUEST_EXTRA_BALLS}つ増えて、3球のマルチボールになります。</li>
              <li>制覇モードの間は、左右のランプとオービットが「ジャックポット」（{n(POINTS.jackpot)}点 × 制覇の回数）。4つ全部決めるとガチャ穴が「スーパージャックポット」（{n(POINTS.superJackpot)}点 × 制覇の回数）。</li>
              <li>ボールが1つに戻ると制覇モードは終わり、新しいスタンプ帳が始まります。集めたアイテムの得点も、制覇するたびに大きくなります。</li>
            </ul>
          </Card>
        </section>

        <section className="space-y-2">
          <Title no="07" eyebrow="SCORE" title="得点" />
          <Card>
            <table className="w-full border-collapse text-[11px]">
              <tbody>
                {[
                  ["バンパー", n(POINTS.bumper)],
                  ["スリングショット", n(POINTS.sling)],
                  ["上のレーン（4つで）", `${n(POINTS.lane)}（${n(POINTS.lanesAll)}）`],
                  ["スピナー（1回転）", n(POINTS.spinner)],
                  ["ドロップターゲット（3つで）", `${n(POINTS.drop)}（${n(POINTS.dropsAll)}）`],
                  ["スタンドアップターゲット（3つで）", `${n(POINTS.standup)}（${n(POINTS.standupsAll)}）`],
                  ["かざぐるま", n(POINTS.pinwheel)],
                  ["オービット", n(POINTS.orbit)],
                  ["ランプ", n(POINTS.ramp)],
                  ["ガチャ穴", `${n(POINTS.scoop)}＋ガチャ`],
                  ["スキルショット", n(POINTS.skillShot)],
                ].map(([k, v]) => (
                  <tr key={k} className="border-b border-white/10 last:border-0">
                    <td className="py-1.5 font-bold text-white/75">{k}</td>
                    <td className="py-1.5 text-right font-black tabular-nums">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Card>
            <p className="text-[11px] font-black text-white/80">アイテムを取ったとき（× 制覇の回数+1・★1つで+{Math.round(STAR_RATE * 100)}%）</p>
            <div className="mt-2 grid grid-cols-4 gap-1.5 text-center">
              {(["capsule", "N", "R", "SR", "SSR", "UR", "LR"] as const).map((r) => (
                <div key={r} className="rounded-xl bg-black/25 px-1 py-1.5">
                  <span className="block text-[9px] font-black text-white/55">{r === "capsule" ? "？" : r}</span>
                  <span className="block text-[11px] font-black tabular-nums">{n(ITEM_POINTS[r])}</span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-white/55">
              ボールが終わったときのボーナス：（取ったアイテム×{n(BONUS.item)}＋ランプ×{n(BONUS.ramp)}＋オービット×{n(BONUS.orbit)}＋バンパー×{n(BONUS.bumper)}＋ターゲット×{n(BONUS.drop)}）× ボーナス倍率
            </p>
            <p className="mt-1 text-[10px] leading-relaxed text-white/55">ここに書いた得点には、どれも図鑑ボーナスがかかります。</p>
          </Card>
        </section>

        <section className="space-y-2">
          <Title no="08" eyebrow="SKILLS" title="ご当地アイテムのスキル" />
          <Card>
            <p className="text-[11px] font-black text-white/80">スキルのことば</p>
            <dl className="mt-2 grid grid-cols-2 gap-1.5">
              {SKILL_WORDS.map(([word, meaning]) => (
                <div key={word} className="rounded-xl bg-black/25 px-2.5 py-1.5">
                  <dt className="text-[10.5px] font-black text-[#ffb3ab]">{word}</dt>
                  <dd className="mt-px text-[9.5px] font-bold leading-snug text-white/65">{meaning}</dd>
                </div>
              ))}
            </dl>
          </Card>
          <Card>
            <PinballSkillTabs prefs={prefs} />
          </Card>
        </section>

        <section className="space-y-2">
          <Title no="09" eyebrow="REWARD" title="赤コイン" />
          <Card className="text-center">
            <RedCoinArt className="mx-auto h-10 w-10" />
            <p className="mt-1 text-lg font-black">スコア ÷ {n(COIN_POINTS)} = 赤コイン</p>
            <p className="mt-1 text-[10px] text-white/55">
              小数点以下は切り捨て・1プレイ{n(COIN_MAX)}枚まで（マップでも、自分やフレンドのステージでも同じ）。ステージの部品を買うのに使えます
            </p>
          </Card>
        </section>

        <section className="space-y-2">
          <Title no="10" eyebrow="STAGE" title="自分でステージを作る" />
          <Card>
            <p className="text-[11px] leading-relaxed text-white/75">
              新しいステージは白紙から作れます（{STAGE_LIMIT}つまで）。基本設備は外枠・打ち出し口・左右のフリッパーだけ。バンパー・くぎ・レールなどを台の上下に自由に置いて、オリジナルの通り道を作れます。ランプは使いたいときに選びます。
              「フレンドに公開」にすると、フレンドが遊べて、ステージごとにランキングが出ます（部品を動かすと、それまでの記録はリセット）。
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-white/75">「上を拡大」「下を拡大」で細かく配置できます。コピー・左右対称の配置・元に戻す・やり直すに対応。★のアイテムが出る場所も動かせます。以前作ったステージは従来の台として遊べます。</p>
            <p className="mt-2 text-[11px] leading-relaxed text-white/75">
              玉がはさまって止まらないように、部品どうし・部品と台のかべのあいだは <b className="text-[#ffe08a]">{STAGE_GAP}mm 以上</b>（玉の直径は 27mm）あけます。近すぎるところには置けません。
            </p>
            <ul className="mt-3 divide-y divide-white/10 rounded-2xl border border-white/10 bg-black/25">
              {PINBALL_PARTS.map((part) => (
                <li key={part.id} className="flex items-center gap-2 px-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] font-black">{part.name}</span>
                    <span className="block text-[10px] text-white/55">{part.lead}</span>
                  </span>
                  <span className="shrink-0 text-right text-[10px] font-bold text-white/70">
                    <span className="flex items-center justify-end gap-1 text-[12px] font-black tabular-nums text-[#ffd3cd]">
                      <RedCoinArt className="h-3.5 w-3.5" />
                      {n(part.price)}
                    </span>
                    {part.free ? `はじめから${part.free}こ・` : ""}
                    {part.max !== null ? `${part.max}こまで` : "いくつでも"}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </section>

        <Link href="/games/pinball" className="flex h-12 items-center justify-center rounded-full bg-[#ff6b6b] text-sm font-black text-white active:scale-[0.99]">
          台をえらびにいく
        </Link>
      </main>
    </div>
  );
}
