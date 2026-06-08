export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    // Palette B: calm warm-paper backdrop. No glowing orbs / grid — the auth
    // card carries the visual weight on a flat, mature surface.
    <div className="relative min-h-screen overflow-hidden bg-[#faf9f7]">
      <div className="relative z-10 min-h-screen">{children}</div>
    </div>
  );
}
