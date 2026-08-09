import { getEquippedGear, type GearSlot } from "@/lib/exp";

/**
 * 1枚絵の犬に、解放済みの装備を重ねて出す。
 *
 * 装備の絵は犬の絵とまったく同じ 300×254 で、装備以外は透明。位置合わせの数値を
 * どこにも持たずに済むよう、同じ枠にそのまま重ねるだけにしてある。
 * ホームを歩き回る犬（wandering-frenchie）も同じ絵を同じ順で重ねている。
 */

/** 首輪はバンダナの襟もとにかかるので、バンダナより後に重ねる */
const GEAR_ORDER: GearSlot[] = ["pack", "bandana", "collar", "hat"];

type Props = {
  /** public/characters/frenchie/ の素材名 */
  pose: string;
  level: number;
  className?: string;
};

export function FrenchieWithGear({ pose, level, className }: Props) {
  const equipped = getEquippedGear(level);
  const gear = GEAR_ORDER.flatMap((slot) => equipped.filter((item) => item.slot === slot));

  return (
    <span className={`relative block select-none ${className ?? ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/characters/frenchie/${pose}.webp`}
        alt=""
        width={300}
        height={254}
        draggable={false}
        className="block h-auto w-full"
      />
      {gear.map(({ slot, reward }) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={slot}
          src={`/characters/frenchie/gear/${reward.gear}/${pose}.webp`}
          alt=""
          width={300}
          height={254}
          draggable={false}
          className="absolute inset-0 h-auto w-full"
        />
      ))}
    </span>
  );
}
