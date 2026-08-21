import { redirect } from "next/navigation";

/** 個人アカウント画面は /sns/home に統合された。旧リンク・ブックマーク互換のため転送する */
export default function SnsPersonalPage() {
  redirect("/sns/home");
}
