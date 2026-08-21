export type SnsSearchScope = "all" | "posts" | "users" | "groups" | "places";

export function parseSnsSearchScope(value: string | undefined): SnsSearchScope {
  return value === "posts" || value === "users" || value === "groups" || value === "places" ? value : "all";
}

export function snsSearchHref(query: string, scope: SnsSearchScope): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (scope !== "all") params.set("scope", scope);
  const suffix = params.toString();
  return suffix ? `/sns/search?${suffix}` : "/sns/search";
}
