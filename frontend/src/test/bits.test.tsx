// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusBadge } from '../components/bits';
import { ToastHost, useToast } from '../components/Toast';

describe('small components', () => {
  it('shows a readable label for every status', () => {
    const { container } = render(<>{(['SCHEDULED', 'ACTIVE', 'CLOSED', 'FORCE_CLOSED'] as const).map((s) => <StatusBadge key={s} s={s} />)}</>);
    expect([...container.querySelectorAll('.badge')].map((b) => b.textContent?.trim())).toEqual(['Scheduled', 'Active', 'Closed', 'Force closed']);
  });
});
