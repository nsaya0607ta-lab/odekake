import { setFriendTextPostLikeAction } from "@/app/actions/sns";
import { IconHeart } from "@/components/icons";

export function LikeButton({
  postId,
  authorUserId,
  liked,
  count,
}: {
  postId: string;
  authorUserId: string;
  liked: boolean;
  count: number;
}) {
  return (
    <form action={setFriendTextPostLikeAction}>
      <input type="hidden" name="postId" value={postId} />
      <input type="hidden" name="authorUserId" value={authorUserId} />
      <input type="hidden" name="liked" value={liked ? "0" : "1"} />
      <button
        type="submit"
        aria-label={liked ? "いいねを取り消す" : "いいねする"}
        aria-pressed={liked}
        className={`flex items-center gap-1.5 rounded-full px-1.5 py-1 transition-colors active:bg-paper-deep ${
          liked ? "text-blossom" : "text-ink-faint"
        }`}
      >
        <IconHeart size={16} filled={liked} />
        {count > 0 ? <span className="text-xs">{count}</span> : null}
      </button>
    </form>
  );
}
