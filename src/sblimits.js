/**
 * The site log's limits, in a module of their own so the log object and the
 * payload assembly can both read them without importing each other.
 */

/** 10% of the Durable Object free allowance per UTC day. */
export const LOG_BUDGET_REF = { requests: 10000, rows: 10000 };

/** Past this, the oldest days of visits are condensed into daily summaries. */
export const GUARD_BYTES = 750 * 1024 * 1024;
