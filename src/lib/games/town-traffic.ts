import { MAP_SIZE } from "./town-builder";
import { sampleTransportPath } from "./town-transport";

/**
 * Cars on the town's roads. Each keeps to the left lane, keeps its distance from the car in front,
 * waits at the stop line while another car is crossing a junction, and stops where the rules say
 * (red lights, a closed level crossing). Nothing is random per frame, so the same frames look the same.
 */
export type VehicleModel = "sedan" | "kei" | "van" | "truck" | "bus" | "taxi";
export type Vehicle = {
  previous: number; from: number; to: number; next: number;
  /** 0..1 along from → to (tile centres). */
  t: number; color: string; seed: number; model: VehicleModel; alpha: number;
  /** Seconds spent held up behind another car; after a while it squeezes past, so the town never locks up. */
  wait: number;
  /** Town seconds standing at a stop line (a stop sign wants a full stop first). */
  halt: number;
  /** A bus: seconds left standing at a stop, and the stop it has just served. */
  dwell: number; served: number;
};
/** Where a car is drawn: position on the ground (tile units) and heading. */
export type VehiclePose = { vehicle: Vehicle; x: number; y: number; dx: number; dy: number };
/** Extra rules from the town: may this car coming from `from` drive into `tile` now? */
export type TrafficGate = (tile: number, from: number, vehicle: Vehicle) => boolean;

export const CAR_COLORS = ["#f0d29d", "#c8786c", "#60899b", "#eee7cf", "#879677", "#d9a35f", "#7d8fb3", "#b9615a", "#e6e2d6", "#4f6a78"];
/** Length of road a car keeps clear in front of it (tile units, centre to centre). */
export const FOLLOW = .42;
/** A car enters a junction when it is this far (0..1) along the road leading into it. */
export const STOP_LINE = .6;
/** A bus stands this far past the middle of a bus-stop tile, beside the shelter. */
export const BUS_STOP_T = .15;
const SPEED = .65;
const hash = (n: number) => { const v = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };
const modelOf = (seed: number): VehicleModel => seed % 7 === 3 ? "truck" : seed % 5 === 2 ? "kei" : seed % 6 === 4 ? "van" : seed % 9 === 7 ? "taxi" : "sedan";
/** Body length (tile units). */
export const vehicleLength = (model: VehicleModel) => model === "bus" ? .42 : model === "truck" ? .27 : model === "van" ? .25 : model === "kei" ? .19 : .23;
/** Centre-to-centre distance a vehicle keeps behind another: FOLLOW for two cars, more behind or in front of a bus. */
const gap = (a: Vehicle, b: Vehicle) => FOLLOW - .23 + (vehicleLength(a.model) + vehicleLength(b.model)) / 2;
export const BUS_COLOR = "#3f8f6e";
const TAXI_COLORS = ["#f0c64e", "#2f3437", "#4f8f6a", "#e9e4d6"];
/** Body colour: buses wear the town's green, taxis their company colours, cars anything. */
const colorOf = (model: VehicleModel, seed: number) => model === "bus" ? BUS_COLOR : model === "taxi" ? TAXI_COLORS[seed % TAXI_COLORS.length]! : CAR_COLORS[seed % CAR_COLORS.length]!;

export class Traffic {
  vehicles: Vehicle[] = [];
  private roads = new Map<number, number[]>();
  private junction = (tile: number) => (this.roads.get(tile)?.length ?? 0) >= 3;
  /** Tiles a car must never stop on (level crossings): it waits before them until the way out is clear. */
  private keepClear: (tile: number) => boolean = () => false;
  private busStops: ReadonlySet<number> = new Set();

  /**
   * Keep the cars whose roads are still there and fill up to about one car per three road tiles. With bus stops in
   * town, the first few vehicles are buses.
   */
  sync(roads: Map<number, number[]>, isRoad: (tile: number) => boolean, keepClear: (tile: number) => boolean = () => false, busStops: ReadonlySet<number> = new Set()) {
    this.roads = roads; this.keepClear = keepClear; this.busStops = busStops;
    const tiles = [...roads].filter(([, next]) => next.length).map(([i]) => i);
    this.vehicles = this.vehicles.filter(v => [v.previous, v.from, v.to, v.next].every(isRoad));
    const target = Math.min(22, Math.floor(tiles.length / 3));
    while (this.vehicles.length < target) {
      const j = this.vehicles.length, from = tiles[Math.floor(hash(j + 8) * tiles.length)]!, to = roads.get(from)![0]!;
      const previous = roads.get(from)!.find(n => n !== to) ?? to, next = roads.get(to)!.find(n => n !== from) ?? from;
      // Start between junctions, never inside one, and clear of the cars already in the lane (room for a bus).
      const free = (t: number) => !(this.junction(to) && t >= STOP_LINE || this.junction(from) && t < 1 - STOP_LINE) && !this.vehicles.some(o => o.from === from && o.to === to && Math.abs(o.t - t) < FOLLOW + .2);
      const t = [hash(j), .5, .05, .95, .25, .75].find(free) ?? hash(j);
      this.vehicles.push({ from, to, previous, next, t, seed: j, color: colorOf(modelOf(j), j), model: modelOf(j), alpha: 1, wait: 0, halt: 0, dwell: 0, served: -1 });
    }
    this.vehicles = this.vehicles.slice(0, target);
    const buses = busStops.size ? Math.min(4, 1 + Math.floor(busStops.size / 2), this.vehicles.length) : 0;
    this.vehicles.forEach((v, j) => {
      const model = j < buses ? "bus" : modelOf(v.seed);
      if (model !== v.model) { v.model = model; v.color = colorOf(model, v.seed); v.dwell = 0; }
    });
  }
  /** Is a car on `tile` between its stop lines, using the arm towards `near` (or any arm when null)? People wait for it. */
  occupied(tile: number, near: number | null) {
    return this.vehicles.some(v => v.alpha > 0 && (v.to === tile && v.t >= STOP_LINE - .05 && (near === null || v.from === near || v.next === near)
      || v.from === tile && v.t < 1 - STOP_LINE + .05 && (near === null || v.to === near || v.previous === near)));
  }
  /** How long the longest-waiting car has stood at the stop line into `tile` from `from` (any arm when null). */
  waiting(tile: number, from: number | null) {
    let most = 0;
    for (const v of this.vehicles) if (v.alpha > 0 && v.to === tile && (from === null || v.from === from) && v.t > STOP_LINE - .15) most = Math.max(most, v.halt);
    return most;
  }
  /** Buses standing at their stops now: the stop tile and the way the bus is heading. */
  dwelling() { return this.vehicles.filter(v => v.model === "bus" && v.dwell > 0 && v.alpha > 0).map(v => ({ tile: v.from, dx: v.to % MAP_SIZE - v.from % MAP_SIZE, dy: Math.floor(v.to / MAP_SIZE) - Math.floor(v.from / MAP_SIZE) })); }
  /** `traffic` (0..1) is how many of the cars are out; the rest fade away. `time` drives the choice of turns. */
  update(step: number, move: number, traffic: number, time: number, gate?: TrafficGate) {
    const active = Math.max(1, Math.round(this.vehicles.length * traffic));
    this.vehicles.forEach((v, index) => { v.alpha = Math.max(0, Math.min(1, v.alpha + (index < active ? 1 : -1) * step * 1.5)); });
    if (move <= 0) return;
    const live = this.vehicles.filter(v => v.alpha > 0), lanes = new Map<string, Vehicle[]>(), inside = new Map<number, Vehicle>();
    for (const v of live) {
      const key = `${v.from}>${v.to}`; (lanes.get(key) ?? lanes.set(key, []).get(key)!).push(v);
      if (this.junction(v.to) && v.t >= STOP_LINE) inside.set(v.to, v); else if (this.junction(v.from) && v.t < 1 - STOP_LINE) inside.set(v.from, v);
    }
    for (const v of this.vehicles) {
      const want = move * SPEED;
      let follow = Infinity, hold = Infinity, held = false;
      // Cars faded out of sight (a quiet hour) still keep the rules, so they come back in a sensible place;
      // the cars on show simply do not wait for them.
      {
        // The vehicle in front, in this lane or just round the next turn.
        for (const o of lanes.get(`${v.from}>${v.to}`) ?? []) if (o !== v && (o.t > v.t || o.t === v.t && o.seed < v.seed)) follow = Math.min(follow, o.t - v.t - gap(v, o));
        for (const o of lanes.get(`${v.to}>${v.next}`) ?? []) if (o !== v) follow = Math.min(follow, 1 - v.t + o.t - gap(v, o));
        // At the stop line: wait while another car is in the junction, while the way out is full
        // (never stop inside a junction or on a level crossing), or while the town says stop.
        if (v.t < STOP_LINE && v.t + want >= STOP_LINE) {
          const junction = this.junction(v.to), box = junction || this.keepClear(v.to);
          const busy = junction && inside.has(v.to) && inside.get(v.to) !== v || box && (lanes.get(`${v.to}>${v.next}`) ?? []).some(o => o !== v && o.t < 1 - STOP_LINE + gap(v, o));
          if (busy || gate && !gate(v.to, v.from, v)) { hold = STOP_LINE - .001 - v.t; held = true; }
        }
        // A bus stands at each stop for a while, beside the shelter.
        if (v.model === "bus") {
          if (v.dwell > 0) { hold = 0; v.dwell -= move; if (v.dwell <= 0) { v.dwell = 0; v.served = v.from; } }
          else if (this.busStops.has(v.from) && v.served !== v.from && v.t < BUS_STOP_T && v.t + want >= BUS_STOP_T && follow > BUS_STOP_T - v.t) { hold = Math.min(hold, BUS_STOP_T - v.t); v.dwell = 3.2; }
        }
        // Held up behind another car for very long (longer than any red light): squeeze past rather than lock the town up.
        if (v.wait > 20) follow = Infinity;
      }
      const go = Math.max(0, Math.min(want, follow, hold));
      v.wait = go < want * .5 && follow < hold ? v.wait + step : 0;
      v.halt = held ? v.halt + move : 0;
      v.t += go;
      if (this.junction(v.to) && v.t >= STOP_LINE && v.alpha > 0) inside.set(v.to, v);
      if (v.t >= 1) {
        const lane = lanes.get(`${v.from}>${v.to}`); if (lane) lanes.set(`${v.from}>${v.to}`, lane.filter(o => o !== v));
        v.t -= 1; v.previous = v.from; v.from = v.to; v.to = v.next;
        if (v.served === v.previous) v.served = -1;
        const choices = this.roads.get(v.to)?.filter(n => n !== v.from) ?? [];
        v.next = choices.length ? choices[Math.floor(hash(time * .1 + v.seed) * choices.length)]! : v.from;
        const key = `${v.from}>${v.to}`; (lanes.get(key) ?? lanes.set(key, []).get(key)!).push(v);
      }
    }
  }
  /** Ground positions and headings, in the left-hand lane. */
  poses(): VehiclePose[] {
    return this.vehicles.filter(v => v.alpha > 0).map(v => {
      const p = sampleTransportPath([v.previous, v.from, v.to, v.next], 1 + v.t);
      return { vehicle: v, x: p.x + (p.laneApplied ? 0 : p.dy * .13), y: p.y - (p.laneApplied ? 0 : p.dx * .13), dx: p.dx, dy: p.dy };
    });
  }
}
