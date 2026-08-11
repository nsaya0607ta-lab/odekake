import { GachaSection } from "./gacha-section";

/** コインの使い道。現在利用できるガチャだけを表示する。 */
export function CoinUseCards({ balance }: { balance: number }) {
  return <GachaSection balance={balance} />;
}
