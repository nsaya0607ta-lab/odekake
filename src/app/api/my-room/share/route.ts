import { handleShareImagePost } from "@/lib/sns/share-image-post";

/** わんこのおへやの記念写真を、SNS（フレンドへの投稿）に写真つきで投稿する */
export async function POST(request: Request) {
  return handleShareImagePost(request, { feature: "my-room", filePrefix: "my-room" });
}
