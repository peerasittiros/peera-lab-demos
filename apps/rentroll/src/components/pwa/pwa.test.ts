import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import manifest from '@/app/manifest';

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');

describe('installable app (SPEC §6)', () => {
  const app = manifest();

  it('opens standalone at the Thai start page, with the RentEase colours', () => {
    expect(app).toMatchObject({
      name: 'Rentroll',
      short_name: 'Rentroll',
      start_url: '/th?source=pwa',
      scope: '/',
      display: 'standalone',
      background_color: '#ffffff',
      theme_color: '#7c3aed',
      lang: 'th',
    });
  });

  it('lists 192, 512 and a maskable 512 icon, each served by the icon route', () => {
    const route = read('app/icons/[name]/route.tsx');
    for (const icon of app.icons ?? []) {
      expect(icon.src.startsWith('/icons/')).toBe(true);
      const name = icon.src.slice('/icons/'.length);
      expect(route).toContain(`'${name}'`);
    }
    expect((app.icons ?? []).some((icon) => icon.purpose === 'maskable')).toBe(
      true,
    );
  });
});

describe('service worker (SPEC §6)', () => {
  const sw = read('public/sw.js');

  it('is served from the root and handles fetch and install', () => {
    expect(existsSync(join(ROOT, 'public/sw.js'))).toBe(true);
    expect(sw).toContain("addEventListener('install'");
    expect(sw).toContain("addEventListener('fetch'");
  });

  it('precaches the Thai and English start and offline pages', () => {
    for (const url of ['/th', '/en', '/th/offline', '/en/offline']) {
      expect(sw).toContain(`'${url}'`);
    }
  });

  it('keeps the snapshot route stale-while-revalidate and never caches visitor data', () => {
    expect(sw).toContain("'/api/demo/snapshot'");
    expect(sw).not.toContain('indexedDB');
  });

  it('is excluded from the locale proxy so it is served as a file', () => {
    const proxy = read('proxy.ts');
    expect(proxy).toContain('sw\\\\.js');
    expect(proxy).toContain('manifest\\\\.webmanifest');
    expect(proxy).toContain('icons/');
  });
});
