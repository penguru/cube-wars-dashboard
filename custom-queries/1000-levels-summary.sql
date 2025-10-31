-- Summary query: How long did it take a random user to complete 1000 levels?
-- Provides high-level statistics and key milestones

WITH user_level_counts AS (
  -- Find all users who completed at least 1000 levels
  SELECT
    user_pseudo_id,
    COUNT(*) as total_completions
  FROM `cube-wars-15b73.analytics_478520406.events_*`
  WHERE event_name = 'level_complete'
    AND (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'level') IS NOT NULL
  GROUP BY user_pseudo_id
  HAVING total_completions >= 1000
),
random_user AS (
  -- Select one random user
  SELECT user_pseudo_id
  FROM user_level_counts
  ORDER BY RAND()
  LIMIT 1
),
completions_ranked AS (
  SELECT
    user_pseudo_id,
    TIMESTAMP_MICROS(event_timestamp) as completion_timestamp,
    (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'level') as level,
    ROW_NUMBER() OVER (ORDER BY event_timestamp) as completion_number
  FROM `cube-wars-15b73.analytics_478520406.events_*`
  WHERE event_name = 'level_complete'
    AND user_pseudo_id = (SELECT user_pseudo_id FROM random_user)
),
milestones AS (
  SELECT
    user_pseudo_id,
    MAX(CASE WHEN completion_number = 1 THEN completion_timestamp END) as first_level_time,
    MAX(CASE WHEN completion_number = 100 THEN completion_timestamp END) as level_100_time,
    MAX(CASE WHEN completion_number = 250 THEN completion_timestamp END) as level_250_time,
    MAX(CASE WHEN completion_number = 500 THEN completion_timestamp END) as level_500_time,
    MAX(CASE WHEN completion_number = 750 THEN completion_timestamp END) as level_750_time,
    MAX(CASE WHEN completion_number = 1000 THEN completion_timestamp END) as level_1000_time
  FROM completions_ranked
  GROUP BY user_pseudo_id
)
SELECT
  user_pseudo_id,
  first_level_time,
  level_1000_time,
  -- Total time to complete 1000 levels
  TIMESTAMP_DIFF(level_1000_time, first_level_time, HOUR) as total_hours,
  TIMESTAMP_DIFF(level_1000_time, first_level_time, DAY) as total_days,
  -- Format as human-readable
  FORMAT(
    '%d days, %d hours, %d minutes',
    DIV(TIMESTAMP_DIFF(level_1000_time, first_level_time, SECOND), 86400),
    MOD(DIV(TIMESTAMP_DIFF(level_1000_time, first_level_time, SECOND), 3600), 24),
    MOD(DIV(TIMESTAMP_DIFF(level_1000_time, first_level_time, SECOND), 60), 60)
  ) as time_to_1000_levels,
  -- Average time per level
  TIMESTAMP_DIFF(level_1000_time, first_level_time, SECOND) / 1000.0 as avg_seconds_per_level,
  -- Milestone times
  TIMESTAMP_DIFF(level_100_time, first_level_time, HOUR) as hours_to_100,
  TIMESTAMP_DIFF(level_250_time, first_level_time, HOUR) as hours_to_250,
  TIMESTAMP_DIFF(level_500_time, first_level_time, HOUR) as hours_to_500,
  TIMESTAMP_DIFF(level_750_time, first_level_time, HOUR) as hours_to_750,
  TIMESTAMP_DIFF(level_1000_time, first_level_time, HOUR) as hours_to_1000
FROM milestones;
