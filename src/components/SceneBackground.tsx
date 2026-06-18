/**
 * Fixed, full-bleed sunset-bridge photo with a moody dark scrim so the dark
 * glass cards and light text read clearly (matching the app mockup).
 * Photo: sunset bridge over a river (Telegram-sourced art).
 */
export default function SceneBackground() {
  return (
    <div className="fixed inset-0 -z-10">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url(/scene.jpg)" }}
      />
      {/* darken for contrast + a touch of warmth, top a bit clearer */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/45 to-black/65" />
      <div className="absolute inset-0 bg-[#2a1530]/20" />
    </div>
  );
}
