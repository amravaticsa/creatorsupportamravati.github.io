# Migration Number Gaps

Updated: 2026-11-22

## Reserved gap: 0030

The current tracked migration sequence contains 0029 followed by 0031 and 0032. Number 0030 is reserved and is intentionally not backfilled with a no-op migration after higher-numbered migrations have been deployed to staging.

Do not add a retroactive 0030 migration merely to make numbering contiguous. Doing so could cause a migration runner to apply an older version after later migrations have already been deployed. Any future use of 0030 requires a separate review of every target database's migration history and explicit approval.

The next new migration after 0032 is 0033.
