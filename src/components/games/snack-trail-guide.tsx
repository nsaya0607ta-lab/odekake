import Image from "next/image";
import styles from "@/components/games/snack-trail-guide.module.css";

/**
 * わんこのおやつ道の説明書。
 *
 * SNSの説明書（public/sns-guide.html）と同じで、文章だけで説明せず
 * 実際のプレイ画面の写真を1項目に1枚ずつ添える。写真は
 * public/snack-trail-guide-shots/ に置いた本物のゲーム画面。
 *
 * 数値はゲーム本体が持っている定数をそのまま受け取る。
 * バランス調整をしたときに、説明書だけ古いままにならないようにするため。
 */
export type SnackTrailGuideProps = {
  /** 罠を踏んだときの減点 */
  hazardPenalty: number;
  /** 壁が出るまでの間隔（分） */
  wallIntervalMinutes: number;
  /** 壁の出現を予告する秒数 */
  wallWarningSeconds: number;
  /** 1プレイで使える壁ガードの回数 */
  maxWallGuardUses: number;
  /** 強化スキルが出るまでの個数 */
  boostInterval: number;
  /** 出現しうるアイテムの種類数 */
  itemKindCount: number;
  /** 盤面に常に出ているアイテムの数 */
  itemsOnBoard: number;
  /** 通常アイテムの得点 */
  normalPoint: number;
  /** 金色アイテムの得点 */
  goldenPoint: number;
};

const SHOTS = "/snack-trail-guide-shots";

function PhoneShot({ src, alt, caption }: { src: string; alt: string; caption: string }) {
  return (
    <figure className={`${styles.shot} ${styles.phoneShot}`}>
      <Image src={src} alt={alt} width={780} height={1688} sizes="(min-width: 560px) 240px, 210px" />
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

function BoardShot({ src, alt, caption }: { src: string; alt: string; caption: string }) {
  return (
    <figure className={styles.shot}>
      <Image src={src} alt={alt} width={700} height={868} sizes="(min-width: 560px) 260px, 45vw" />
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

function StripShot({ src, alt, caption, height }: { src: string; alt: string; caption: string; height: number }) {
  return (
    <figure className={`${styles.shot} ${styles.stripShot}`}>
      <Image src={src} alt={alt} width={760} height={height} sizes="(min-width: 560px) 480px, 90vw" />
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

export function SnackTrailGuide({
  hazardPenalty,
  wallIntervalMinutes,
  wallWarningSeconds,
  maxWallGuardUses,
  boostInterval,
  itemKindCount,
  itemsOnBoard,
  normalPoint,
  goldenPoint,
}: SnackTrailGuideProps) {
  return (
    <section className={styles.guide} id="snack-trail-guide" aria-label="わんこのおやつ道の説明書">
      <header className={styles.guideHead}>
        <p>おやつ道の説明書</p>
        <h2>遊びかたと、得点のしくみ。</h2>
        <small>
          実際のプレイ画面の写真といっしょに、はじめから終わりまでをひととおり。
          むずかしい操作はありません。スワイプひとつで遊べます。
        </small>
        <nav className={styles.tocList} aria-label="説明書の目次">
          <a href="#snack-trail-guide-start">01 はじめかた</a>
          <a href="#snack-trail-guide-items">02 おやつ</a>
          <a href="#snack-trail-guide-combo">03 コンボ</a>
          <a href="#snack-trail-guide-skill">04 スキル</a>
          <a href="#snack-trail-guide-danger">05 罠と壁</a>
          <a href="#snack-trail-guide-level">06 レベル</a>
          <a href="#snack-trail-guide-end">07 おわり</a>
        </nav>
      </header>

      <div className={styles.steps}>
        <article className={styles.step} id="snack-trail-guide-start">
          <p className={styles.stepNumber}>01 — START</p>
          <h3>スワイプで、進む道を選ぶ。</h3>
          <p>
            「ゲームスタート」を押すと、わんこが右へ歩き出します。
            止まることはできません。<strong>盤面のどこでもスワイプ</strong>すると、その向きへ曲がります。
          </p>
          <ul className={styles.points}>
            <li><div className={styles.pointBody}><b>上下左右にスワイプ</b><span>指を動かした向きへ、次の一歩から曲がります。パソコンなら矢印キーでも動きます。</span></div></li>
            <li><div className={styles.pointBody}><b>うしろへは戻れない</b><span>いま進んでいる向きの逆だけは選べません。回り込んで戻りましょう。</span></div></li>
            <li><div className={styles.pointBody}><b>ひとやすみもできる</b><span>右上の「一時停止」で止められます。もう一度押すと続きから。</span></div></li>
          </ul>
          <div className={styles.shots}>
            <PhoneShot
              src={`${SHOTS}/ready.webp`}
              alt="スタート前の画面。ゲームスタートのボタンと、遊びかたの説明が表示されている。"
              caption="スタート前 — ここから始まります"
            />
          </div>
        </article>

        <article className={styles.step} id="snack-trail-guide-items">
          <p className={styles.stepNumber}>02 — SNACK</p>
          <h3>おやつを集めると、道がのびる。</h3>
          <p>
            盤面にはいつも<strong>{itemsOnBoard}個</strong>のおやつが出ています。
            取るたびに得点が入り、わんこの後ろの肉球の道が1マスのびます。
            出てくるのはガチャで手に入る全{itemKindCount}種のアイテムです。
          </p>
          <ul className={styles.points}>
            <li><div className={styles.pointBody}><b>通常アイテム＝{normalPoint}ポイント</b><span>取ると、そのアイテムのミニスキルもいっしょに発動します。</span></div></li>
            <li><div className={styles.pointBody}><b>金色アイテム＝{goldenPoint}ポイント</b><span>まわりが金色に光っているのが目印。見つけたら優先して取りましょう。</span></div></li>
            <li><div className={styles.pointBody}><b>取ると次のおやつが出る</b><span>直前に出たものは続けて出にくいので、いろいろなアイテムに会えます。</span></div></li>
          </ul>
          <div className={styles.shots}>
            <BoardShot
              src={`${SHOTS}/board.webp`}
              alt="プレイ中の盤面。わんこと肉球の道、3個のおやつ、赤い星の罠、黒い壁が並んでいる。"
              caption="盤面 — わんこ・肉球の道・おやつ"
            />
          </div>
        </article>

        <article className={styles.step} id="snack-trail-guide-combo">
          <p className={styles.stepNumber}>03 — COMBO</p>
          <h3>続けて取るほど、得点が増える。</h3>
          <p>
            おやつを取るたびに<strong>肉球コンボ</strong>が1つ増えます。
            コンボがたまると、そのあとに取る1個ぶんの得点そのものが倍になります。
          </p>
          <ul className={styles.points}>
            <li><div className={styles.pointBody}><b>5コンボで得点×2</b><span>通常アイテムが{normalPoint * 2}ポイント、金色が{goldenPoint * 2}ポイントになります。</span></div></li>
            <li><div className={styles.pointBody}><b>10コンボで得点×3</b><span>ここまで来ると、金色1個で{goldenPoint * 3}ポイント。一気に伸びます。</span></div></li>
            <li><div className={styles.pointBody}><b>途切れると0に戻る</b><span>罠を踏んだときと、自分の肉球の道にぶつかったときにリセットされます。</span></div></li>
          </ul>
          <div className={styles.shots}>
            <StripShot
              src={`${SHOTS}/combo-strip.webp`}
              alt="肉球コンボ9・得点×2と表示された帯。右側に強化までの残り個数と壁ガードの残り回数が並ぶ。"
              caption="盤面の上の帯に、いまのコンボと倍率が出ます"
              height={57}
            />
            <PhoneShot
              src={`${SHOTS}/play.webp`}
              alt="プレイ中の画面。スコア39、肉球コンボ9・得点×2、盤面にわんこと肉球の道が伸びている。"
              caption="プレイ中 — コンボが乗ってきたところ"
            />
          </div>
        </article>

        <article className={styles.step} id="snack-trail-guide-skill">
          <p className={styles.stepNumber}>04 — SKILL</p>
          <h3>アイテムごとに、ちがう力。</h3>
          <p>
            おやつにはそれぞれスキルがあります。取った瞬間に画面の上へ、
            どのスキルが出たかが表示されます。
            <strong>{boostInterval}個目ごとは強化スキル</strong>になり、効果が大きくなります。
          </p>
          <ul className={styles.points}>
            <li><div className={styles.pointBody}><b>ゆっくり・道を短縮</b><span>スピードを落としたり、伸びすぎた肉球の道を切ったりします。</span></div></li>
            <li><div className={styles.pointBody}><b>得点×2・金色化</b><span>次の何個かの得点が倍になったり、金色アイテムに変わったりします。</span></div></li>
            <li><div className={styles.pointBody}><b>壁ガード・取得範囲アップ</b><span>壁にぶつかっても助かる回数が増えたり、少し離れていても取れるようになります。</span></div></li>
            <li><div className={styles.pointBody}><b>レア度が高いほど強い</b><span>同じスキルでも、レアなアイテムほど効果や持続が大きくなります。</span></div></li>
          </ul>
          <div className={styles.shots}>
            <PhoneShot
              src={`${SHOTS}/skill.webp`}
              alt="スキル発動の表示。アイテムの絵と、こびーラッシュ・肉球コンボを1追加という説明が出ている。"
              caption="取った瞬間に、スキルの名前と効果が出ます"
            />
          </div>
        </article>

        <article className={styles.step} id="snack-trail-guide-danger">
          <p className={styles.stepNumber}>05 — DANGER</p>
          <h3>赤い星は罠、黒い四角は壁。</h3>
          <p>
            盤面には邪魔をするものが2つあります。
            <strong>罠</strong>は踏んでも終わりませんが痛手。
            <strong>壁</strong>はぶつかるとその場でゲームオーバーです。
          </p>
          <ul className={styles.points}>
            <li><div className={styles.pointBody}><b>罠（赤い星）＝{hazardPenalty}ポイント減点</b><span>コンボも0に戻ります。踏んだ罠は消えて、別の場所に新しく出ます。</span></div></li>
            <li><div className={styles.pointBody}><b>壁は{wallIntervalMinutes}分ごとに1つ増える</b><span>遊べば遊ぶほど盤面が狭くなっていきます。</span></div></li>
            <li><div className={styles.pointBody}><b>出る{wallWarningSeconds}秒前に点滅で予告</b><span>黄色い点線が出た場所には、まもなく壁ができます。近づかないように。</span></div></li>
            <li><div className={styles.pointBody}><b>壁ガードは1プレイ{maxWallGuardUses}回まで</b><span>スキルで手に入れていれば、ぶつかっても1回ぶんだけ助かります。</span></div></li>
          </ul>
          <div className={styles.shots}>
            <BoardShot
              src={`${SHOTS}/wall-warning.webp`}
              alt="盤面の下の方に、黄色い点線の四角が点滅している。まもなく壁ができる予告。"
              caption="点滅の予告 — ここに壁ができます"
            />
            <BoardShot
              src={`${SHOTS}/wall.webp`}
              alt="盤面の中央に黒い四角の壁ができている。近くには赤い星の罠もある。"
              caption="出現した壁 — ぶつかると終わり"
            />
          </div>
        </article>

        <article className={styles.step} id="snack-trail-guide-level">
          <p className={styles.stepNumber}>06 — LEVEL</p>
          <h3>集めるほど、足が速くなる。</h3>
          <p>
            おやつを{boostInterval}個集めるごとにレベルが1つ上がり、わんこの歩く速さも上がります。
            レベルは最大9まで。速くなるほど、曲がるタイミングもむずかしくなります。
          </p>
          <ul className={styles.points}>
            <li><div className={styles.pointBody}><b>スコア</b><span>いま取ったぶんの合計です。罠を踏むと減りますが、0より下にはなりません。</span></div></li>
            <li><div className={styles.pointBody}><b>ベスト</b><span>この端末での自己最高スコア。次に開いたときも残っています。</span></div></li>
            <li><div className={styles.pointBody}><b>レベル</b><span>{boostInterval}個ごとに1つ上がります。上がるほど速く、得点も伸びやすくなります。</span></div></li>
          </ul>
          <div className={styles.shots}>
            <StripShot
              src={`${SHOTS}/score-panel.webp`}
              alt="画面上部のパネル。スコア039、ベスト000、レベル2、右端に一時停止ボタンが並んでいる。"
              caption="画面のいちばん上に、3つの数字が並びます"
              height={96}
            />
          </div>
        </article>

        <article className={styles.step} id="snack-trail-guide-end">
          <p className={styles.stepNumber}>07 — FINISH</p>
          <h3>ぶつかったら、そこまで。</h3>
          <p>
            盤面の外側の枠か、あとから出てきた壁にぶつかるとゲームオーバー。
            そのプレイで集めた数と、最後のコンボがまとめて表示されます。
          </p>
          <ul className={styles.points}>
            <li><div className={styles.pointBody}><b>自分の道は終わりではない</b><span>肉球の道にぶつかったときは、そこから先が切れてコンボが0になるだけ。まだ続けられます。</span></div></li>
            <li><div className={styles.pointBody}><b>結果はフレンドと並びます</b><span>スコアと、そのプレイでの最高コンボが、下のフレンドスコアに記録されます。</span></div></li>
            <li><div className={styles.pointBody}><b>コインはもらえません</b><span>おやつ道はまだ検証中のため、遊んでもコインは増えません。</span></div></li>
          </ul>
          <div className={styles.shots}>
            <PhoneShot
              src={`${SHOTS}/gameover.webp`}
              alt="ゲームオーバー画面。今回のスコア62、ベストスコア更新、集めたアイテム13個・最終コンボ16と表示されている。"
              caption="結果 — 集めた数と最終コンボも出ます"
            />
          </div>
        </article>
      </div>

      <p className={styles.guideFoot}>
        写真は実際のプレイ画面です。バランス調整で数値が変わることがあります。
      </p>
    </section>
  );
}
