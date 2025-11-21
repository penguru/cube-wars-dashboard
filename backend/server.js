const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { BigQuery } = require('@google-cloud/bigquery');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const { authenticateToken } = require('./middleware/auth');

const app = express();
const port = process.env.PORT || 8080;

// Initialize BigQuery
// In Cloud Run, use default credentials (no key file needed)
// In local dev, use key file
const bigqueryConfig = {
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
};

// Only use keyFilename if running locally (file exists)
if (process.env.GOOGLE_CLOUD_KEY_FILE && process.env.NODE_ENV !== 'production') {
  bigqueryConfig.keyFilename = process.env.GOOGLE_CLOUD_KEY_FILE;
}

const bigquery = new BigQuery(bigqueryConfig);

app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://cube-wars-15b73.web.app',
    'https://cube-wars-15b73.firebaseapp.com',
    process.env.FRONTEND_URL
  ].filter(Boolean),
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Auth routes (public)
app.use('/api/auth', authRoutes);

// Helper function to build date filter
const buildDateFilter = (startDate, endDate) => {
  if (startDate && endDate) {
    return `AND DATE(TIMESTAMP_MICROS(event_timestamp)) BETWEEN '${startDate}' AND '${endDate}'`;
  }
  return '';
};

// Helper function to build platform filter
const buildPlatformFilter = (platform) => {
  if (platform && platform !== 'all') {
    return `AND platform = '${platform.toUpperCase()}'`;
  }
  return '';
};

// Helper function to build country filter
const buildCountryFilter = (country) => {
  if (country && country !== 'all' && country.trim() !== '') {
    return `AND geo.country = '${country}'`;
  }
  return '';
};

// Helper function to build version filter
const buildVersionFilter = (version) => {
  if (version && version !== 'all' && version.trim() !== '') {
    return `AND app_info.version = '${version}'`;
  }
  return '';
};

// Helper function to build cohort CTE - identifies users by their first appearance in data
// Following Last Wave's approach: apply filters to find first appearance, not just first_open
const buildCohortCTE = (startDate, endDate, platform, country, version) => {
  if (startDate && endDate) {
    return `
      user_cohorts AS (
        SELECT
          user_pseudo_id,
          MIN(DATE(TIMESTAMP_MICROS(event_timestamp))) as cohort_date
        FROM \`${process.env.BIGQUERY_DATASET}.events_*\`
        WHERE event_name = 'first_open'
        ${buildPlatformFilter(platform)}
        ${buildCountryFilter(country)}
        ${buildVersionFilter(version)}
        GROUP BY user_pseudo_id
        HAVING cohort_date BETWEEN '${startDate}' AND '${endDate}'
      ),
    `;
  }
  return '';
};

// Helper function to join with cohort filter
const buildCohortJoin = (startDate, endDate, tableAlias = 'main') => {
  if (startDate && endDate) {
    return `INNER JOIN user_cohorts uc ON ${tableAlias}.user_pseudo_id = uc.user_pseudo_id`;
  }
  return '';
};

// Helper function to extract parameter from Firebase event_params array
const getParamValue = (paramName) => {
  return `(SELECT value.int_value FROM UNNEST(event_params) WHERE key = '${paramName}')`;
};

const getParamValueFloat = (paramName) => {
  return `SAFE_CAST(
      COALESCE(
        (SELECT value.double_value FROM UNNEST(event_params) WHERE key = '${paramName}'),
        CAST((SELECT value.int_value FROM UNNEST(event_params) WHERE key = '${paramName}') AS FLOAT64)
      )
      AS FLOAT64
    )`;
};

const getParamValueString = (paramName) => {
  return `(SELECT value.string_value FROM UNNEST(event_params) WHERE key = '${paramName}')`;
};

// Protect all /api/* routes except /api/auth/* and /api/health with authentication
app.use('/api/*', (req, res, next) => {
  if (req.originalUrl.startsWith('/api/auth/') || req.originalUrl === '/api/health') {
    return next();
  }
  authenticateToken(req, res, next);
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// 1. Rewarded Ads Analytics
app.get('/api/rewarded-ads', async (req, res) => {
  try {
    const { startDate, endDate, platform, country, version } = req.query;

    const query = `
      WITH
      ${buildCohortCTE(startDate, endDate, platform, country, version)}
      all_events AS (
        SELECT user_pseudo_id
        FROM \`${process.env.BIGQUERY_DATASET}.events_*\`
        WHERE 1=1
        ${buildPlatformFilter(platform)}
        ${buildCountryFilter(country)}
        ${buildVersionFilter(version)}
      ),
      total_user_count AS (
        SELECT COUNT(DISTINCT ae.user_pseudo_id) as total_users
        FROM all_events ae
        ${buildCohortJoin(startDate, endDate, 'ae')}
      ),
      main AS (
        SELECT
          event_name,
          user_pseudo_id
        FROM \`${process.env.BIGQUERY_DATASET}.events_*\`
        WHERE event_name LIKE 'RV_Watched_%'
        ${buildDateFilter(startDate, endDate)}
        ${buildPlatformFilter(platform)}
        ${buildCountryFilter(country)}
        ${buildVersionFilter(version)}
      )
      SELECT
        main.event_name,
        COUNT(*) as total_count,
        COUNT(DISTINCT main.user_pseudo_id) as unique_users,
        ROUND(COUNT(*) * 1.0 / COUNT(DISTINCT main.user_pseudo_id), 2) as avg_per_user,
        tuc.total_users,
        ROUND(COUNT(*) * 1.0 / tuc.total_users, 2) as avg_per_all_users
      FROM main
      ${buildCohortJoin(startDate, endDate)}
      CROSS JOIN total_user_count tuc
      GROUP BY main.event_name, tuc.total_users
      ORDER BY total_count DESC
    `;

    const [rows] = await bigquery.query(query);
    console.log('Rewarded Ads Query Result Sample:', JSON.stringify(rows[0], null, 2));

    // Calculate totals
    if (rows.length > 0) {
      const totalCount = rows.reduce((sum, row) => sum + row.total_count, 0);
      const allUniqueUsers = new Set();
      rows.forEach(row => {
        // Count unique users across all event types
        if (row.unique_users) allUniqueUsers.add(row.unique_users);
      });
      const totalUsers = rows[0].total_users || 0;

      const totals = {
        event_name: 'TOTAL',
        total_count: totalCount,
        unique_users: rows.reduce((sum, row) => sum + row.unique_users, 0),
        avg_per_user: totalCount > 0 ? parseFloat((totalCount / rows.reduce((sum, row) => sum + row.unique_users, 0)).toFixed(2)) : 0,
        total_users: totalUsers,
        avg_per_all_users: totalUsers > 0 ? parseFloat((totalCount / totalUsers).toFixed(2)) : 0
      };

      res.json({ rows, totals });
    } else {
      res.json({ rows, totals: null });
    }
  } catch (error) {
    console.error('Error fetching rewarded ads:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 2. Level Analysis - Completion Rate
app.get('/api/level-analysis', async (req, res) => {
  try {
    const { startDate, endDate, platform, levelCount, country, version } = req.query;
    const limit = levelCount ? parseInt(levelCount) : 50;

    const query = `
      WITH
      ${buildCohortCTE(startDate, endDate, platform, country, version)}
      level_events AS (
        SELECT
          user_pseudo_id,
          event_name,
          ${getParamValue('level')} as level,
          ${getParamValueFloat('duration_seconds')} as duration_seconds
        FROM \`${process.env.BIGQUERY_DATASET}.events_*\`
        WHERE event_name IN ('level_complete', 'level_fail')
        ${buildPlatformFilter(platform)}
        ${buildCountryFilter(country)}
        ${buildVersionFilter(version)}
        AND ${getParamValue('level')} IS NOT NULL
      ),
      level_events_cohorted AS (
        SELECT le.*
        FROM level_events le
        ${buildCohortJoin(startDate, endDate, 'le')}
      ),
      level_stats AS (
        SELECT
          level,
          COUNT(CASE WHEN event_name = 'level_complete' THEN 1 END) as completions,
          COUNT(CASE WHEN event_name = 'level_fail' THEN 1 END) as failures,
          COUNT(*) as total_attempts,
          COUNT(DISTINCT user_pseudo_id) as unique_users,
          AVG(CASE WHEN event_name = 'level_complete' THEN duration_seconds END) as avg_duration_complete,
          AVG(CASE WHEN event_name = 'level_fail' THEN duration_seconds END) as avg_duration_fail
        FROM level_events_cohorted
        GROUP BY level
      ),
      user_attempts AS (
        SELECT
          level,
          user_pseudo_id,
          COUNT(*) as attempts,
          MAX(CASE WHEN event_name = 'level_complete' THEN 1 ELSE 0 END) as completed
        FROM level_events_cohorted
        GROUP BY level, user_pseudo_id
      ),
      avg_attempts AS (
        SELECT
          level,
          ROUND(AVG(CASE WHEN completed = 1 THEN attempts END), 2) as avg_attempts_to_complete
        FROM user_attempts
        GROUP BY level
      )
      SELECT
        ls.level,
        ls.completions,
        ls.failures,
        ls.total_attempts,
        ls.unique_users,
        ROUND(ls.completions * 100.0 / NULLIF(ls.total_attempts, 0), 2) as completion_rate,
        ROUND(ls.avg_duration_complete, 2) as avg_duration_complete,
        ROUND(ls.avg_duration_fail, 2) as avg_duration_fail,
        aa.avg_attempts_to_complete
      FROM level_stats ls
      LEFT JOIN avg_attempts aa ON ls.level = aa.level
      ORDER BY ls.level
      LIMIT ${limit}
    `;

    const [rows] = await bigquery.query(query);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching level analysis:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 3. Level Silver Coin Boost Analysis
app.get('/api/level-silver-coin-boost', async (req, res) => {
  try {
    const { startDate, endDate, platform, levelCount, country, version } = req.query;
    const limit = levelCount ? parseInt(levelCount) : 50;

    const query = `
      WITH
      ${buildCohortCTE(startDate, endDate, platform, country, version)}
      level_outcomes AS (
        SELECT
          user_pseudo_id,
          ${getParamValue('level')} as level,
          event_name,
          event_timestamp
        FROM \`${process.env.BIGQUERY_DATASET}.events_*\`
        WHERE event_name IN ('level_complete', 'level_fail')
        ${buildPlatformFilter(platform)}
        ${buildCountryFilter(country)}
        ${buildVersionFilter(version)}
        AND ${getParamValue('level')} IS NOT NULL
      ),
      level_outcomes_cohorted AS (
        SELECT lo.*
        FROM level_outcomes lo
        ${buildCohortJoin(startDate, endDate, 'lo')}
      ),
      silver_coin_events AS (
        SELECT
          user_pseudo_id,
          ${getParamValue('level')} as level,
          event_name,
          event_timestamp
        FROM \`${process.env.BIGQUERY_DATASET}.events_*\`
        WHERE event_name IN ('RV_Watched_Silver_Coin_Before_Game', 'RV_Watched_Silver_Coin_In_Game')
        ${buildPlatformFilter(platform)}
        ${buildCountryFilter(country)}
        ${buildVersionFilter(version)}
        AND ${getParamValue('level')} IS NOT NULL
      ),
      silver_coin_events_cohorted AS (
        SELECT sc.*
        FROM silver_coin_events sc
        ${buildCohortJoin(startDate, endDate, 'sc')}
      ),
      level_with_boost AS (
        SELECT DISTINCT
          lo.user_pseudo_id,
          lo.level,
          lo.event_name,
          CASE
            WHEN sc.event_name IS NOT NULL THEN 1
            ELSE 0
          END as had_silver_boost
        FROM level_outcomes_cohorted lo
        LEFT JOIN silver_coin_events_cohorted sc
          ON lo.user_pseudo_id = sc.user_pseudo_id
          AND lo.level = sc.level
          AND sc.event_timestamp <= lo.event_timestamp
      )
      SELECT
        level,
        COUNT(*) as total_attempts,
        SUM(had_silver_boost) as attempts_with_boost,
        SUM(CASE WHEN event_name = 'level_complete' AND had_silver_boost = 1 THEN 1 ELSE 0 END) as completions_with_boost,
        SUM(CASE WHEN event_name = 'level_complete' AND had_silver_boost = 0 THEN 1 ELSE 0 END) as completions_without_boost,
        ROUND(SUM(had_silver_boost) * 100.0 / NULLIF(COUNT(*), 0), 2) as boost_usage_rate,
        ROUND(SUM(CASE WHEN event_name = 'level_complete' AND had_silver_boost = 1 THEN 1 ELSE 0 END) * 100.0 /
          NULLIF(SUM(had_silver_boost), 0), 2) as completion_rate_with_boost,
        ROUND(SUM(CASE WHEN event_name = 'level_complete' AND had_silver_boost = 0 THEN 1 ELSE 0 END) * 100.0 /
          NULLIF(COUNT(*) - SUM(had_silver_boost), 0), 2) as completion_rate_without_boost
      FROM level_with_boost
      GROUP BY level
      ORDER BY level
      LIMIT ${limit}
    `;

    const [rows] = await bigquery.query(query);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching silver coin boost analysis:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 4. Unit Analysis - Battle Start Loadout
app.get('/api/unit-loadout-analysis', async (req, res) => {
  try {
    const { startDate, endDate, platform, country, version, level } = req.query;

    // Helper function to build level filter
    const buildLevelFilter = (level) => {
      if (level && level !== 'all' && level.trim() !== '') {
        return `AND ${getParamValue('level')} = ${parseInt(level)}`;
      }
      return '';
    };

    const query = `
      WITH
      ${buildCohortCTE(startDate, endDate, platform, country, version)}
      main AS (
        SELECT
          user_pseudo_id,
          ${getParamValueString('unit_names')} as unit_names
        FROM \`${process.env.BIGQUERY_DATASET}.events_*\`
        WHERE event_name = 'battle_start_loadout'
        ${buildPlatformFilter(platform)}
        ${buildCountryFilter(country)}
        ${buildVersionFilter(version)}
        ${buildLevelFilter(level)}
        AND ${getParamValueString('unit_names')} IS NOT NULL
      ),
      loadout_events AS (
        SELECT main.unit_names
        FROM main
        ${buildCohortJoin(startDate, endDate)}
      ),
      individual_units AS (
        SELECT
          TRIM(unit) as unit_name,
          unit_names as full_loadout
        FROM loadout_events,
        UNNEST(SPLIT(unit_names, ',')) as unit
      ),
      unit_frequency AS (
        SELECT
          unit_name,
          COUNT(*) as usage_count,
          COUNT(DISTINCT full_loadout) as unique_loadouts
        FROM individual_units
        GROUP BY unit_name
      ),
      loadout_combinations AS (
        SELECT
          unit_names as loadout,
          COUNT(*) as usage_count
        FROM loadout_events
        GROUP BY unit_names
        ORDER BY usage_count DESC
        LIMIT 20
      )
      SELECT
        'unit_frequency' as result_type,
        unit_name as name,
        usage_count,
        unique_loadouts as additional_info
      FROM unit_frequency
      WHERE unit_name IS NOT NULL AND unit_name != ''

      UNION ALL

      SELECT
        'top_loadouts' as result_type,
        loadout as name,
        usage_count,
        NULL as additional_info
      FROM loadout_combinations

      ORDER BY result_type, usage_count DESC
    `;

    const [rows] = await bigquery.query(query);

    // Separate the results into two arrays
    const unitFrequency = rows.filter(r => r.result_type === 'unit_frequency');
    const topLoadouts = rows.filter(r => r.result_type === 'top_loadouts');

    res.json({ unitFrequency, topLoadouts });
  } catch (error) {
    console.error('Error fetching unit loadout analysis:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 5. Unit Upgrade Analysis
app.get('/api/unit-upgrade-analysis', async (req, res) => {
  try {
    const { startDate, endDate, platform, country, version } = req.query;

    const query = `
      WITH
      ${buildCohortCTE(startDate, endDate, platform, country, version)}
      main AS (
        SELECT
          user_pseudo_id,
          ${getParamValueString('unit_name')} as unit_name,
          ${getParamValue('level')} as upgrade_level
        FROM \`${process.env.BIGQUERY_DATASET}.events_*\`
        WHERE event_name = 'unit_upgrade'
        ${buildPlatformFilter(platform)}
        ${buildCountryFilter(country)}
        ${buildVersionFilter(version)}
        AND ${getParamValueString('unit_name')} IS NOT NULL
        AND ${getParamValue('level')} IS NOT NULL
      ),
      unit_upgrades AS (
        SELECT
          main.unit_name,
          main.upgrade_level
        FROM main
        ${buildCohortJoin(startDate, endDate)}
      )
      SELECT
        unit_name,
        COUNT(*) as total_upgrades,
        ROUND(AVG(upgrade_level), 2) as avg_upgrade_level,
        MIN(upgrade_level) as min_level,
        MAX(upgrade_level) as max_level
      FROM unit_upgrades
      WHERE unit_name IS NOT NULL AND unit_name != ''
      GROUP BY unit_name
      ORDER BY total_upgrades DESC
    `;

    const [rows] = await bigquery.query(query);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching unit upgrade analysis:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 6. Churn Analysis
app.get('/api/churn-analysis', async (req, res) => {
  try {
    const { startDate, endDate, platform, levelCount, country, version } = req.query;
    const limit = levelCount ? parseInt(levelCount) : 50;

    const query = `
      WITH
      ${buildCohortCTE(startDate, endDate, platform, country, version)}
      level_events AS (
        SELECT
          user_pseudo_id,
          event_name,
          ${getParamValue('level')} as level
        FROM \`${process.env.BIGQUERY_DATASET}.events_*\`
        WHERE event_name IN ('level_complete', 'level_fail')
        ${buildPlatformFilter(platform)}
        ${buildCountryFilter(country)}
        ${buildVersionFilter(version)}
        AND ${getParamValue('level')} IS NOT NULL
      ),
      level_events_cohorted AS (
        SELECT le.*
        FROM level_events le
        ${buildCohortJoin(startDate, endDate, 'le')}
      ),
      user_max_level AS (
        SELECT
          user_pseudo_id,
          MAX(level) as max_level_reached
        FROM level_events_cohorted
        GROUP BY user_pseudo_id
      ),
      all_levels AS (
        SELECT DISTINCT level
        FROM level_events_cohorted
      ),
      level_reach_counts AS (
        SELECT
          l.level,
          COUNT(DISTINCT u.user_pseudo_id) as users_reached_level
        FROM all_levels l
        LEFT JOIN user_max_level u ON u.max_level_reached >= l.level
        GROUP BY l.level
      ),
      level_difficulty AS (
        SELECT
          level,
          COUNT(CASE WHEN event_name = 'level_fail' THEN 1 END) as failures,
          COUNT(CASE WHEN event_name = 'level_complete' THEN 1 END) as completions,
          COUNT(*) as total_attempts
        FROM level_events_cohorted
        GROUP BY level
      ),
      level_retention AS (
        SELECT
          lrc.level,
          lrc.users_reached_level,
          LEAD(lrc.users_reached_level) OVER (ORDER BY lrc.level) as users_reached_next_level,
          ld.failures,
          ld.completions,
          ld.total_attempts
        FROM level_reach_counts lrc
        LEFT JOIN level_difficulty ld ON lrc.level = ld.level
      )
      SELECT
        level,
        users_reached_level,
        COALESCE(users_reached_level - users_reached_next_level, 0) as users_churned_at_level,
        ROUND(COALESCE((users_reached_level - users_reached_next_level) * 100.0 / NULLIF(users_reached_level, 0), 0), 2) as churn_rate,
        ROUND(failures * 100.0 / NULLIF(total_attempts, 0), 2) as failure_rate,
        ROUND(total_attempts * 1.0 / NULLIF(completions, 0), 2) as difficulty_score
      FROM level_retention
      WHERE level IS NOT NULL
      ORDER BY level
      LIMIT ${limit}
    `;

    const [rows] = await bigquery.query(query);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching churn analysis:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 7. Booster Box Analysis
app.get('/api/booster-box-analysis', async (req, res) => {
  try {
    const { startDate, endDate, platform, country, version } = req.query;

    const query = `
      WITH
      ${buildCohortCTE(startDate, endDate, platform, country, version)}
      main AS (
        SELECT
          user_pseudo_id,
          ${getParamValueString('booster_box_ID')} as box_id
        FROM \`${process.env.BIGQUERY_DATASET}.events_*\`
        WHERE event_name = 'booster_box_opened'
        ${buildPlatformFilter(platform)}
        ${buildCountryFilter(country)}
        ${buildVersionFilter(version)}
        AND ${getParamValueString('booster_box_ID')} IS NOT NULL
      )
      SELECT
        main.box_id,
        COUNT(*) as times_opened,
        COUNT(DISTINCT main.user_pseudo_id) as unique_users,
        ROUND(COUNT(*) * 1.0 / COUNT(DISTINCT main.user_pseudo_id), 2) as avg_per_user
      FROM main
      ${buildCohortJoin(startDate, endDate)}
      GROUP BY main.box_id
      ORDER BY times_opened DESC
    `;

    const [rows] = await bigquery.query(query);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching booster box analysis:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 8. Base Station Upgrades Analysis
app.get('/api/base-station-analysis', async (req, res) => {
  try {
    const { startDate, endDate, platform, country, version } = req.query;

    const query = `
      WITH
      ${buildCohortCTE(startDate, endDate, platform, country, version)}
      main AS (
        SELECT
          user_pseudo_id,
          ${getParamValueString('Skill')} as skill,
          ${getParamValue('level')} as upgrade_level
        FROM \`${process.env.BIGQUERY_DATASET}.events_*\`
        WHERE event_name = 'base_station_upgrade'
        ${buildPlatformFilter(platform)}
        ${buildCountryFilter(country)}
        ${buildVersionFilter(version)}
        AND ${getParamValueString('Skill')} IS NOT NULL
      )
      SELECT
        main.skill,
        main.upgrade_level,
        COUNT(*) as upgrade_count,
        COUNT(DISTINCT main.user_pseudo_id) as unique_users
      FROM main
      ${buildCohortJoin(startDate, endDate)}
      GROUP BY main.skill, main.upgrade_level
      ORDER BY main.skill, main.upgrade_level
    `;

    const [rows] = await bigquery.query(query);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching base station analysis:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 9. Overall Stats
app.get('/api/overall-stats', async (req, res) => {
  try {
    const { startDate, endDate, platform, country, version } = req.query;

    const query = `
      WITH
      ${buildCohortCTE(startDate, endDate, platform, country, version)}
      main AS (
        SELECT
          user_pseudo_id,
          event_name
        FROM \`${process.env.BIGQUERY_DATASET}.events_*\`
        WHERE 1=1
        ${buildPlatformFilter(platform)}
        ${buildCountryFilter(country)}
        ${buildVersionFilter(version)}
      )
      SELECT
        COUNT(DISTINCT main.user_pseudo_id) as total_users,
        COUNT(DISTINCT CASE WHEN main.event_name = 'level_start' THEN main.user_pseudo_id END) as users_who_played,
        COUNT(CASE WHEN main.event_name LIKE 'RV_Watched_%' THEN 1 END) as total_rewarded_ads,
        COUNT(CASE WHEN main.event_name = 'level_complete' THEN 1 END) as total_level_completions,
        COUNT(CASE WHEN main.event_name = 'level_fail' THEN 1 END) as total_level_failures,
        COUNT(CASE WHEN main.event_name = 'unit_upgrade' THEN 1 END) as total_unit_upgrades,
        COUNT(CASE WHEN main.event_name = 'booster_box_opened' THEN 1 END) as total_booster_boxes_opened
      FROM main
      ${buildCohortJoin(startDate, endDate)}
    `;

    const [rows] = await bigquery.query(query);
    res.json(rows[0] || {});
  } catch (error) {
    console.error('Error fetching overall stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 10. Get Available Countries
app.get('/api/available-countries', async (req, res) => {
  try {
    const { startDate, endDate, platform, version } = req.query;

    const query = `
      WITH
      ${buildCohortCTE(startDate, endDate, platform, null, version)}
      main AS (
        SELECT DISTINCT
          user_pseudo_id,
          geo.country as country
        FROM \`${process.env.BIGQUERY_DATASET}.events_*\`
        WHERE geo.country IS NOT NULL
        ${buildPlatformFilter(platform)}
        ${buildVersionFilter(version)}
      )
      SELECT
        main.country,
        COUNT(DISTINCT main.user_pseudo_id) as user_count
      FROM main
      ${buildCohortJoin(startDate, endDate)}
      GROUP BY main.country
      ORDER BY user_count DESC
      LIMIT 100
    `;

    const [rows] = await bigquery.query(query);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching available countries:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 11. Get Available Versions
app.get('/api/available-versions', async (req, res) => {
  try {
    const { startDate, endDate, platform, country } = req.query;

    const query = `
      WITH
      ${buildCohortCTE(startDate, endDate, platform, country, null)}
      main AS (
        SELECT DISTINCT
          user_pseudo_id,
          app_info.version as version
        FROM \`${process.env.BIGQUERY_DATASET}.events_*\`
        WHERE app_info.version IS NOT NULL
        ${buildPlatformFilter(platform)}
        ${buildCountryFilter(country)}
      )
      SELECT
        main.version,
        COUNT(DISTINCT main.user_pseudo_id) as user_count
      FROM main
      ${buildCohortJoin(startDate, endDate)}
      GROUP BY main.version
      ORDER BY version DESC
      LIMIT 50
    `;

    const [rows] = await bigquery.query(query);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching available versions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 12. Cohorted Rewarded Ad Analysis
app.get('/api/rewarded-ads-cohort', async (req, res) => {
  try {
    const { startDate, endDate, platform, country, version, eventName } = req.query;

    console.log('Cohort Analysis Request:', { startDate, endDate, platform, country, version, eventName });

    if (!eventName) {
      return res.status(400).json({ error: 'eventName parameter is required' });
    }

    // Specific days to analyze
    const days = [0, 1, 2, 3, 4, 5, 6, 7, 14, 30, 45, 60, 75, 90];

    const query = `
      WITH
      ${buildCohortCTE(startDate, endDate, platform, country, version)}
      user_first_open AS (
        SELECT
          user_pseudo_id,
          MIN(DATE(TIMESTAMP_MICROS(event_timestamp))) as install_date
        FROM \`${process.env.BIGQUERY_DATASET}.events_*\`
        WHERE event_name = 'first_open'
        ${buildPlatformFilter(platform)}
        ${buildCountryFilter(country)}
        ${buildVersionFilter(version)}
        GROUP BY user_pseudo_id
      ),
      cohorted_users AS (
        SELECT ufo.*
        FROM user_first_open ufo
        ${buildCohortJoin(startDate, endDate, 'ufo')}
      ),
      all_events AS (
        SELECT
          cu.install_date,
          cu.user_pseudo_id,
          DATE(TIMESTAMP_MICROS(e.event_timestamp)) as event_date,
          e.event_name,
          DATE_DIFF(DATE(TIMESTAMP_MICROS(e.event_timestamp)), cu.install_date, DAY) as days_since_install
        FROM cohorted_users cu
        LEFT JOIN \`${process.env.BIGQUERY_DATASET}.events_*\` e
          ON cu.user_pseudo_id = e.user_pseudo_id
      ),
      rewarded_event_counts AS (
        SELECT
          install_date,
          COUNTIF(event_name ${eventName.includes('%') ? 'LIKE' : '='} '${eventName}' AND days_since_install = 0) as day_0_events,
          COUNTIF(event_name ${eventName.includes('%') ? 'LIKE' : '='} '${eventName}' AND days_since_install = 1) as day_1_events,
          COUNTIF(event_name ${eventName.includes('%') ? 'LIKE' : '='} '${eventName}' AND days_since_install = 2) as day_2_events,
          COUNTIF(event_name ${eventName.includes('%') ? 'LIKE' : '='} '${eventName}' AND days_since_install = 3) as day_3_events,
          COUNTIF(event_name ${eventName.includes('%') ? 'LIKE' : '='} '${eventName}' AND days_since_install = 4) as day_4_events,
          COUNTIF(event_name ${eventName.includes('%') ? 'LIKE' : '='} '${eventName}' AND days_since_install = 5) as day_5_events,
          COUNTIF(event_name ${eventName.includes('%') ? 'LIKE' : '='} '${eventName}' AND days_since_install = 6) as day_6_events,
          COUNTIF(event_name ${eventName.includes('%') ? 'LIKE' : '='} '${eventName}' AND days_since_install = 7) as day_7_events,
          COUNTIF(event_name ${eventName.includes('%') ? 'LIKE' : '='} '${eventName}' AND days_since_install = 14) as day_14_events,
          COUNTIF(event_name ${eventName.includes('%') ? 'LIKE' : '='} '${eventName}' AND days_since_install = 30) as day_30_events,
          COUNTIF(event_name ${eventName.includes('%') ? 'LIKE' : '='} '${eventName}' AND days_since_install = 45) as day_45_events,
          COUNTIF(event_name ${eventName.includes('%') ? 'LIKE' : '='} '${eventName}' AND days_since_install = 60) as day_60_events,
          COUNTIF(event_name ${eventName.includes('%') ? 'LIKE' : '='} '${eventName}' AND days_since_install = 75) as day_75_events,
          COUNTIF(event_name ${eventName.includes('%') ? 'LIKE' : '='} '${eventName}' AND days_since_install = 90) as day_90_events
        FROM all_events
        GROUP BY install_date
      ),
      active_user_counts AS (
        SELECT
          install_date,
          COUNT(DISTINCT user_pseudo_id) as cohort_size,
          COUNT(DISTINCT CASE WHEN days_since_install = 0 AND event_name IS NOT NULL THEN user_pseudo_id END) as day_0_users,
          COUNT(DISTINCT CASE WHEN days_since_install = 1 AND event_name IS NOT NULL THEN user_pseudo_id END) as day_1_users,
          COUNT(DISTINCT CASE WHEN days_since_install = 2 AND event_name IS NOT NULL THEN user_pseudo_id END) as day_2_users,
          COUNT(DISTINCT CASE WHEN days_since_install = 3 AND event_name IS NOT NULL THEN user_pseudo_id END) as day_3_users,
          COUNT(DISTINCT CASE WHEN days_since_install = 4 AND event_name IS NOT NULL THEN user_pseudo_id END) as day_4_users,
          COUNT(DISTINCT CASE WHEN days_since_install = 5 AND event_name IS NOT NULL THEN user_pseudo_id END) as day_5_users,
          COUNT(DISTINCT CASE WHEN days_since_install = 6 AND event_name IS NOT NULL THEN user_pseudo_id END) as day_6_users,
          COUNT(DISTINCT CASE WHEN days_since_install = 7 AND event_name IS NOT NULL THEN user_pseudo_id END) as day_7_users,
          COUNT(DISTINCT CASE WHEN days_since_install = 14 AND event_name IS NOT NULL THEN user_pseudo_id END) as day_14_users,
          COUNT(DISTINCT CASE WHEN days_since_install = 30 AND event_name IS NOT NULL THEN user_pseudo_id END) as day_30_users,
          COUNT(DISTINCT CASE WHEN days_since_install = 45 AND event_name IS NOT NULL THEN user_pseudo_id END) as day_45_users,
          COUNT(DISTINCT CASE WHEN days_since_install = 60 AND event_name IS NOT NULL THEN user_pseudo_id END) as day_60_users,
          COUNT(DISTINCT CASE WHEN days_since_install = 75 AND event_name IS NOT NULL THEN user_pseudo_id END) as day_75_users,
          COUNT(DISTINCT CASE WHEN days_since_install = 90 AND event_name IS NOT NULL THEN user_pseudo_id END) as day_90_users
        FROM all_events
        GROUP BY install_date
      )
      SELECT
        auc.install_date,
        auc.cohort_size,
        rec.day_0_events,
        auc.day_0_users,
        rec.day_1_events,
        auc.day_1_users,
        rec.day_2_events,
        auc.day_2_users,
        rec.day_3_events,
        auc.day_3_users,
        rec.day_4_events,
        auc.day_4_users,
        rec.day_5_events,
        auc.day_5_users,
        rec.day_6_events,
        auc.day_6_users,
        rec.day_7_events,
        auc.day_7_users,
        rec.day_14_events,
        auc.day_14_users,
        rec.day_30_events,
        auc.day_30_users,
        rec.day_45_events,
        auc.day_45_users,
        rec.day_60_events,
        auc.day_60_users,
        rec.day_75_events,
        auc.day_75_users,
        rec.day_90_events,
        auc.day_90_users
      FROM active_user_counts auc
      LEFT JOIN rewarded_event_counts rec ON auc.install_date = rec.install_date
      ORDER BY auc.install_date ASC
      LIMIT 100
    `;

    console.log('Generated Query:', query);
    const [rows] = await bigquery.query(query);
    console.log('Query Results Row Count:', rows.length);
    if (rows.length > 0) {
      console.log('First Row:', JSON.stringify(rows[0], null, 2));
    }
    res.json(rows);
  } catch (error) {
    console.error('Error fetching cohorted rewarded ads:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 13. Ad Impressions Cohort Analysis
app.get('/api/ad-impressions-cohort', async (req, res) => {
  try {
    const { startDate, endDate, platform, country, version, adFormat } = req.query;

    console.log('Ad Impressions Cohort Request:', { startDate, endDate, platform, country, version, adFormat });

    if (!adFormat) {
      return res.status(400).json({ error: 'adFormat parameter is required' });
    }

    const query = `
      WITH
      ${buildCohortCTE(startDate, endDate, platform, country, version)}
      user_first_open AS (
        SELECT
          user_pseudo_id,
          MIN(DATE(TIMESTAMP_MICROS(event_timestamp))) as install_date
        FROM \`${process.env.BIGQUERY_DATASET}.events_*\`
        WHERE event_name = 'first_open'
        ${buildPlatformFilter(platform)}
        ${buildCountryFilter(country)}
        ${buildVersionFilter(version)}
        GROUP BY user_pseudo_id
      ),
      cohorted_users AS (
        SELECT ufo.*
        FROM user_first_open ufo
        ${buildCohortJoin(startDate, endDate, 'ufo')}
      ),
      all_events AS (
        SELECT
          cu.install_date,
          cu.user_pseudo_id,
          DATE(TIMESTAMP_MICROS(e.event_timestamp)) as event_date,
          e.event_name,
          (SELECT value.string_value FROM UNNEST(e.event_params) WHERE key = 'ad_format') as ad_format,
          DATE_DIFF(DATE(TIMESTAMP_MICROS(e.event_timestamp)), cu.install_date, DAY) as days_since_install
        FROM cohorted_users cu
        LEFT JOIN \`${process.env.BIGQUERY_DATASET}.events_*\` e
          ON cu.user_pseudo_id = e.user_pseudo_id
      ),
      impression_counts AS (
        SELECT
          install_date,
          COUNTIF(event_name = 'ad_impression' AND ad_format = '${adFormat}' AND days_since_install = 0) as day_0_events,
          COUNTIF(event_name = 'ad_impression' AND ad_format = '${adFormat}' AND days_since_install = 1) as day_1_events,
          COUNTIF(event_name = 'ad_impression' AND ad_format = '${adFormat}' AND days_since_install = 2) as day_2_events,
          COUNTIF(event_name = 'ad_impression' AND ad_format = '${adFormat}' AND days_since_install = 3) as day_3_events,
          COUNTIF(event_name = 'ad_impression' AND ad_format = '${adFormat}' AND days_since_install = 4) as day_4_events,
          COUNTIF(event_name = 'ad_impression' AND ad_format = '${adFormat}' AND days_since_install = 5) as day_5_events,
          COUNTIF(event_name = 'ad_impression' AND ad_format = '${adFormat}' AND days_since_install = 6) as day_6_events,
          COUNTIF(event_name = 'ad_impression' AND ad_format = '${adFormat}' AND days_since_install = 7) as day_7_events,
          COUNTIF(event_name = 'ad_impression' AND ad_format = '${adFormat}' AND days_since_install = 14) as day_14_events,
          COUNTIF(event_name = 'ad_impression' AND ad_format = '${adFormat}' AND days_since_install = 30) as day_30_events,
          COUNTIF(event_name = 'ad_impression' AND ad_format = '${adFormat}' AND days_since_install = 45) as day_45_events,
          COUNTIF(event_name = 'ad_impression' AND ad_format = '${adFormat}' AND days_since_install = 60) as day_60_events,
          COUNTIF(event_name = 'ad_impression' AND ad_format = '${adFormat}' AND days_since_install = 75) as day_75_events,
          COUNTIF(event_name = 'ad_impression' AND ad_format = '${adFormat}' AND days_since_install = 90) as day_90_events
        FROM all_events
        GROUP BY install_date
      ),
      active_user_counts AS (
        SELECT
          install_date,
          COUNT(DISTINCT user_pseudo_id) as cohort_size,
          COUNT(DISTINCT CASE WHEN days_since_install = 0 AND event_name IS NOT NULL THEN user_pseudo_id END) as day_0_users,
          COUNT(DISTINCT CASE WHEN days_since_install = 1 AND event_name IS NOT NULL THEN user_pseudo_id END) as day_1_users,
          COUNT(DISTINCT CASE WHEN days_since_install = 2 AND event_name IS NOT NULL THEN user_pseudo_id END) as day_2_users,
          COUNT(DISTINCT CASE WHEN days_since_install = 3 AND event_name IS NOT NULL THEN user_pseudo_id END) as day_3_users,
          COUNT(DISTINCT CASE WHEN days_since_install = 4 AND event_name IS NOT NULL THEN user_pseudo_id END) as day_4_users,
          COUNT(DISTINCT CASE WHEN days_since_install = 5 AND event_name IS NOT NULL THEN user_pseudo_id END) as day_5_users,
          COUNT(DISTINCT CASE WHEN days_since_install = 6 AND event_name IS NOT NULL THEN user_pseudo_id END) as day_6_users,
          COUNT(DISTINCT CASE WHEN days_since_install = 7 AND event_name IS NOT NULL THEN user_pseudo_id END) as day_7_users,
          COUNT(DISTINCT CASE WHEN days_since_install = 14 AND event_name IS NOT NULL THEN user_pseudo_id END) as day_14_users,
          COUNT(DISTINCT CASE WHEN days_since_install = 30 AND event_name IS NOT NULL THEN user_pseudo_id END) as day_30_users,
          COUNT(DISTINCT CASE WHEN days_since_install = 45 AND event_name IS NOT NULL THEN user_pseudo_id END) as day_45_users,
          COUNT(DISTINCT CASE WHEN days_since_install = 60 AND event_name IS NOT NULL THEN user_pseudo_id END) as day_60_users,
          COUNT(DISTINCT CASE WHEN days_since_install = 75 AND event_name IS NOT NULL THEN user_pseudo_id END) as day_75_users,
          COUNT(DISTINCT CASE WHEN days_since_install = 90 AND event_name IS NOT NULL THEN user_pseudo_id END) as day_90_users
        FROM all_events
        GROUP BY install_date
      )
      SELECT
        auc.install_date,
        auc.cohort_size,
        ic.day_0_events,
        auc.day_0_users,
        ic.day_1_events,
        auc.day_1_users,
        ic.day_2_events,
        auc.day_2_users,
        ic.day_3_events,
        auc.day_3_users,
        ic.day_4_events,
        auc.day_4_users,
        ic.day_5_events,
        auc.day_5_users,
        ic.day_6_events,
        auc.day_6_users,
        ic.day_7_events,
        auc.day_7_users,
        ic.day_14_events,
        auc.day_14_users,
        ic.day_30_events,
        auc.day_30_users,
        ic.day_45_events,
        auc.day_45_users,
        ic.day_60_events,
        auc.day_60_users,
        ic.day_75_events,
        auc.day_75_users,
        ic.day_90_events,
        auc.day_90_users
      FROM active_user_counts auc
      LEFT JOIN impression_counts ic ON auc.install_date = ic.install_date
      ORDER BY auc.install_date ASC
      LIMIT 100
    `;

    console.log('Generated Query:', query);
    const [rows] = await bigquery.query(query);
    console.log('Query Results Row Count:', rows.length);
    if (rows.length > 0) {
      console.log('First Row:', JSON.stringify(rows[0], null, 2));
    }
    res.json(rows);
  } catch (error) {
    console.error('Error fetching ad impressions cohort:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(port, () => {
  console.log(`Cube Wars Analytics API running on port ${port}`);
});
