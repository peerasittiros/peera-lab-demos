/**
 * The app mark for icons: a building on the primary colour (SPEC §6, no brand logos). Used by the icon routes, so it is
 * drawn with plain divs for the image renderer. The colours are the RentEase tokens from `src/theme/theme.css`.
 */
const PRIMARY = '#7c3aed';
const SURFACE = '#ffffff';

export function Mark({ size, pad = 0 }: { size: number; pad?: number }) {
  const inner = size - pad * 2;
  const body = inner * 0.5;
  const windowSize = body * 0.16;
  return (
    <div
      style={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: PRIMARY,
      }}
    >
      <div
        style={{
          width: body,
          height: inner * 0.62,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-around',
          alignItems: 'center',
          background: SURFACE,
          borderRadius: body * 0.06,
        }}
      >
        {[0, 1, 2].map((row) => (
          <div key={row} style={{ display: 'flex', gap: windowSize * 1.2 }}>
            <div
              style={{
                width: windowSize,
                height: windowSize,
                background: PRIMARY,
              }}
            />
            <div
              style={{
                width: windowSize,
                height: windowSize,
                background: PRIMARY,
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
