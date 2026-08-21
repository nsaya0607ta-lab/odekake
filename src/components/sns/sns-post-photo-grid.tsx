/**
 * つぶやきに添付された写真（最大4枚）をTwitterのようなグリッドで並べる。
 * 転送量を抑えるため、渡すURLは常にサムネイル（-thumb）想定。
 * 画面外の画像は loading="lazy" でスクロールするまで読み込まない。
 */
export function SnsPostPhotoGrid({ photoUrls }: { photoUrls: string[] }) {
  if (photoUrls.length === 0) return null;

  if (photoUrls.length === 1) {
    return (
      <div className="mt-2.5 overflow-hidden rounded-2xl bg-paper-deep">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photoUrls[0]} alt="" loading="lazy" decoding="async" className="max-h-96 w-full object-cover" />
      </div>
    );
  }

  if (photoUrls.length === 3) {
    return (
      <div className="mt-2.5 grid aspect-[4/3] grid-cols-2 gap-1 overflow-hidden rounded-2xl">
        <div className="row-span-2 h-full w-full bg-paper-deep">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoUrls[0]} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
        </div>
        {photoUrls.slice(1).map((url, i) => (
          <div key={i} className="h-full w-full bg-paper-deep">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="mt-2.5 grid aspect-square grid-cols-2 gap-1 overflow-hidden rounded-2xl">
      {photoUrls.map((url, i) => (
        <div key={i} className="h-full w-full bg-paper-deep">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
        </div>
      ))}
    </div>
  );
}
