import { copyFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(
  new URL(
    '../../peera-lab-design-system/design-system/tokens.css',
    import.meta.url,
  ),
);
const destination = fileURLToPath(
  new URL('../packages/ui/src/tokens.css', import.meta.url),
);

try {
  await access(source);
} catch {
  console.error(`Cannot find the website design tokens at ${source}`);
  process.exitCode = 1;
}

if (process.exitCode !== 1) {
  await copyFile(source, destination);
  console.log(`Synced ${source} → ${destination}`);
}
