/**
 * わんこのおへやの記念写真をつくる。
 * 画面に出ている部屋（背景の SVG・飾ったもの・犬）を、そのままの位置と重なり順で 1 枚の JPEG に描き直す。
 * 画像はどれも同じオリジン（/characters, /collection, /api/photo）なので、キャンバスは汚れない。
 *
 * 部屋の要素には次の data 属性を付けておく（my-room.tsx / room-dog.tsx）
 * - [data-pid]    置いたもの1つ。data-rot（度）と data-flip（"1"）を持つ
 * - [data-body]   その中身（大きさは回転の影響を受けない offsetWidth/Height を使う）
 * - [data-shadow] 床に落ちる影
 * - [data-frame]  写真の額縁（枠の色・太さ・下の余白は computed style から読む）
 * - [data-dog]    犬
 */

const OUT_W = 1080;
const FOOTER = 150;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`image failed: ${src.slice(0, 80)}`));
    img.src = src;
  });
}

/** インラインの SVG を画像にする */
async function svgImage(svg: SVGSVGElement, w: number, h: number): Promise<HTMLImageElement> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(Math.max(1, Math.round(w))));
  clone.setAttribute("height", String(Math.max(1, Math.round(h))));
  const text = new XMLSerializer().serializeToString(clone);
  const url = URL.createObjectURL(new Blob([text], { type: "image/svg+xml;charset=utf-8" }));
  try {
    return await loadImage(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** object-fit: cover と同じ切り抜きで描く */
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const k = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = w / k, sh = h / k;
  ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, x, y, w, h);
}

const centerOf = (r: DOMRect) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

export async function composeRoomSnapshot(room: HTMLElement, caption: { title: string; sub: string; fontFamily: string }): Promise<Blob> {
  const box = room.getBoundingClientRect();
  const s = OUT_W / box.width;
  const roomH = Math.round(box.height * s);
  const canvas = document.createElement("canvas");
  canvas.width = OUT_W;
  canvas.height = roomH + FOOTER;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  const local = (x: number, y: number) => ({ x: (x - box.left) * s, y: (y - box.top) * s });

  // 背景（壁・窓・床…）
  const scene = room.querySelector<SVGSVGElement>(":scope > svg");
  if (scene) ctx.drawImage(await svgImage(scene, OUT_W, roomH), 0, 0, OUT_W, roomH);

  // 飾ったものと犬を、画面と同じ重なり順で
  const layers = Array.from(room.querySelectorAll<HTMLElement>(":scope > [data-pid], :scope > [data-dog]"))
    .sort((a, b) => Number(getComputedStyle(a).zIndex || 0) - Number(getComputedStyle(b).zIndex || 0));

  for (const el of layers) {
    const body = el.querySelector<HTMLElement>("[data-body]") ?? el;
    const rect = body.getBoundingClientRect();
    const c = local(centerOf(rect).x, centerOf(rect).y);
    const w = body.offsetWidth * s, h = body.offsetHeight * s;
    const shadow = el.querySelector<HTMLElement>("[data-shadow]");
    if (shadow) {
      const r = shadow.getBoundingClientRect(), sc = local(centerOf(r).x, centerOf(r).y);
      ctx.save();
      ctx.fillStyle = "rgba(74,53,32,0.16)";
      ctx.beginPath(); ctx.ellipse(sc.x, sc.y, (r.width * s) / 2, (r.height * s) / 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(((Number(el.dataset.rot) || 0) * Math.PI) / 180);
    if (el.dataset.flip === "1") ctx.scale(-1, 1);
    try {
      const frame = body.querySelector<HTMLElement>("[data-frame]");
      const svg = body.querySelector<SVGSVGElement>("svg");
      const img = body instanceof HTMLImageElement ? body : body.querySelector<HTMLImageElement>("img");
      if (frame && img) {
        // 額縁：枠の色 → 中の色 → 写真
        const cs = getComputedStyle(frame);
        const bw = parseFloat(cs.borderTopWidth) * s;
        ctx.shadowColor = "rgba(50,35,20,0.28)"; ctx.shadowBlur = 10 * s; ctx.shadowOffsetY = 5 * s;
        ctx.fillStyle = cs.borderTopColor; ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.shadowColor = "transparent";
        ctx.fillStyle = cs.backgroundColor !== "rgba(0, 0, 0, 0)" ? cs.backgroundColor : cs.borderTopColor;
        ctx.fillRect(-w / 2 + bw, -h / 2 + bw, w - bw * 2, h - bw * 2);
        const ir = img.getBoundingClientRect();
        const ic = local(centerOf(ir).x, centerOf(ir).y);
        const iw = img.offsetWidth * s, ih = img.offsetHeight * s;
        const pic = await loadImage(img.currentSrc || img.src);
        drawCover(ctx, pic, ic.x - c.x - iw / 2, ic.y - c.y - ih / 2, iw, ih);
      } else if (svg) {
        ctx.drawImage(await svgImage(svg, w, h), -w / 2, -h / 2, w, h);
      } else if (img) {
        const pic = await loadImage(img.currentSrc || img.src);
        if (img.style.transform.includes("scaleX(-1)")) ctx.scale(-1, 1);
        ctx.drawImage(pic, -w / 2, -h / 2, w, h);
      }
    } catch {
      // 読めなかったものは飛ばす
    }
    ctx.restore();
  }

  // 時間帯の明かり（夜の暗さ・ランプのまわりの明るさ・四すみのかげ）
  const lighting = room.querySelector<SVGSVGElement>("[data-lighting]");
  if (lighting) {
    try { ctx.drawImage(await svgImage(lighting, OUT_W, roomH), 0, 0, OUT_W, roomH); } catch { /* 明かりなしで続ける */ }
  }

  // 下の帯：タイトルと日付
  ctx.fillStyle = "#FFFAF0";
  ctx.fillRect(0, roomH, OUT_W, FOOTER);
  ctx.fillStyle = "#E9DCC6";
  ctx.fillRect(0, roomH, OUT_W, 4);
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = "#5E8C4A";
  ctx.font = `800 26px ${caption.fontFamily}`;
  ctx.fillText("MY ROOM", 56, roomH + 56);
  ctx.fillStyle = "#3A2A1C";
  ctx.font = `800 46px ${caption.fontFamily}`;
  ctx.fillText(caption.title, 56, roomH + 112);
  ctx.textAlign = "right";
  ctx.fillStyle = "#8A7A68";
  ctx.font = `600 28px ${caption.fontFamily}`;
  ctx.fillText(caption.sub, OUT_W - 56, roomH + 108);
  ctx.font = "40px sans-serif";
  ctx.fillText("🐾", OUT_W - 56, roomH + 60);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", 0.9));
}
