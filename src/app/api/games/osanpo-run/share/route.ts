import { handleShareImagePost } from "@/lib/sns/share-image-post";

/** おさんぽフレンチーの結果カードを、SNS（フレンドへの投稿）に写真つきで投稿する */
export async function POST(request: Request) {
  return handleShareImagePost(request, { feature: "osanpo-run", filePrefix: "osanpo-run" });
}
