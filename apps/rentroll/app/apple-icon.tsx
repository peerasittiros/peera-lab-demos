import { ImageResponse } from 'next/og';
import { Mark } from '@/src/components/pwa/Mark';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

/** The icon iOS uses when the app is added to the home screen. */
export default function AppleIcon() {
  return new ImageResponse(<Mark size={180} />, size);
}
