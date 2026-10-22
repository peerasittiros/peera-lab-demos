import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
  if (typeof sessionStorage !== 'undefined') sessionStorage.clear();
});

// jsdom lacks the pointer-capture and scrolling APIs that Radix calls. Server tests run in Node: no DOM.
if (typeof Element !== 'undefined') {
  const element = Element.prototype;
  element.hasPointerCapture ??= () => false;
  element.releasePointerCapture ??= () => {};
  element.scrollIntoView ??= () => {};
}
