export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_PHOTOS_PER_VISIT = 10;

/** file を指定サイズ以下に縮小してJPEGへ再エンコードする共通処理 */
async function resizeToJpeg(
  file: File,
  maxEdge: number,
  quality: number,
  { skipIfSmall }: { skipIfSmall: boolean },
): Promise<Blob> {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));

    // 十分に小さければ再エンコードしない
    if (skipIfSmall && scale === 1 && file.size <= 1_200_000) {
      bitmap.close();
      return file;
    }

    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return file;
    }
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", quality);
    });

    return blob ?? file;
  } catch {
    return file;
  }
}

/** 大きすぎる画像を縮小して JPEG に変換する。失敗したら元のファイルを返す */
export async function compressImage(file: File, maxEdge = 1600, quality = 0.82): Promise<Blob> {
  return resizeToJpeg(file, maxEdge, quality, { skipIfSmall: true });
}

/**
 * 一覧やアイコンなど小さい表示専用のサムネイルを作る。
 * 元画像がどれだけ大きくても、常にこのサイズまで縮小し直す
 */
export async function compressThumbnail(file: File, maxEdge = 480, quality = 0.75): Promise<Blob> {
  return resizeToJpeg(file, maxEdge, quality, { skipIfSmall: false });
}

export function extensionFor(type: string): string {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

/** 本画像のストレージパスから、対になるサムネイルのパスを決める（拡張子の直前に -thumb を挟む） */
export function toThumbPath(path: string): string {
  const slashIndex = path.lastIndexOf("/");
  const dotIndex = path.lastIndexOf(".");
  if (dotIndex === -1 || dotIndex < slashIndex) return `${path}-thumb`;
  return `${path.slice(0, dotIndex)}-thumb${path.slice(dotIndex)}`;
}
