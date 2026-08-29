import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * 旧URL。ミニゲームは /games/snack-trail へ移した。
 *
 * ここは (app) の外にあるため、遷移中のフォールバックがアプリ起動画面
 * (app/loading.tsx) になり、ゲームを選ぶたびに起動画面へ戻ったように見えていた。
 * ブックマークや共有リンクのために、転送だけ残しておく。
 */
export default function SnackTrailPreviewRedirect() {
  redirect("/games/snack-trail");
}
