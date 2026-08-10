import { BottomNav } from "@/components/bottom-nav";
import { LoginBonus } from "@/components/login-bonus";
import { PhotoCleanup } from "@/components/photo-cleanup";
import { RoutePreloader } from "@/components/route-preloader";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh" style={{ paddingBottom: "calc(var(--nav-height) + var(--safe-bottom))" }}>
      {children}
      <RoutePreloader />
      <BottomNav />
      <PhotoCleanup />
      {/* ホームに限らず、その日はじめて開いた画面で出す。
          画面を移っても付け直されないよう、レイアウト側に置いている */}
      <LoginBonus />
    </div>
  );
}
