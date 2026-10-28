import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { homePath, isNavActive, ROLE_NAV, type NavItem } from './nav-config';

const APP_DIR = join(process.cwd(), 'app', '[locale]');

/** A route path (`/owner/meters/current`) has a page when every segment is a folder, or a `[param]` folder stands in. */
function routeHasPage(path: string): boolean {
  const segments = path.split('/').filter(Boolean);
  const walk = (dir: string, index: number): boolean => {
    if (index === segments.length) return existsSync(join(dir, 'page.tsx'));
    const literal = join(dir, segments[index]!);
    if (
      existsSync(literal) &&
      statSync(literal).isDirectory() &&
      walk(literal, index + 1)
    )
      return true;
    return readdirSync(dir)
      .filter(
        (name) =>
          name.startsWith('[') && statSync(join(dir, name)).isDirectory(),
      )
      .some((name) => walk(join(dir, name), index + 1));
  };
  return walk(APP_DIR, 0);
}

describe('role navigation (SPEC §3)', () => {
  for (const role of Object.keys(ROLE_NAV) as (keyof typeof ROLE_NAV)[]) {
    describe(role, () => {
      const { tabs, sections } = ROLE_NAV[role];

      it('puts at most four tabs in the bottom bar, before "More"', () => {
        expect(tabs.length).toBeGreaterThan(0);
        expect(tabs.length).toBeLessThanOrEqual(4);
      });

      it('has every tab among the sections, and each section once', () => {
        const keys = sections.map((item) => item.key);
        expect(new Set(keys).size).toBe(keys.length);
        for (const tab of tabs) expect(sections).toContain(tab);
      });

      it('points every section at a real page', () => {
        for (const item of sections) {
          expect(routeHasPage(item.path), item.path).toBe(true);
        }
      });
    });
  }

  it('marks the current section active, and the home pages only on their exact path', () => {
    const home = ROLE_NAV.tenant.sections.find((item) => item.key === 'home')!;
    expect(isNavActive(home, '/th/t', 'th')).toBe(true);
    expect(isNavActive(home, '/th/t/bills', 'th')).toBe(false);

    const meters = ROLE_NAV.owner.sections.find(
      (item) => item.key === 'meters',
    ) as NavItem;
    expect(isNavActive(meters, '/th/owner/meters/2026-09', 'th')).toBe(true);
    expect(isNavActive(meters, '/th/owner/rooms', 'th')).toBe(false);
  });

  it('groups the owner sidebar, each group in one run, with Reports and Settings last and apart', () => {
    const { sections } = ROLE_NAV.owner;
    const groups = sections.map((item) => item.group ?? null);
    const runs = groups.filter(
      (group, i) => i === 0 || group !== groups[i - 1],
    );
    expect(new Set(runs).size).toBe(runs.length);
    expect(runs).toEqual(['month', 'people', 'building', null]);
    expect(sections.at(-1)?.key).toBe('settings');
  });

  it('lands each role on its own start page, which is one of its sections', () => {
    expect(homePath('owner')).toBe('/owner/dashboard');
    expect(homePath('tenant')).toBe('/t');
    for (const role of Object.keys(ROLE_NAV) as (keyof typeof ROLE_NAV)[]) {
      expect(ROLE_NAV[role].sections.map((item) => item.path)).toContain(
        homePath(role),
      );
    }
  });
});
