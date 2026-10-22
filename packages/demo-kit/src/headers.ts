/**
 * For `next.config.ts` `headers()`: lets the Peera Lab website (and localhost) frame the demo, nobody else
 * (platform §9.4). `ancestors` is ALLOWED_FRAME_ANCESTORS, space-separated origins.
 */
export function frameHeaders(ancestors: string | undefined) {
  const origins = (ancestors ?? '').split(/\s+/).filter(Boolean);
  return [
    {
      source: '/:path*',
      headers: [
        {
          key: 'Content-Security-Policy',
          value: ["frame-ancestors 'self'", ...origins].join(' '),
        },
      ],
    },
  ];
}
