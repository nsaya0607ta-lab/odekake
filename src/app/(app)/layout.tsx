import { BottomNav } from "@/components/bottom-nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh" style={{ paddingBottom: "calc(var(--nav-height) + var(--safe-bottom))" }}>
      {children}
      <BottomNav />
    </div>
  );
}
