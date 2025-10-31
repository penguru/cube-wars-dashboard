-- Query to analyze how long it took a random user to complete their first 1000 levels
-- Shows progression with timestamps, time deltas, and unit loadouts used

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
),
all_completions AS (
  -- Get all level_complete events for the selected user
  SELECT
    user_pseudo_id,
    TIMESTAMP_MICROS(event_timestamp) as completion_timestamp,
    event_timestamp,
    (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'level') as level,
    (SELECT value.double_value FROM UNNEST(event_params) WHERE key = 'duration_seconds') as duration_seconds,
    ROW_NUMBER() OVER (ORDER BY event_timestamp) as completion_number
  FROM `cube-wars-15b73.analytics_478520406.events_*`
  WHERE event_name = 'level_complete'
    AND user_pseudo_id = (SELECT user_pseudo_id FROM random_user)
),
battle_loadouts AS (
  -- Get battle_start_loadout events for the selected user
  SELECT
    user_pseudo_id,
    TIMESTAMP_MICROS(event_timestamp) as loadout_timestamp,
    event_timestamp as loadout_event_timestamp,
    (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'level') as level,
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'unit_names') as unit_names
  FROM `cube-wars-15b73.analytics_478520406.events_*`
  WHERE event_name = 'battle_start_loadout'
    AND user_pseudo_id = (SELECT user_pseudo_id FROM random_user)
),
completions_with_all_loadouts AS (
  -- Join each completion with all loadouts that happened before it for the same level
  SELECT
    c.user_pseudo_id,
    c.completion_timestamp,
    c.event_timestamp,
    c.level,
    c.duration_seconds,
    c.completion_number,
    bl.unit_names,
    bl.loadout_timestamp,
    bl.loadout_event_timestamp,
    ROW_NUMBER() OVER (
      PARTITION BY c.completion_number
      ORDER BY bl.loadout_event_timestamp DESC
    ) as loadout_recency_rank
  FROM all_completions c
  LEFT JOIN battle_loadouts bl
    ON c.user_pseudo_id = bl.user_pseudo_id
    AND c.level = bl.level
    AND bl.loadout_event_timestamp <= c.event_timestamp
),
completions_with_loadouts AS (
  -- Keep only the most recent loadout for each completion
  SELECT
    user_pseudo_id,
    completion_timestamp,
    event_timestamp,
    level,
    duration_seconds,
    completion_number,
    unit_names,
    loadout_timestamp
  FROM completions_with_all_loadouts
  WHERE loadout_recency_rank = 1 OR loadout_recency_rank IS NULL
)
-- Show first 1000 level completions with detailed timing and unit loadouts
SELECT
  user_pseudo_id,
  completion_number,
  level,
  completion_timestamp,
  FORMAT_TIMESTAMP('%Y-%m-%d %H:%M:%S', completion_timestamp) as formatted_time,
  duration_seconds as level_duration_seconds,
  unit_names as units_used,
  -- Time since first level
  TIMESTAMP_DIFF(
    completion_timestamp,
    FIRST_VALUE(completion_timestamp) OVER (ORDER BY completion_number),
    SECOND
  ) as total_seconds_elapsed,
  -- Format elapsed time as days, hours, minutes
  FORMAT(
    '%d days, %d hours, %d minutes',
    DIV(TIMESTAMP_DIFF(completion_timestamp, FIRST_VALUE(completion_timestamp) OVER (ORDER BY completion_number), SECOND), 86400),
    MOD(DIV(TIMESTAMP_DIFF(completion_timestamp, FIRST_VALUE(completion_timestamp) OVER (ORDER BY completion_number), SECOND), 3600), 24),
    MOD(DIV(TIMESTAMP_DIFF(completion_timestamp, FIRST_VALUE(completion_timestamp) OVER (ORDER BY completion_number), SECOND), 60), 60)
  ) as elapsed_time_formatted,
  -- Time between this level and previous level
  TIMESTAMP_DIFF(
    completion_timestamp,
    LAG(completion_timestamp) OVER (ORDER BY completion_number),
    SECOND
  ) as seconds_since_previous_level,
  -- Time between loadout selection and level completion
  TIMESTAMP_DIFF(completion_timestamp, loadout_timestamp, SECOND) as seconds_between_loadout_and_completion
FROM completions_with_loadouts
WHERE completion_number <= 1000
ORDER BY completion_number ASC;
