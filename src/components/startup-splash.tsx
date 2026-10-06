"use client";

import { useState } from "react";
import { GrandSplash } from "./splash/grand-splash";

/**
 * アプリを開いたときの最初の画面（splash/grand-splash.tsx）。
 * 「はじめる」を押すまでアプリの上にかぶせておき、押したら閉じる。
 * 閉じるのは click（指を離したとき）なので、下の画面のボタンへ指が突き抜けることはない。
 */
export function StartupSplash({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(true);

  return (
    <>
      {children}
      {visible ? <GrandSplash onFinish={() => setVisible(false)} /> : null}
    </>
  );
}
