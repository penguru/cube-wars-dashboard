# Cube Wars Analytics Dashboard - Features & Insights

This document details all the features and insights available in the dashboard, mapped to your game's Firebase events.

## Dashboard Tabs

### 1. Overview Tab

**Purpose**: Get a high-level view of your game's performance

**Metrics Displayed**:
- **Total Users**: Total number of unique users in the selected period
- **Total Rewarded Ads**: Sum of all rewarded ad views
- **Average Completion Rate**: Mean completion rate across all levels
- **Level Completions**: Total number of level completions

**Visualizations**:
- Level Completion Rates (Line Chart): Shows completion percentage for first 20 levels
- Top 10 Rewarded Ads (Bar Chart): Most watched rewarded ad types

**Use Cases**:
- Quick daily check-in on game health
- Identify overall trends
- Spot anomalies in key metrics

---

### 2. Rewarded Ads Tab

**Purpose**: Understand which rewarded ads are most valuable to players

**Events Tracked**:
- `RV_Watched_Victory_Pack`
- `RV_Watched_Defeat_Pack`
- `RV_Watched_Silver_Coin_Before_Game`
- `RV_Watched_Silver_Coin_In_Game`
- `RV_Watched_BoosterBox`
- `RV_Watched_Daily_Spin_Wheel`
- `RV_Watched_Daily_Spin_Wheel_2X`
- `RV_Watched_Coins_Shop`
- `RV_Watched_Daily_Offer_Refresh`

**Data Shown**:
- Total count per ad type
- Unique users who watched
- Average views per user
- Distribution pie chart

**Insights You Can Get**:
- Which ad placements are most popular
- Which rewards players value most
- User engagement with monetization features
- Potential areas to add more ad placements

**Example Insights**:
- If "Silver Coin Before Game" has high views, players value preparation
- If "Daily Spin Wheel 2X" is popular, consider more similar mechanics
- Low "Daily Offer Refresh" views might indicate uninteresting offers

---

### 3. Level Analysis Tab

**Purpose**: Deep dive into level progression, difficulty, and player behavior

#### 3.1 Level Completion Analysis

**Events Used**:
- `level_start` (with level, coins, gems parameters)
- `level_complete` (with level, duration_seconds)
- `level_fail` (with level, duration_seconds)

**Metrics**:
- **Completion Rate**: Percentage of attempts that result in completion
- **Average Attempts to Complete**: How many tries users need on average
- **Average Duration (Complete)**: Time taken to complete successfully
- **Average Duration (Fail)**: Time survived before failing
- **Unique Users**: Number of distinct players who attempted the level

**Chart**: Line chart showing completion rate and average attempts across levels

**Insights**:
- Levels with <50% completion rate might be too hard
- High average attempts might indicate frustrating difficulty
- Compare duration_fail vs duration_complete to understand where players struggle

#### 3.2 Silver Coin Boost Impact Analysis

**Events Used**:
- `RV_Watched_Silver_Coin_Before_Game`
- `RV_Watched_Silver_Coin_In_Game`
- Cross-referenced with `level_complete` and `level_fail`

**Metrics**:
- **Boost Usage Rate**: Percentage of attempts where player watched silver coin ad
- **Completion Rate With Boost**: Success rate when boost was used
- **Completion Rate Without Boost**: Success rate without boost
- **Impact**: Difference between the two rates

**Key Insights**:
- Positive impact shows the boost is valuable and working
- High usage but low impact suggests boost needs buffing
- Low usage might mean players don't understand the benefit
- Can inform pricing/value of similar powerups

**Example Analysis**:
```
Level 5:
- Boost Usage: 45%
- With Boost: 75% completion
- Without Boost: 55% completion
- Impact: +20%
→ The boost is valuable and well-utilized
```

---

### 4. Unit Analysis Tab

**Purpose**: Understand the game meta - which units players prefer and invest in

#### 4.1 Battle Start Loadout Analysis

**Event Used**: `battle_start_loadout`
- Parameters: `level`, `unit_names` (comma-separated list of 6 units)

**Data Shown**:
- **Individual Unit Usage**: How often each unit appears in loadouts
- **Top 20 Loadout Combinations**: Most popular complete 6-unit teams

**Insights**:
- Identify meta units that dominate
- Spot underused units that might need buffs
- Understand synergies between units
- Guide balancing decisions

**Example Insights**:
- "Stinger Drone" in 80% of loadouts → Core meta unit
- "Bug" rarely used → Might need buffs or cost reduction
- Certain combinations dominating → Check if too strong

#### 4.2 Unit Upgrade Analysis

**Event Used**: `unit_upgrade`
- Parameters: `level` (upgrade level achieved), `unit_name`

**Metrics**:
- **Total Upgrades**: How many times this unit was upgraded
- **Average Upgrade Level**: Mean level players upgrade to
- **Max Level**: Highest level achieved
- **Unique Users**: How many players upgraded this unit

**Insights**:
- Which units players invest resources in
- Correlation between popular loadout units and upgrade frequency
- Whether upgrade progression feels rewarding
- Resource sink analysis

**Example Analysis**:
```
Stinger Drone:
- Total Upgrades: 15,000
- Avg Level: 3.5
- Max Level: 7
→ Popular unit, most players upgrade to mid-levels
→ Consider if max level is too hard/expensive to reach
```

---

### 5. Churn Analysis Tab

**Purpose**: Identify where and why players stop playing

**Events Used**:
- `level_complete`
- `level_fail`
- Tracking max level reached per user

**Metrics**:

1. **Hardest Level**:
   - Based on difficulty score (total attempts / completions)
   - High failure rate
   - Shows which level is objectively hardest

2. **Maximum Churn Level**:
   - Level where most players stop progressing
   - Highest drop-off in player count
   - Critical point for retention

3. **Per-Level Data**:
   - **Users Reached Level**: How many got to this level
   - **Users Churned at Level**: How many stopped here
   - **Churn Rate**: Percentage who didn't proceed
   - **Failure Rate**: Percentage of failed attempts
   - **Difficulty Score**: Ratio of attempts to completions

**Visualizations**:
- Retention Funnel Line Chart: Shows user count declining by level
- Users Churned Bar Chart: Highlights problem levels

**Critical Insights**:

**High Churn + High Difficulty = Too Hard**
```
Level 8:
- Churn Rate: 25%
- Failure Rate: 70%
- Difficulty Score: 8.5
→ Major difficulty spike, consider rebalancing
```

**High Churn + Normal Difficulty = Design Issue**
```
Level 12:
- Churn Rate: 20%
- Failure Rate: 45%
- Difficulty Score: 3.2
→ Not particularly hard, might be boring or repetitive
→ Check if new mechanics or content needed
```

**Low Early Churn = Good FTUE**
```
Levels 1-3:
- Churn Rate: <5% each
→ Tutorial and early game successfully onboard players
```

**Actionable Strategies**:
- If churn spike at level X: Reduce difficulty, add tutorial, or give free power-up
- If gradual churn: Normal, but monitor rate
- If sudden spike: Emergency - investigate immediately

---

### 6. Other Analytics Tab

#### 6.1 Booster Box Analysis

**Event Used**: `booster_box_opened`
- Parameter: `id` (booster box type)

**Metrics**:
- Times opened per box type
- Unique users who opened
- Average per user

**Insights**:
- Which booster boxes are most valued
- Player engagement with progression systems
- Whether different rarities are appropriately distributed

#### 6.2 Base Station Upgrades

**Event Used**: `base_station_upgrade`
- Parameters: `Skill` (Attack/Health/CoinGeneration), `level`

**Metrics**:
- Upgrade count per skill type
- Distribution of upgrade levels

**Insights**:
- Which base station skills players prioritize
- Resource spending patterns
- Meta strategy preferences (offense vs defense)

---

## Filter Options

### Date Range Filter
- **Default**: Last 7 days
- **Purpose**: Focus on specific time periods
- **Use Cases**:
  - Compare before/after an update
  - Analyze specific event periods
  - Track improvement over time

### Platform Filter
- **Options**: All / iOS / Android
- **Purpose**: Compare platform performance
- **Use Cases**:
  - Identify platform-specific issues
  - Verify cross-platform consistency
  - Guide platform-specific optimizations

---

## Advanced Analysis Techniques

### 1. A/B Testing Analysis
If you release different versions:
- Use date filters to compare periods
- Compare before/after metrics
- Focus on churn and completion rates

### 2. Update Impact Assessment
After a game update:
1. Note the update date
2. Compare metrics before and after
3. Key metrics to watch:
   - Churn rate changes
   - Completion rate improvements
   - Rewarded ad view changes
   - Unit usage shifts

### 3. Cohort Analysis
Filter by date to analyze specific cohorts:
- "Players who started in January"
- "Post-marketing-campaign cohort"
- Compare cohort progression

### 4. Identifying Power Curves
Look at level analysis to spot:
- Linear difficulty progression
- Difficulty spikes
- Grinding zones (high attempts, eventual completion)
- Walls (high failure, high churn)

### 5. Monetization Optimization
Cross-reference:
- Which levels have high silver coin boost usage?
- Do players who use boosts complete more levels?
- Which ad types correlate with longer play sessions?

---

## Suggested Regular Analysis Workflow

### Daily Check (5 minutes)
1. Overview tab: Check key metrics
2. Note any unusual spikes or drops
3. Check if any alerts from churn analysis

### Weekly Review (30 minutes)
1. **Rewarded Ads**: Identify trends in ad viewing
2. **Level Analysis**: Check recent level completions
3. **Unit Analysis**: Monitor meta shifts
4. **Churn**: Identify problem levels

### Monthly Deep Dive (2 hours)
1. **Full Period Analysis**: Set date range to last 30 days
2. **Compare to Previous Month**: Look for trends
3. **Churn Analysis**: Deep dive into retention
4. **Unit Meta**: Assess balance changes needed
5. **Silver Coin Impact**: Evaluate boost effectiveness
6. **Action Items**: Create list of design/balance changes

---

## Key Performance Indicators (KPIs)

Based on your dashboard, track these KPIs:

1. **Overall Retention**: User count at level 1 vs level 10 vs level 20
2. **Monetization Engagement**: Total rewarded ad views per DAU
3. **Difficulty Balance**: Average completion rate (target: 40-60%)
4. **Progression Speed**: Average days to reach level X
5. **Meta Health**: Top 3 units should be <50% usage each
6. **Boost Value**: Silver coin boost should improve completion by 10-20%

---

## Making Data-Driven Decisions

### Scenario 1: New Level Design
**Before Release**:
- Review difficulty of similar levels
- Check average attempts for comparable levels
- Set target completion rate (e.g., 55%)

**After Release**:
- Monitor completion rate
- Check churn impact
- Adjust difficulty based on data

### Scenario 2: Unit Balancing
**If a Unit is Overpowered**:
- High loadout usage (>70%)
- High upgrade frequency
- Levels become easier with this unit

**Action**: Nerf the unit or buff alternatives

**If a Unit is Underpowered**:
- Low loadout usage (<10%)
- Low upgrade frequency
- Even when upgraded, doesn't appear in meta loadouts

**Action**: Buff or rework the unit

### Scenario 3: Monetization Optimization
**If Ad Revenue is Low**:
- Check which ads are rarely watched
- Analyze why (bad timing, poor rewards?)
- Test new placements or better rewards
- Use silver coin boost data to understand value perception

---

## Additional Insights Not Explicitly Shown

While these aren't separate dashboard sections, you can derive:

1. **Session Length**: From level durations
2. **Power User Identification**: Users with many upgrades/high levels
3. **Economic Sinks**: Coin/gem spending patterns via booster boxes
4. **Tutorial Effectiveness**: Level 1-3 completion rates
5. **Weekend vs Weekday**: Use date filters to compare

---

## Questions the Dashboard Answers

✅ Which levels are too hard?
✅ Where do most players quit?
✅ Which ads do players value most?
✅ Which units need balancing?
✅ Is the silver coin boost worth it?
✅ How long do players spend on each level?
✅ What's the current meta team composition?
✅ Are players engaging with all features?
✅ Is progression well-paced?
✅ Which platform has better retention?

---

## Future Enhancement Ideas

Consider adding:
- [ ] Daily Active Users (DAU) / Monthly Active Users (MAU) tracking
- [ ] Session length analysis
- [ ] Funnel analysis (install → level 1 → level 10 → level 20)
- [ ] Revenue correlation with engagement
- [ ] Player segmentation (whales vs casual)
- [ ] Predictive churn modeling
- [ ] Heatmaps of level failure points
- [ ] A/B test comparison views

---

This dashboard gives you comprehensive visibility into your game's health. Use it regularly to make informed decisions that improve player experience and retention!
