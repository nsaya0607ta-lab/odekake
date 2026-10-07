/**
 * アプリの画面（ホームを左にスワイプした画面）から開いたページで「戻る」を押したら、アプリの画面へもどす。
 *
 * - ホームの履歴（history.state）に、いまどのページ（0: ホーム、1: アプリの画面）にいるかを書いておく。
 *   ブラウザやスワイプで戻ってきたとき、ホームはそのページで開く（iPhone と同じ）
 * - アプリを開くときは、開いたページの道（path）と、どのアプリかをこのタブ（sessionStorage）に覚える。
 *   そのページの「戻る」は、決められた行き先ではなく、履歴を1つ戻る（＝アプリの画面へ）
 * - ほかのページへ移ったら、しるしは消す（そこからの「戻る」はいつもどおり）
 */

const KEY = "odekake_launcher_return_v1";
/** 履歴が1つしかない（そのページから開いた）ときに、ホームでアプリの画面を開くためのしるし */
const OPEN_KEY = "odekake_launcher_open_v1";
const STATE_KEY = "odekakeHomePage";

export type LaunchReturn = { path: string; id: string; t: number };

/** いまのホームのページを履歴に書いておく（ほかのページから戻ってきたとき、そのページで開く） */
export function rememberHomePage(page: number) {
  try {
    const state = (window.history.state ?? {}) as Record<string, unknown>;
    const value = page === 1 ? 1 : 0;
    if ((state[STATE_KEY] ?? 0) === value) return;
    window.history.replaceState({ ...state, [STATE_KEY]: value }, "");
  } catch {
    // 書けなくても、いつものホームが開くだけ
  }
}

/** 戻ってきたホームを、どのページで開くか */
export function homePageToRestore(): number {
  let open = false;
  try {
    open = window.sessionStorage.getItem(OPEN_KEY) === "1";
    window.sessionStorage.removeItem(OPEN_KEY);
  } catch {
    // 読めなければ履歴だけを見る
  }
  const state = window.history.state as Record<string, unknown> | null;
  return open || state?.[STATE_KEY] === 1 ? 1 : 0;
}

/** アプリの画面からアプリ（ページ）を開くとき */
export function markLaunch(id: string, href: string) {
  rememberHomePage(1);
  try {
    const path = new URL(href, window.location.href).pathname;
    window.sessionStorage.setItem(KEY, JSON.stringify({ path, id, t: Date.now() } satisfies LaunchReturn));
  } catch {
    // 覚えられなければ、いつもの「戻る」になるだけ
  }
}

export function readLaunch(): LaunchReturn | null {
  try {
    const r = JSON.parse(window.sessionStorage.getItem(KEY) ?? "null") as LaunchReturn | null;
    return r && typeof r.path === "string" && typeof r.id === "string" ? r : null;
  } catch {
    return null;
  }
}

export function clearLaunch() {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // 消せなくても、ほかのページへ移れば使われない
  }
}

/** アプリの画面へもどる。ふつうは履歴を1つ戻るだけ。履歴がないときは、ホームをアプリの画面で開く */
export function backToLauncher(push: (href: string) => void) {
  if (window.history.length > 1) {
    window.history.back();
    return;
  }
  try {
    window.sessionStorage.setItem(OPEN_KEY, "1");
  } catch {
    // 覚えられなければ、いつものホームが開く
  }
  push("/home");
}
