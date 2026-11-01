// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api';
import Activity from '../components/Activity';
import BidForm from '../components/BidForm';
import Leaderboard from '../components/Leaderboard';
import PriceChart from '../components/PriceChart';
import Timeline from '../components/Timeline';
import { ToastHost } from '../components/Toast';
import { details, listItem } from './fixtures';

// plain function (not vi.fn): vitest 5 treats a vi.fn that throws/rejects as a test failure even when the app handles it
let bidImpl: (...a: unknown[]) => unknown = () => { throw new Error('bid mock not set'); };
vi.mock('../api', async (orig) => ({
  ...(await orig<typeof import('../api')>()),
  api: {
    bid: (...a: unknown[]) => bidImpl(...a),
    list: vi.fn(async () => [listItem(), listItem({ id: 2, refId: 'RFQ-T-2', name: 'Force lane', status: 'FORCE_CLOSED', lowestBid: null })]),
    metrics: vi.fn(async () => ({ auctions: { total: 2, scheduled: 0, active: 1, closed: 0, forceClosed: 1 }, bids: { total: 3, avgPerRfq: 1.5 }, extensions: { total: 1, auctionsExtended: 1, extraMinutesGranted: 5 }, comparison: { extended: { auctions: 1, avgBidsPerRfq: 3, avgPriceImprovementPct: 2.5 }, nonExtended: { auctions: 0, avgBidsPerRfq: null } } })),
    meta: vi.fn(async () => ({ demo: false, serverTime: '' })),
    create: vi.fn(),
    simulate: vi.fn(),
  },
}));

const NOW = Date.UTC(2026, 10, 5, 12, 58); // 2 min before... the fixture close (13:05) is 7 min away
const T = (m: number) => Date.UTC(2026, 10, 5, 12, m);

describe('Timeline', () => {
  it('labels bidding open, current/original/forced close and the trigger window', () => {
    render(<Timeline start={T(-120)} origClose={T(60)} close={T(65)} forced={T(120)} now={NOW} winMin={10} live />);
    expect(screen.getByText('Current close')).toBeTruthy();
    expect(screen.getByText('Forced close')).toBeTruthy();
    expect(screen.getByText(/Trigger window \(10 min\)/)).toBeTruthy();
    expect(screen.getByRole('img').getAttribute('aria-label')).toMatch(/forced close/);
  });
  it('shows the original close only after an extension', () => {
    const { rerender } = render(<Timeline start={T(-120)} origClose={T(60)} close={T(60)} forced={T(120)} now={NOW} winMin={10} live />);
    expect(screen.queryByText('Original close')).toBeNull();
    rerender(<Timeline start={T(-120)} origClose={T(60)} close={T(90)} forced={T(120)} now={NOW} winMin={10} live />);
    expect(screen.getByText('Original close')).toBeTruthy();
  });
});

describe('Leaderboard', () => {
  it('ranks suppliers L1, L2 and shows the gap to L1', () => {
    render(<Leaderboard d={details()} final={false} />);
    expect(screen.getByText('L1')).toBeTruthy();
    expect(screen.getByText('L2')).toBeTruthy();
    expect(screen.getByText(/\+\$50\.00 vs L1/)).toBeTruthy();
    expect(screen.getByText('$900.00')).toBeTruthy();
  });
  it('marks the winning bid once the auction is over, and has an empty state', () => {
    render(<Leaderboard d={details('CLOSED')} final />);
    expect(screen.getByText(/winning bid/)).toBeTruthy();
    cleanupAndEmpty();
  });
});
function cleanupAndEmpty() {
  const d = details();
  render(<Leaderboard d={{ ...d, ranking: [] }} final={false} />);
  expect(screen.getByText('No bids yet')).toBeTruthy();
}

describe('Activity', () => {
  it('lists newest first and explains every extension', () => {
    render(<Activity rows={details().activity} />);
    const items = screen.getAllByRole('listitem');
    expect(items[0]!.textContent).toMatch(/Auction extended by 5 min/);
    expect(items[0]!.textContent).toMatch(/Why:/);
    expect(items[0]!.textContent).toMatch(/Close moved/);
    expect(items.at(-1)!.textContent).toMatch(/RFQ created/);
  });
});

describe('PriceChart', () => {
  it('asks for two bids before drawing, then draws one line per supplier with a legend', () => {
    const d = details();
    const { rerender } = render(<PriceChart bids={d.history.slice(0, 1)} activity={[]} cur="USD" />);
    expect(screen.getByText(/appears after two bids/)).toBeTruthy();
    rerender(<PriceChart bids={d.history} activity={d.activity} cur="USD" />);
    expect(screen.getAllByText('Alpha Freight').length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/Line chart/)).toBeTruthy();
  });
});

describe('BidForm', () => {
  beforeEach(() => { bidImpl = () => { throw new Error('bid mock not set'); }; });
  const wrap = (d = details(), now = NOW) => render(<ToastHost><BidForm d={d} now={now} demo={false} onDone={() => {}} /></ToastHost>);

  it('warns that a bid inside the trigger window will extend, and by how much', () => {
    wrap();
    expect(screen.getByText(/Inside the trigger window/)).toBeTruthy();
    expect(screen.getByText(/extends the close by 5 min/)).toBeTruthy();
  });
  it('does not show the warning outside the window', () => {
    wrap(details(), T(-30));
    expect(screen.queryByText(/Inside the trigger window/)).toBeNull();
  });
  it('is replaced by a message when bidding has not started or has ended', () => {
    wrap(details('SCHEDULED'));
    expect(screen.getByText(/Bidding opens/)).toBeTruthy();
    cleanupFn();
    wrap(details('FORCE_CLOSED'));
    expect(screen.getByText(/ended at the Forced Bid Close/)).toBeTruthy();
  });
  it('totals the three charges live', () => {
    wrap();
    fireEvent.change(screen.getByLabelText('Freight'), { target: { value: '800.50' } });
    fireEvent.change(screen.getByLabelText('Origin'), { target: { value: '50' } });
    fireEvent.change(screen.getByLabelText('Destination'), { target: { value: '49.50' } });
    expect(screen.getByText('$900.00')).toBeTruthy();
  });
  it('shows the server field errors next to the inputs', async () => {
    const err = new ApiError('BID_NOT_LOWER', 'Your new total must be lower', 422, { freightCharges: ['A British auction only accepts bids that lower your previous total'] });
    bidImpl = () => Promise.reject(err);
    wrap();
    fireEvent.change(screen.getByLabelText('Carrier name'), { target: { value: 'Bravo Cargo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Place bid' }));
    expect(await screen.findByText(/only accepts bids that lower/)).toBeTruthy();
    expect(screen.getByText('Your new total must be lower')).toBeTruthy();
  });
  it('reminds the supplier of its current bid', () => {
    wrap();
    fireEvent.change(screen.getByLabelText('Carrier name'), { target: { value: 'bravo cargo' } });
    expect(screen.getByText(/Your current bid is \$900\.00 \(L1\)/)).toBeTruthy();
  });
});
function cleanupFn() {
  document.body.innerHTML = '';
}

describe('pages', () => {
  it('Listing shows lowest bid, statuses and the metrics strip', async () => {
    const { default: Listing } = await import('../pages/Listing');
    render(<MemoryRouter><Listing /></MemoryRouter>);
    expect(await screen.findByText('Mumbai → Rotterdam')).toBeTruthy();
    expect(screen.getByText('$900.00')).toBeTruthy();
    expect(screen.getByText('Force closed', { selector: '.badge' })).toBeTruthy();
    expect(await screen.findByText('2.5%')).toBeTruthy();
    expect(screen.getByText('No bids yet')).toBeTruthy();
  });
  it('Create blocks a forced close that is not later than bid close, before calling the API', async () => {
    const { default: Create } = await import('../pages/Create');
    const { api } = await import('../api');
    render(<MemoryRouter><ToastHost><Create /></ToastHost></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('RFQ name'), { target: { value: 'Test lane' } });
    fireEvent.change(screen.getByLabelText('Forced bid close'), { target: { value: (screen.getByLabelText('Bid close') as HTMLInputElement).value } });
    fireEvent.click(screen.getByRole('button', { name: 'Create RFQ' }));
    expect(await screen.findByText('Forced bid close must be later than bid close')).toBeTruthy();
    expect(api.create).not.toHaveBeenCalled();
  });
});
