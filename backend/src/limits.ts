/** Limits that keep responses small and the server safe. Change them here, not in the code that uses them. */
export const LIMITS = {
  /** rows in the "all bids by price" table when the caller does not ask for more */
  bidsDefault: 200,
  /** the most bid rows a caller may ask for (use "all" for no limit) */
  bidsMax: 5000,
  /** newest activity-log lines sent with the details */
  activityCap: 300,
  /** most recent bids sent for the price chart */
  historyCap: 1500,
  /** open live-update connections the server accepts */
  sseMax: 500,
  /** longest search text used to filter the list */
  searchMax: 100,
} as const;
