import { actionSchema, applyKanjiAction, type KanjiAction, type KanjiResponse, type KanjiSnapshot } from "@/lib/games/kakure-kanji/actions";
import { createKeyValueStore, parseSave, type SaveData } from "@/lib/games/kakure-kanji/progress";

type Operation = { userId: string; requestId: string; revision: number; action: KanjiAction; at: number };
type Entry = { operation: Operation; response?: KanjiResponse };
export type AccountState = { save: SaveData | null; busy: boolean; error: string | null };

function readSnapshot(value: unknown): KanjiSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const s = value as KanjiSnapshot;
  if (!Number.isSafeInteger(s.revision) || s.revision < 0 || !Number.isSafeInteger(s.balance) || s.balance < 0) return null;
  const save = s.save === null ? null : parseSave(s.save);
  return s.save !== null && !save ? null : { revision: s.revision, balance: s.balance, save: save ? { ...save, coins: s.balance } : null };
}

/** 判定はすぐ描画し、操作だけを順番に送る。残高・得点の確定は引き続きサーバーで行う。 */
export class KanjiAccountClient {
  state: AccountState = { save: null, busy: true, error: null };
  private snapshot: KanjiSnapshot | null = null;
  private queue: Entry[] = [];
  private running: Promise<boolean> | null = null;
  private ready = false;
  private blocked = true;
  private disposed = false;
  private readonly prefix: string;

  constructor(
    private readonly userId: string,
    private readonly onChange: (state: AccountState) => void,
    private readonly storage: Storage | undefined,
    private readonly request: typeof fetch = (...args) => fetch(...args),
  ) { this.prefix = `odekake_kakure_kanji_pending_v1:${userId}:`; }

  dispose() { this.disposed = true; }

  private publish() {
    let save = this.snapshot?.save ?? null;
    if (this.ready && save) {
      for (const { operation: op } of this.queue) {
        if (op.action.type !== "submit") continue;
        try { save = applyKanjiAction(save, save.coins, op.action, op.at).save; } catch { break; }
      }
    }
    this.state = { ...this.state, save };
    if (!this.disposed) this.onChange(this.state);
  }

  private accept(next: KanjiSnapshot) {
    this.snapshot = next;
    if (next.save && this.storage) {
      try { createKeyValueStore(this.storage, `odekake_kakure_kanji_blue_v1:${this.userId}`).save(next.save); } catch { /* 確定した記録はサーバーにある */ }
    }
    this.publish();
  }

  private forget(op: Operation) {
    try { this.storage?.removeItem(this.prefix + op.requestId); } catch { /* 同じIDの再送はサーバーが重複を防ぐ */ }
  }

  private recover() {
    try {
      if (!this.storage) return;
      for (let i = 0; i < this.storage.length; i++) {
        const key = this.storage.key(i);
        if (!key?.startsWith(this.prefix)) continue;
        try {
          const op = JSON.parse(this.storage.getItem(key) ?? "null") as Operation;
          if (op?.userId === this.userId && /^[0-9a-f-]{36}$/i.test(op.requestId) && key === this.prefix + op.requestId && Number.isSafeInteger(op.revision) && op.revision >= 0 && Number.isSafeInteger(op.at) && actionSchema.safeParse(op.action).success) this.queue.push({ operation: op });
        } catch { /* 壊れた一時記録は使わない */ }
      }
      this.queue.sort((a, b) => a.operation.revision - b.operation.revision || a.operation.at - b.operation.at);
    } catch { /* 一時保存できない端末では、応答まで次の操作を待つ */ }
  }

  private enqueue(action: KanjiAction): { entry: Entry; durable: boolean } {
    const operation: Operation = { userId: this.userId, requestId: crypto.randomUUID(), revision: this.snapshot!.revision + this.queue.length, action, at: Date.now() };
    const entry: Entry = { operation };
    let durable = false;
    try {
      if (this.storage) { this.storage.setItem(this.prefix + operation.requestId, JSON.stringify(operation)); durable = true; }
    } catch { /* 保存できないときは通信が終わるまで次の操作を止める */ }
    this.queue.push(entry);
    return { entry, durable };
  }

  private fail(message: string) {
    this.state = { ...this.state, error: message };
    this.publish();
  }

  private drain(): Promise<boolean> {
    if (this.running) return this.running.then(ok => ok && this.queue.length > 0 ? this.drain() : ok);
    this.running = this.runQueue().finally(() => { this.running = null; });
    return this.running;
  }

  private async runQueue(): Promise<boolean> {
    while (this.queue.length > 0 && !this.disposed && !this.state.error) {
      const entry = this.queue[0];
      if (!entry) break;
      try {
        const response = await this.request("/api/games/kakure-kanji", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(entry.operation), signal: AbortSignal.timeout(20_000) });
        const body = await response.json().catch(() => null);
        if (!response.ok) {
          // 競合・入力エラーでは最新状態に戻す。通信障害・混雑時は同じIDを残して再送する。
          if (body && response.status < 500 && ![408, 429].includes(response.status)) {
            for (const { operation } of this.queue) this.forget(operation);
            this.queue = [];
            const next = readSnapshot(body.snapshot);
            if (next) this.accept(next);
          }
          throw new Error(body?.error ?? "保存できませんでした。同じ操作を再試行できます。");
        }
        const next = readSnapshot(body?.snapshot);
        if (!next?.save) throw new Error("保存結果を読み取れませんでした。再試行してください。");
        entry.response = { snapshot: next, event: body.event ?? {}, replayed: body.replayed === true };
        this.queue.shift(); this.forget(entry.operation); this.accept(next);
      } catch (e) {
        this.fail(e instanceof Error && !["TypeError", "AbortError", "TimeoutError"].includes(e.name) ? e.message : "通信できませんでした。同じ操作を再試行できます。");
        return false;
      }
    }
    return !this.disposed && !this.state.error && this.queue.length === 0;
  }

  private async commit(action: KanjiAction) {
    const { entry } = this.enqueue(action);
    return await this.drain() ? entry.response ?? null : null;
  }

  async initialize() {
    try {
      this.recover();
      const response = await this.request(`/api/games/kakure-kanji?account=${encodeURIComponent(this.userId)}`, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
      const body = await response.json().catch(() => null);
      if (this.disposed) return;
      const next = readSnapshot(body?.snapshot);
      if (!response.ok || !next) throw new Error(body?.error ?? "記録を読み込めませんでした。再試行してください。");
      this.accept(next);
      // 再読み込み前に送った操作は、保存済みでも同じIDで照合してから続ける。
      if (!await this.drain()) return;
      if (!this.snapshot!.save) {
        let legacy: SaveData | undefined;
        try {
          const owner = this.storage?.getItem("odekake_kakure_kanji_legacy_owner");
          if (this.storage && (!owner || owner === this.userId) && this.storage.getItem("odekake_kakure_kanji_v1")) {
            legacy = createKeyValueStore(this.storage).load();
            this.storage.setItem("odekake_kakure_kanji_legacy_owner", this.userId);
          }
        } catch { /* 旧記録がなければ新しく始める */ }
        if (!await this.commit({ type: "initialize", legacy })) return;
      }
      await this.commit({ type: "login" });
    } catch (e) { this.fail(e instanceof Error && !["TypeError", "AbortError", "TimeoutError"].includes(e.name) ? e.message : "記録を読み込めませんでした。再試行してください。"); }
    finally {
      this.ready = !this.state.error && !!this.snapshot?.save;
      this.blocked = false; this.state = { ...this.state, busy: false }; this.publish();
    }
  }

  async act(action: KanjiAction): Promise<KanjiResponse | null> {
    if (!this.ready || this.blocked || this.disposed || this.state.error || !this.state.save) return null;
    if (action.type === "submit") {
      let predicted: ReturnType<typeof applyKanjiAction>;
      try { predicted = applyKanjiAction(this.state.save, this.state.save.coins, action, Date.now()); } catch { return null; }
      const { entry, durable } = this.enqueue(action);
      if (!durable) { this.blocked = true; this.state = { ...this.state, busy: true }; }
      this.publish();
      void this.drain().then(() => {
        if (!durable) { this.blocked = false; this.state = { ...this.state, busy: false }; this.publish(); }
      });
      return { snapshot: { save: predicted.save, balance: predicted.save.coins, revision: entry.operation.revision + 1 }, event: predicted.event };
    }
    // ヒント購入・リセットなどは、先の回答を保存してからサーバーで確定する。
    this.blocked = true; this.state = { ...this.state, busy: true }; this.publish();
    try { return await this.commit(action); }
    finally { this.blocked = false; this.state = { ...this.state, busy: false }; this.publish(); }
  }

  async retry(): Promise<boolean> {
    if (this.running || this.disposed) return false;
    if (this.queue.length === 0) return true;
    this.blocked = true; this.state = { ...this.state, busy: true, error: null }; this.publish();
    try { return await this.drain(); }
    finally { this.blocked = false; this.state = { ...this.state, busy: false }; this.publish(); }
  }
}
