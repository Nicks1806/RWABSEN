export default function Loading() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--surface-100)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          border: "3px solid var(--wine-tint)",
          borderTopColor: "var(--wine)",
          borderRadius: "var(--radius-full)",
          animation: "spin 1s linear infinite",
        }}
      />
    </div>
  );
}
