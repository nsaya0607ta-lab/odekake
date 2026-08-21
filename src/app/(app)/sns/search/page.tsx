import Image from "next/image";
import Link from "next/link";
import { IconClose, IconSearch, IconUser, IconUsers } from "@/components/icons";
import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { SnsBackgroundBand } from "@/components/sns/sns-background-band";
import { SnsGroupList } from "@/components/sns/sns-group-list";
import { SnsTextFeed } from "@/components/sns/sns-text-feed";
import { getFriendList } from "@/lib/data/friends";
import { signThumbOrOriginalPaths } from "@/lib/data/photos";
import {
  getMyFriendGroupSummaries,
  getOwnSnsProfile,
  getPersonalTextFeed,
  getSnsBlockedUsers,
  getSnsTextPostAvatarPaths,
  getSnsTextPostPhotoPaths,
  signGroupIconUrls,
} from "@/lib/data/sns";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "検索 | SNS" };
export const dynamic = "force-dynamic";

type SearchScope = "all" | "posts" | "users" | "groups" | "places";

function parseScope(value: string | undefined): SearchScope {
  return value === "posts" || value === "users" || value === "groups" || value === "places" ? value : "all";
}

function normalize(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("ja");
}

function searchHref(query: string, scope: SearchScope): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (scope !== "all") params.set("scope", scope);
  const suffix = params.toString();
  return suffix ? `/sns/search?${suffix}` : "/sns/search";
}

const SCOPES: { id: SearchScope; label: string }[] = [
  { id: "all", label: "すべて" },
  { id: "posts", label: "投稿" },
  { id: "users", label: "ユーザー" },
  { id: "groups", label: "グループ" },
  { id: "places", label: "場所" },
];

const SEARCH_POST_LIMIT = 80;

export default async function SnsSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; scope?: string }>;
}) {
  const [{ supabase, user }, sp] = await Promise.all([requireUser(), searchParams]);
  const query = (sp.q ?? "").trim().slice(0, 60);
  const needle = normalize(query.replace(/^#/, ""));
  const scope = parseScope(sp.scope);
  const showPosts = scope === "all" || scope === "posts" || scope === "places";
  const showPeople = scope === "all" || scope === "users";
  const showGroups = scope === "all" || scope === "groups";
  const [posts, friends, ownProfile, groups, blockedUsers] = await Promise.all([
    showPosts ? getPersonalTextFeed(supabase, undefined, SEARCH_POST_LIMIT) : Promise.resolve([]),
    showPeople ? getFriendList(supabase) : Promise.resolve([]),
    showPeople
      ? getOwnSnsProfile(supabase, user.id)
      : Promise.resolve({ displayName: user.displayName, iconUrl: undefined as string | undefined }),
    showGroups ? getMyFriendGroupSummaries(supabase) : Promise.resolve([]),
    showPeople ? getSnsBlockedUsers(supabase) : Promise.resolve([]),
  ]);
  const blockedIds = new Set(blockedUsers.map((blocked) => blocked.user_id));
  const people = [
    { id: user.id, displayName: ownProfile.displayName, profilePath: null as string | null, avatarUrl: ownProfile.iconUrl },
    ...friends
      .filter((friend) => !blockedIds.has(friend.friend_user_id))
      .map((friend) => ({
        id: friend.friend_user_id,
        displayName: friend.display_name,
        profilePath: friend.profile_image_url,
        avatarUrl: undefined as string | undefined,
      })),
  ];

  const matchingPosts = posts.filter((post) => {
    if (!needle) return true;
    const haystack = normalize([
      post.body,
      post.display_name,
      post.linked_spot_name,
      post.linked_trip_title,
      post.quoted_body,
      post.quoted_display_name,
      post.quoted_linked_spot_name,
      post.quoted_linked_trip_title,
    ].filter(Boolean).join(" "));
    return haystack.includes(needle);
  });
  const placePosts = matchingPosts.filter((post) => post.linked_spot_id || post.quoted_linked_spot_id);
  const visiblePosts = (scope === "places" ? placePosts : matchingPosts).slice(0, needle ? 60 : 12);
  const matchingPeople = people.filter((person) => !needle || normalize(person.displayName).includes(needle));
  const matchingGroups = groups.filter((group) => !needle || normalize(group.name).includes(needle));
  const allPhotoPaths = getSnsTextPostPhotoPaths(visiblePosts);
  const friendAvatarPaths = matchingPeople.flatMap((person) => person.profilePath ? [person.profilePath] : []);
  const [avatarUrls, photoUrls, peopleAvatarUrls, groupIconUrls] = await Promise.all([
    signThumbOrOriginalPaths(supabase, getSnsTextPostAvatarPaths(visiblePosts)),
    signThumbOrOriginalPaths(supabase, allPhotoPaths),
    signThumbOrOriginalPaths(supabase, friendAvatarPaths),
    signGroupIconUrls(supabase, matchingGroups),
  ]);
  const hashtags = [...new Set(posts.flatMap((post) => post.body.match(/#[\p{L}\p{N}_ー]+/gu) ?? []))].slice(0, 7);
  const totalMatches = (showPosts ? visiblePosts.length : 0)
    + (showPeople ? matchingPeople.length : 0)
    + (showGroups ? matchingGroups.length : 0);

  return (
    <>
      <PageHeader title="SNS検索" subtitle={query ? `「${query}」の検索結果` : "人・投稿・場所をひとつの窓口から"} backHref="/sns/home" />
      <SnsBackgroundBand hasToggleBar={false} />
      <PageBody className="sns-page-shell sns-subpage-body space-y-3">
        <section className="sns-search-hero">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black tracking-[0.16em] text-white/70">DISCOVER</p>
            <h1 className="mt-1 text-xl font-black text-white">次の「行きたい」を探そう</h1>
            <p className="mt-1 text-[11px] font-bold leading-relaxed text-white/75">ハッシュタグ・人・グループ・場所を横断検索</p>
          </div>
          <Image src="/illustrations/sns/search-discovery-v2.webp" alt="" width={112} height={112} priority sizes="112px" />
        </section>

        <form action="/sns/search" method="get" className="sns-search-box" role="search">
          <IconSearch size={20} />
          <input name="q" defaultValue={query} maxLength={60} autoFocus placeholder="キーワード、#タグ、場所を検索" aria-label="SNSを検索" />
          {query ? (
            <Link href="/sns/search" prefetch={false} aria-label="検索語を消す" className="pressable"><IconClose size={16} /></Link>
          ) : null}
        </form>

        <nav className="sns-search-scopes" aria-label="検索対象">
          {SCOPES.map((item) => (
            <Link
              key={item.id}
              href={searchHref(query, item.id)}
              prefetch={false}
              scroll={false}
              aria-current={scope === item.id ? "page" : undefined}
              className={`pressable ${scope === item.id ? "is-active" : ""}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {!query && hashtags.length > 0 ? (
          <section className="sns-search-topics">
            <span className="text-[11px] font-black text-ink-soft">いま見つかるタグ</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {hashtags.map((tag) => (
                <Link key={tag} href={`/sns/search?q=${encodeURIComponent(tag)}`} prefetch={false} className="pressable">{tag}</Link>
              ))}
            </div>
          </section>
        ) : null}

        {query && totalMatches === 0 ? (
          <div className="sns-empty-feed">
            <IconSearch size={30} className="mx-auto text-ink-faint" />
            <p className="mt-3 text-sm font-black">一致するものがありません</p>
            <p className="mt-1 text-xs text-ink-faint">短い言葉や場所の名前でも試してみてください。</p>
          </div>
        ) : null}

        {showPeople && matchingPeople.length > 0 ? (
          <section className="space-y-2">
            <div className="sns-result-heading"><IconUser size={16} /><h2>ユーザー</h2><span>{matchingPeople.length}</span></div>
            <div className="sns-search-people">
              {matchingPeople.slice(0, scope === "users" ? 40 : 6).map((person) => {
                const avatarUrl = person.avatarUrl ?? (person.profilePath ? peopleAvatarUrls.get(person.profilePath) : undefined);
                return (
                  <Link key={person.id} href={`/sns/users/${person.id}`} prefetch={false} className="sns-search-person pressable">
                    <span>{avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={avatarUrl} alt="" loading="lazy" decoding="async" />
                    ) : <IconUser size={20} />}</span>
                    <strong>{person.displayName}</strong>
                    {person.id === user.id ? <small>あなた</small> : null}
                  </Link>
                );
              })}
            </div>
          </section>
        ) : null}

        {showGroups && matchingGroups.length > 0 ? (
          <section className="space-y-2">
            <div className="sns-result-heading"><IconUsers size={16} /><h2>グループ</h2><span>{matchingGroups.length}</span></div>
            <SnsGroupList groups={matchingGroups.slice(0, scope === "groups" ? 40 : 4)} iconUrls={groupIconUrls} currentUserId={user.id} />
          </section>
        ) : null}

        {showPosts && visiblePosts.length > 0 ? (
          <section className="space-y-2">
            <div className="sns-result-heading"><IconSearch size={16} /><h2>{scope === "places" ? "場所つき投稿" : query ? "投稿" : "最近の投稿"}</h2><span>{visiblePosts.length}</span></div>
            <SnsTextFeed
              posts={visiblePosts}
              avatarUrls={avatarUrls}
              photoUrls={photoUrls}
              currentUserId={user.id}
            />
          </section>
        ) : null}
      </PageBody>
    </>
  );
}
