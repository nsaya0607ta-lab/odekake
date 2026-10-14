type TouchPoint = { pointerId: number; pointerType: string; isPrimary: boolean; clientX: number; clientY: number };

/** Some mobile browsers omit the compatibility click just after map panning.
 * Activate a stationary touch on release, then discard only its duplicate click.
 * Mouse, keyboard and assistive-technology activation keep their native behavior.
 */
export class TownTouchControls {
  private press: { target: HTMLElement; id: number; x: number; y: number; moved: boolean } | null = null;
  private last: { id: number; until: number } | null = null;
  private activating = false;
  constructor(private readonly now = () => performance.now()) {}
  start(target: HTMLElement | null, e: TouchPoint) {
    if (e.pointerType !== "touch") { this.last = null; this.press = null; return; }
    if (!e.isPrimary) { this.cancel(); return; }
    this.last = null;
    this.press = target && e.isPrimary && !target.matches(":disabled") ? { target, id: e.pointerId, x: e.clientX, y: e.clientY, moved: false } : null;
  }
  move(e: TouchPoint) {
    const p = this.press;
    if (p && p.id === e.pointerId && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 8) p.moved = true;
  }
  cancel(id?: number) {
    if (this.press && (id === undefined || this.press.id === id)) {
      this.last = { id: this.press.id, until: this.now() + 750 };
      this.press = null;
    }
  }
  end(e: TouchPoint) {
    const p = this.press; if (!p || p.id !== e.pointerId) return;
    this.press = null;
    const activation = { id: p.id, until: this.now() + 750 };
    this.last = activation;
    if (p.moved || !p.target.isConnected || p.target.matches(":disabled")) return;
    const r = p.target.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;
    this.activating = true;
    try { p.target.click(); } finally {
      this.activating = false;
      // A confirmation dialog may hold the original event open for several seconds.
      if (this.last === activation) activation.until = this.now() + 750;
    }
  }
  suppressClick(detail: number, pointerType = "", pointerId?: number) {
    if (this.activating || !this.last || detail === 0 && pointerType !== "touch") return false;
    if (pointerType === "touch" && pointerId !== undefined && pointerId !== this.last.id) return false;
    // Layout/font work can delay the same gesture's click beyond 750 ms on a phone.
    // A new physical gesture calls start() and clears last; a positively identified
    // duplicate remains a duplicate even when its dispatch was delayed.
    const sameTouch = pointerType === "touch" && pointerId === this.last.id;
    if (!sameTouch && this.now() > this.last.until) return false;
    // Closing a drawer can retarget the delayed click to a newly exposed button.
    this.last = null; return true;
  }
}
