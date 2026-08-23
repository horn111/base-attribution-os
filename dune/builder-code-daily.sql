-- Base Attribution OS: daily attributed transaction volume
-- Dune parameter: {{builder_code}} (text), for example bc_vwmzy653

WITH decoded AS (
  SELECT
    block_time,
    codes_array
  FROM TABLE(
    functions.base_l2.call_data_8021(
      input => TABLE(
        SELECT
          block_time,
          CAST(data AS varchar) AS calldata
        FROM base.transactions
        WHERE block_time >= current_timestamp - interval '30' day
      ),
      calldata => DESCRIPTOR(calldata)
    )
  )
)
SELECT
  date_trunc('day', block_time) AS day,
  count(*) AS attributed_transactions
FROM decoded
WHERE contains(codes_array, '{{builder_code}}')
GROUP BY 1
ORDER BY 1;
