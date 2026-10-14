import { z } from "zod";
import { buildLine, buyFacilityPart, buyParkLot, expandParkLot, placeParkPart, removeFacilityPart, removeParkLot, removeParkPart, upgradeTile, type Town } from "./town-builder";

const tile = z.number().int().min(0).max(575);
const parkSize = z.enum(["small", "medium", "large"]);
const facilityPart = z.enum(["garden", "terrace", "light", "sign", "storage", "greenbelt", "solar", "bench", "vending", "canopy", "planter"]);
const parkPart = z.enum(["tree", "flowers", "bench", "fountain", "playground", "path", "light", "cherry", "pine", "hedge", "pond", "gazebo", "picnic", "swings", "sandbox", "sculpture", "clock", "trash", "bikeRack", "stones", "arch"]);
export const townCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("build"), tool: z.enum(["road", "rail", "station", "house", "shop", "factory", "bulldoze"]), path: z.array(tile).min(1).max(576) }),
  z.object({ type: z.literal("park"), tile, size: parkSize, kind: z.enum(["park", "plaza"]), rotated: z.boolean() }),
  z.object({ type: z.literal("expand"), lotId: tile, size: parkSize }),
  z.object({ type: z.literal("park-part"), lotId: tile, tile, part: parkPart, rotation: z.number().int().min(0).max(3) }),
  z.object({ type: z.literal("remove-park-part"), lotId: tile, tile }),
  z.object({ type: z.literal("remove-park"), lotId: tile }),
  z.object({ type: z.literal("facility-part"), tile, part: facilityPart }),
  z.object({ type: z.literal("remove-facility-part"), tile, part: facilityPart }),
  z.object({ type: z.literal("upgrade"), tile }),
]);
export type TownCommand = z.infer<typeof townCommandSchema>;
export function applyTownCommand(town: Town, command: TownCommand): { town: Town; message: string; lotId?: number } {
  switch (command.type) {
    case "build": return buildLine(town, command.tool, command.path);
    case "park": return buyParkLot(town, command.tile % 24, Math.floor(command.tile / 24), command.size, command.kind, command.rotated);
    case "expand": return expandParkLot(town, command.lotId, command.size);
    case "park-part": return placeParkPart(town, command.lotId, command.tile, command.part, command.rotation);
    case "remove-park-part": return removeParkPart(town, command.lotId, command.tile);
    case "remove-park": return removeParkLot(town, command.lotId);
    case "facility-part": return buyFacilityPart(town, command.tile, command.part);
    case "remove-facility-part": return removeFacilityPart(town, command.tile, command.part);
    case "upgrade": return upgradeTile(town, command.tile);
  }
}
