import { deleteFriendTextPostAction } from "@/app/actions/sns";
import { IconClose } from "@/components/icons";

export function DeletePostButton({ postId }: { postId: string }) {
  return (
    <form action={deleteFriendTextPostAction}>
      <input type="hidden" name="postId" value={postId} />
      <button
        type="submit"
        aria-label="この投稿を削除"
        className="flex h-6 w-6 items-center justify-center rounded-full text-ink-faint active:bg-paper-deep"
      >
        <IconClose size={13} />
      </button>
    </form>
  );
}
