// Light flat background. Намеренно без three.js / canvas: после созвона
// решили, что фон должен быть простым и нейтральным.
export function LavaLampBackground() {
  return (
    <div
      aria-hidden
      className="fixed inset-0 -z-10 pointer-events-none"
      style={{
        background:
          "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 50%, #e2e8f0 100%)",
      }}
    />
  );
}
