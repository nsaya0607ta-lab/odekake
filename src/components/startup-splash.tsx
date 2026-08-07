"use client";

import { useEffect, useState } from "react";

export function StartupSplash({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), 3000);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <>
      {children}
      {visible ? (
        <main className="app-splash" aria-label="読み込み中">
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
            <div className="app-splash-dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <span className="app-splash-loading">読み込み中...</span>
          </section>
        </main>
      ) : null}
    </>
  );
}
