// Equalizer bars kecil — indikator track sedang bunyi.
// Pakai kelas global .mt-eq dari globals.css.

export function EqBars({ height }: { height?: number }) {
  return (
    <span className="mt-eq" style={height ? { height } : undefined} aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}
