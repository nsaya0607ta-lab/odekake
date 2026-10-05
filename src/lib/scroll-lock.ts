/**
 * モーダルを開いているあいだ、うしろのページがスクロールしないようにする。
 *
 * 以前は body を position: fixed にして、閉じるときに scrollTo で元の位置へ戻していた。
 * iOS Safari ではこの戻し方をすると、下のナビのような fixed 要素が古い位置に描かれたまま残り、
 * 画面のまんなかに浮いてしまうことがある。ページは動かさず、html のスクロールだけを止める
 * （iOS 16 以降の Safari は html の overflow: hidden でスクロールが止まる）。
 *
 * 演出と結果画面のように、モーダルが続けて開いても正しく戻るよう、開いている数を数えて
 * 最後のひとつが閉じたときだけ元にもどす。
 */
let locks = 0;
let saved: { overflow: string; overscroll: string } | null = null;

export function lockPageScroll(): () => void {
  const root = document.documentElement;
  if (locks === 0) {
    saved = { overflow: root.style.overflow, overscroll: root.style.overscrollBehavior };
    root.style.overflow = "hidden";
    root.style.overscrollBehavior = "none";
  }
  locks += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    locks -= 1;
    if (locks === 0 && saved) {
      root.style.overflow = saved.overflow;
      root.style.overscrollBehavior = saved.overscroll;
      saved = null;
    }
  };
}
