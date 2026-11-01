import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

class FakeES { onopen: null | (() => void) = null; onerror: null | (() => void) = null; addEventListener() {} close() {} }
vi.stubGlobal('EventSource', FakeES);
afterEach(cleanup);
