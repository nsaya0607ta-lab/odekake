import type { Metadata } from "next";
import { Suspense } from "react";
import { InfraApp } from "@/components/infra/infra-app";

export const metadata: Metadata = {
  title: "インフラ | おでかけ記録",
  description: "サーバーやネットワークのしくみを、組み立てて動かしながら学べるアプリです。",
};

export default function InfraPage() {
  return (
    <Suspense fallback={null}>
      <InfraApp />
    </Suspense>
  );
}
