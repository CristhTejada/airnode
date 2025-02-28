// The maximum TOTAL time an API call has before it is timed out (including retries).
export const API_CALL_TOTAL_TIMEOUT = 30_000;

// The maximum time an API call has before it is timed out (and retried).
export const API_CALL_TIMEOUT = 30_000;

// The number of past blocks to lookup when fetching Airnode RRP events.
export const BLOCK_COUNT_HISTORY_LIMIT = 300;

// The minimum number of block confirmations required.
export const BLOCK_MIN_CONFIRMATIONS = 0;

// The Convenience contract allows for returning multiple items in order to reduce calls
// to the blockchain provider. This number is the maximum number of items that can get returned
// in a single call.
export const CONVENIENCE_BATCH_SIZE = 10;

// The default amount of time before a "retryable" promise is timed out and retried
export const DEFAULT_RETRY_TIMEOUT_MS = 5_000;

// The amount of time EVM provider calls are allowed
export const EVM_PROVIDER_TIMEOUT = 10_000;

// The maximum amount of time the "initialize provider" worker is allowed before being timed out
export const WORKER_PROVIDER_INITIALIZATION_TIMEOUT = 20_000;

// The maximum amount of time the "process transactions" worker is allowed before being timed out
export const WORKER_PROCESS_TRANSACTIONS_TIMEOUT = 10_000;

// The maximum amount of time the "call API" worker is allowed before being timed out
export const WORKER_CALL_API_TIMEOUT = 30_000;

// The maximum number of requests for a single sponsor wallet in a single Airnode run cycle
export const MAXIMUM_SPONSOR_WALLET_REQUESTS = 5;

// The maximum character length of an error message sent on-chain
export const MAXIMUM_ONCHAIN_ERROR_LENGTH = 100;

// The maximum amount of time in milliseconds that pre and post processing is allowed to execute
export const PROCESSING_TIMEOUT = 10_000;
