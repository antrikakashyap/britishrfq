export type ErrCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'DUPLICATE_REF'
  | 'AUCTION_NOT_STARTED'
  | 'AUCTION_CLOSED'
  | 'BID_NOT_LOWER'
  | 'RATE_LIMITED'
  | 'PAYLOAD_TOO_LARGE'
  | 'BAD_REQUEST'
  | 'DEMO_DISABLED'
  | 'INTERNAL';

export class AppError extends Error {
  constructor(
    readonly code: ErrCode,
    readonly status: number,
    message: string,
    readonly fields?: Record<string, string[]>,
  ) {
    super(message);
  }
}
