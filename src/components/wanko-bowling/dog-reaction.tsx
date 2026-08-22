"use client";

import Image from "next/image";
import { getFrenchieSrc } from "@/lib/dog-skins";

export type DogReactionKind = "idle" | "sad" | "happy" | "veryHappy" | "spare" | "strike" | "turkey";

const REACTION_ART: Record<DogReactionKind, string> = {
  idle: "stand",
  sad: "yawn",
  happy: "stand-happy",
  veryHappy: "cheer",
  spare: "front",
  strike: "bark",
  turkey: "cheer",
};

const REACTION_ANIM: Record<DogReactionKind, string> = {
  idle: "",
  sad: "wanko-bowl-react-sad",
  happy: "wanko-bowl-react-happy",
  veryHappy: "wanko-bowl-react-very-happy",
  spare: "wanko-bowl-react-jump",
  strike: "wanko-bowl-react-strike",
  turkey: "wanko-bowl-react-strike",
};

export function DogReaction({ reaction }: { reaction: DogReactionKind }) {
  if (reaction === "turkey") {
    return (
      <div className="flex items-end justify-center gap-1" aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className={`relative h-14 w-14 ${REACTION_ANIM.turkey}`}
            style={{ animationDelay: `${index * 90}ms` }}
          >
            <Image
              src={getFrenchieSrc("default", REACTION_ART.turkey)}
              alt=""
              fill
              sizes="56px"
              className="object-contain"
              priority={index === 1}
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`relative mx-auto h-20 w-20 ${REACTION_ANIM[reaction]}`} aria-hidden="true">
      <Image
        src={getFrenchieSrc("default", REACTION_ART[reaction])}
        alt=""
        fill
        sizes="80px"
        className="object-contain"
        priority
      />
    </div>
  );
}
