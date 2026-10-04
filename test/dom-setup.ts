// Component tests (React Testing Library) need a DOM. Import this module FIRST
// in a *.test.tsx file; it registers happy-dom globals for that test file only
// (the `bun test --isolate` scripts give every file its own context), so
// server/unit tests elsewhere keep running without a `window`.
//
// Use the `screen` exported HERE, not the one from @testing-library/react:
// that one binds to document.body when its module loads, which under Bun
// happens before this registration runs.
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import { within } from '@testing-library/dom';

if (typeof document === 'undefined') {
  GlobalRegistrator.register({ url: 'http://localhost:3000' });
}
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

export const screen = within(document.body);
