/** 街づくりはユーザー名「しゅん」に限定して公開する。 */
export function canSeeTownBuilder(displayName?: string | null): boolean {
  return displayName?.trim() === "しゅん";
}
