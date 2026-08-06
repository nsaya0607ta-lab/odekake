import Link from "next/link";
import { switchWorkspaceAction } from "@/app/actions/workspace";
import { IconCheck, IconFlag, IconPlus, IconUsers } from "@/components/icons";
import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { formatTripPeriod } from "@/lib/data/trips";
import { listWorkspaces } from "@/lib/data/workspace";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "旅を選ぶ | おでかけ記録" };
export const dynamic = "force-dynamic";

export default async function WorkspacesPage() {
  const { supabase, user } = await requireUser();
  const workspaces = await listWorkspaces(supabase, user.id);

  const personal = workspaces.filter((w) => w.kind === "personal");
  const shared = workspaces.filter((w) => w.kind === "trip");

  return (
    <>
      <PageHeader title="旅を選ぶ" backHref="/home" />
      <PageBody>
        <p className="rough-card px-4 py-3 text-sm leading-relaxed text-ink-soft">
          個人旅と共有旅は別々の画面として扱われます。選んだ画面の地図・記録・スポットだけが表示され、
          新しい旅行も同じ種類で作成されます。
        </p>

        <section>
          <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
            <h2 className="text-base font-bold">個人旅</h2>
            <Link href="/trips/new/personal" className="flex items-center gap-0.5 text-sm text-leaf-deep">
              <IconPlus size={15} />
              つくる
            </Link>
          </div>
          <ul className="space-y-2">
            {personal.map((workspace) => (
              <li key={workspace.id}>
                <WorkspaceRow workspace={workspace} />
              </li>
            ))}
          </ul>
        </section>

        <section>
          <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
            <h2 className="text-base font-bold">
              共有旅
              {shared.length > 0 ? (
                <span className="ml-1.5 text-sm font-normal text-ink-faint tabular-nums">{shared.length}件</span>
              ) : null}
            </h2>
            <Link href="/trips/new/shared" className="flex items-center gap-0.5 text-sm text-leaf-deep">
              <IconPlus size={15} />
              つくる
            </Link>
          </div>

          {shared.length === 0 ? (
            <p className="rough-card px-4 py-6 text-center text-sm text-ink-soft">
              参加している共有旅はありません。
              <br />
              新しくつくるか、招待コードで参加してください。
            </p>
          ) : (
            <ul className="space-y-2">
              {shared.map((workspace) => (
                <li key={workspace.id}>
                  <WorkspaceRow workspace={workspace} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <Link href="/invitations" className="btn btn-quiet w-full">
          招待コードで共有旅に参加する
        </Link>
      </PageBody>
    </>
  );
}

function WorkspaceRow({
  workspace,
}: {
  workspace: Awaited<ReturnType<typeof listWorkspaces>>[number];
}) {
  const period = workspace.trip ? formatTripPeriod(workspace.trip) : null;
  const subtitle =
    workspace.kind === "personal"
      ? `個人旅 ${workspace.tripIds.length}件・${workspace.visitCount}件の記録`
      : [period, `${workspace.visitCount}件の記録`].filter(Boolean).join("・");

  return (
    <form action={switchWorkspaceAction}>
      <input type="hidden" name="workspaceId" value={workspace.id} />
      <button
        type="submit"
        aria-current={workspace.isCurrent ? "true" : undefined}
        className={`rough-card flex w-full items-center gap-3 px-4 py-3 text-left transition-transform active:scale-[0.99] ${
          workspace.isCurrent ? "border-leaf bg-leaf-soft" : ""
        }`}
      >
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
            workspace.kind === "personal" ? "bg-blossom-soft text-[#95505e]" : "bg-sky-soft text-[#42718f]"
          }`}
        >
          {workspace.kind === "personal" ? <IconFlag size={19} /> : <IconUsers size={19} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{workspace.name}</span>
          <span className="mt-0.5 block truncate text-xs text-ink-faint">{subtitle}</span>
        </span>
        {workspace.kind === "trip" ? (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-paper-deep px-2.5 py-1 text-[11px] font-semibold text-ink-soft">
            <IconUsers size={13} />
            <span className="tabular-nums">{workspace.memberCount}</span>人
          </span>
        ) : null}
        {workspace.isCurrent ? <IconCheck size={18} className="shrink-0 text-leaf-deep" /> : null}
      </button>
    </form>
  );
}
