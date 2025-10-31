-- Query to find a random user who completed 1000+ levels
-- and show all their level completion events with timestamps

WITH user_level_counts AS (
  -- Find all users who completed at least 1000 levels
  SELECT
    user_pseudo_id,
    COUNT(DISTINCT (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'level')) as levels_completed
  FROM `cube-wars-15b73.analytics_478520406.events_*`
  WHERE event_name = 'level_complete'
    AND (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'level') IS NOT NULL
  GROUP BY user_pseudo_id
  HAVING levels_completed >= 1000
),
random_user AS (
  -- Select one random user from those who completed 1000+ levels
  SELECT user_pseudo_id
  FROM user_level_counts
  ORDER BY RAND()
  LIMIT 1
)
-- Get all level_complete events for the selected user with timestamps
SELECT
  user_pseudo_id,
  event_name,
  TIMESTAMP_MICROS(event_timestamp) as completion_timestamp,
  DATE(TIMESTAMP_MICROS(event_timestamp)) as completion_date,
  TIME(TIMESTAMP_MICROS(event_timestamp)) as completion_time,
  (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'level') as level,
  (SELECT value.double_value FROM UNNEST(event_params) WHERE key = 'duration_seconds') as duration_seconds,
  -- Calculate time elapsed since first level completion
  TIMESTAMP_DIFF(
    TIMESTAMP_MICROS(event_timestamp),
    FIRST_VALUE(TIMESTAMP_MICROS(event_timestamp)) OVER (ORDER BY event_timestamp),
    SECOND
  ) as seconds_since_first_level,
  -- Add a running count of levels completed
  ROW_NUMBER() OVER (ORDER BY event_timestamp) as level_completion_number
FROM `cube-wars-15b73.analytics_478520406.events_*`
WHERE event_name = 'level_complete'
  AND user_pseudo_id = (SELECT user_pseudo_id FROM random_user)
ORDER BY event_timestamp ASC;
