import { BottomNav } from "@/components/bottom-nav";
import { PhotoCleanup } from "@/components/photo-cleanup";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh" style={{ paddingBottom: "calc(var(--nav-height) + var(--safe-bottom))" }}>
      {children}
      <BottomNav />
      <PhotoCleanup />
    </div>
  );
}
