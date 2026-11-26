export function MaintenanceScreen() {
  return (
    <main
      aria-label="HUNGRY Z"
      style={{
        position: "fixed",
        inset: 0,
        display: "grid",
        placeItems: "center",
        background: "#000",
        color: "#fff",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <h1 style={{ margin: 0, fontSize: "clamp(2rem, 8vw, 4rem)", fontWeight: 700, letterSpacing: "0.04em" }}>
        HUNGRY Z
      </h1>
    </main>
  );
}
