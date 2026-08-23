-- Base Attribution OS: Builder Code transaction replay
-- Dune parameter: {{builder_code}} (text), for example bc_vwmzy653
-- Export this query as JSON or CSV and run:
-- bao replay --builder-code bc_vwmzy653 --input dune-export.csv

WITH base_transactions AS (
  SELECT
    hash AS tx_hash,
    block_time,
    block_number,
    "from" AS sender,
    "to" AS recipient,
    CAST(data AS varchar) AS calldata
  FROM base.transactions
  WHERE block_time >= current_timestamp - interval '30' day
),
decoded AS (
  SELECT
    tx_hash,
    block_time,
    block_number,
    sender,
    recipient,
    calldata,
    schema_type,
    codes_readable,
    codes_array,
    erc_8021_suffix
  FROM TABLE(
    functions.base_l2.call_data_8021(
      input => TABLE(base_transactions),
      calldata => DESCRIPTOR(calldata)
    )
  )
)
SELECT
  tx_hash,
  block_time,
  block_number,
  sender,
  recipient,
  calldata,
  schema_type,
  codes_readable,
  codes_array,
  erc_8021_suffix
FROM decoded
WHERE contains(codes_array, '{{builder_code}}')
ORDER BY block_time DESC;
