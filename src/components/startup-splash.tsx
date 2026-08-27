"use client";

import { useState } from "react";

export function StartupSplash({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(true);

  return (
    <>
      {children}
      {visible ? (
        <main
          className="app-splash"
          aria-label="タップしてはじめる"
          onClick={() => {
            // pointerdown(押した瞬間)で閉じると、指を離した時の click が
            // 下に隠れている画面のボタンまで突き抜けて反応してしまう
            // (いわゆるゴーストクリック)。タップが完了する click まで待つ。
            setVisible(false);
          }}
        >
          <div className="app-splash-scene" aria-hidden="true">
            <span className="app-splash-cloud app-splash-cloud-left" />
            <span className="app-splash-cloud app-splash-cloud-right" />
            <span className="app-splash-balloon" />
            <span className="app-splash-hill app-splash-hill-back" />
            <span className="app-splash-hill app-splash-hill-front" />
            <span className="app-splash-road" />
            <span className="app-splash-tree app-splash-tree-left" />
            <span className="app-splash-tree app-splash-tree-right" />
            <span className="app-splash-suitcase">✧</span>
          </div>

          <section className="app-splash-copy">
            <h1>自分の旅</h1>
            <p>おでかけの記録を、<br />一生の思い出に。</p>
            <button type="button" className="app-splash-start">
              タップしてはじめる
            </button>
          </section>
        </main>
      ) : null}
    </>
  );
}
