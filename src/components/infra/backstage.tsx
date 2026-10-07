"use client";

/**
 * おまけ「このアプリの裏側」：いま使っている「おでかけ記録」が、どんなパーツで動いているか。
 * （公開先は Vercel、データは Supabase。README の構成と同じ）
 */
import { Fragment, type CSSProperties } from "react";
import { Glyph, type GlyphId } from "./glyphs";
import { Teacher } from "./intro";
import { PARTS, REQ_INFO, RESPONSE_COLOR } from "./model";
import styles from "./infra.module.css";

type Node = { icon: GlyphId; name: string; what: string; learned?: string; extra?: { icon: GlyphId; name: string; what: string }[] };

const NODES: Node[] = [
  { icon: "user", name: "あなたの iPhone", what: "「記録する」をタップ。お願い（リクエスト）が出発します" },
  { icon: "dns", name: "DNS", what: "アプリの名前から、行き先の住所（IPアドレス）をしらべます", learned: "ステージ2" },
  { icon: "cdn", name: "Vercel の CDN", what: "画面のファイルや画像を、近くの拠点から届けます", learned: "ステージ6" },
  {
    icon: "app",
    name: "Vercel のサーバー（Next.js）",
    what: "ログインを確かめて、ページを組み立てます。アクセスに合わせて、自動でふえたりへったりします（サーバーレス）",
    learned: "ステージ3",
  },
  {
    icon: "db",
    name: "Supabase",
    what: "記録・図鑑・フレンドなどのデータは、PostgreSQL というデータベースに保存されます",
    learned: "ステージ4",
    extra: [
      { icon: "cache", name: "ストレージ", what: "写真のファイル" },
      { icon: "waf", name: "ログイン（認証）", what: "あなたが本人かを確かめる" },
    ],
  },
];

const color = (icon: GlyphId) => (icon === "user" ? "#9fb4ff" : icon === "bot" ? "#ff6f8a" : PARTS[icon].color);

export function Backstage({ onBack }: { onBack: () => void }) {
  return (
    <div className={styles.home}>
      <header className={styles.homeHeader}>
        <button type="button" className={styles.roundBtn} onClick={onBack} aria-label="ステージ一覧へ">
          ‹
        </button>
        <div className={styles.brand}>
          <div>
            <h1>このアプリの裏側</h1>
            <p>おまけ</p>
          </div>
        </div>
      </header>
      <div className={styles.backstage}>
        <div className={styles.bsIntro}>
          <Teacher sub="おまけ" />
          <p>
            いま使っている「おでかけ記録」も、ここで学んだパーツの組み合わせで動いています。記録を1つ追加したとき、裏側ではこんなことが起きています。
          </p>
        </div>

        <ol className={styles.bsFlow}>
          {NODES.map((n, i) => (
            <Fragment key={n.name}>
              {i > 0 ? (
                <li className={styles.bsLink} aria-hidden="true" style={{ "--go": REQ_INFO.page.color, "--back": RESPONSE_COLOR, "--delay": `${i * 0.25}s` } as CSSProperties}>
                  <i />
                  <b />
                </li>
              ) : null}
              <li className={styles.bsNode} style={{ "--c": color(n.icon) } as CSSProperties}>
                <span className={styles.bsIcon} aria-hidden="true">
                  <Glyph id={n.icon} size={26} />
                </span>
                <span className={styles.bsText}>
                  <b>
                    {n.name}
                    {n.learned ? <small>{n.learned}で習った</small> : null}
                  </b>
                  <span>{n.what}</span>
                  {n.extra ? (
                    <span className={styles.bsExtra}>
                      {n.extra.map((x) => (
                        <span key={x.name} style={{ "--c": color(x.icon) } as CSSProperties}>
                          <Glyph id={x.icon} size={14} />
                          {x.name}：{x.what}
                        </span>
                      ))}
                    </span>
                  ) : null}
                </span>
              </li>
            </Fragment>
          ))}
        </ol>

        <section className={styles.bsCards}>
          <h3>あなたの記録を守るしくみ</h3>
          <div className={styles.bsCard}>
            <b>行ごとの鍵（RLS）</b>
            <p>データベースが「この記録は、書いた本人しか見られない」と、1行ずつ見張っています。だから、ほかの人の記録が見えてしまうことはありません。</p>
          </div>
          <div className={styles.bsCard}>
            <b>暗号化された通信（HTTPS）</b>
            <p>iPhone とサーバーのあいだのやりとりは暗号化されていて、途中でのぞき見られないようになっています。</p>
          </div>
        </section>

        <section className={styles.bsCards}>
          <h3>ステージと見くらべてみよう</h3>
          <ul className={styles.takeaways}>
            <li>住所しらべは DNS（ステージ2）</li>
            <li>画像やファイルは CDN が近くから（ステージ6）</li>
            <li>サーバーはアクセスに合わせて自動で増える。使った分だけ払う（ステージ3）</li>
            <li>データは1か所のデータベースにまとめる（ステージ4）</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
