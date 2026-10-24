import { ImageResponse } from 'next/og';
import { Mark } from '@/src/components/pwa/Mark';

/**
 * The icons the manifest lists (SPEC §6): 192, 512, and 512 with a safe margin for maskable icons. Drawn at request time
 * from the app mark, so no binary files are kept in the repository.
 */
const ICONS: Record<string, { size: number; pad: number }> = {
  '192': { size: 192, pad: 0 },
  '512': { size: 512, pad: 0 },
  '512-maskable': { size: 512, pad: 102 },
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  const spec = ICONS[name];
  if (!spec) return new Response('Not found', { status: 404 });
  return new ImageResponse(<Mark size={spec.size} pad={spec.pad} />, {
    width: spec.size,
    height: spec.size,
  });
}
