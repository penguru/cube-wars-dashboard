import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Filter, TrendingUp, TrendingDown, Users, Target, LogOut, Award } from 'lucide-react';
import { useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import config from './config';

const API_BASE_URL = config.API_BASE_URL;
const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#8dd1e1', '#d084d0', '#ffb366', '#a4de6c', '#d0ed57', '#83a6ed'];

// Helper function to remove ID prefix from unit names (e.g., "9 - Stinger Drone" -> "Stinger Drone")
const cleanUnitName = (name) => {
  if (!name) return name;
  // Match pattern: number - space - name (e.g., "9 - ", "14 - ")
  return name.replace(/^\d+\s*-\s*/, '');
};

const Dashboard = () => {
  const { user, logout, loading: authLoading, isAuthenticated } = useAuth();

  const getCurrentDate = () => new Date().toISOString().split('T')[0];
  const getSevenDaysAgo = () => {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return date.toISOString().split('T')[0];
  };

  const [filters, setFilters] = useState({
    startDate: getSevenDaysAgo(),
    endDate: getCurrentDate(),
    platform: 'all',
    levelCount: 50,
    country: 'all',
    version: 'all',
    loadoutLevel: 'all',
  });

  const [data, setData] = useState({
    rewardedAds: { rows: [], totals: null },
    levelAnalysis: [],
    levelSilverBoost: [],
    unitLoadout: { unitFrequency: [], topLoadouts: [] },
    unitUpgrades: [],
    churnAnalysis: [],
    boosterBoxes: [],
    baseStationUpgrades: [],
    overallStats: {},
  });

  const [availableCountries, setAvailableCountries] = useState([]);
  const [availableVersions, setAvailableVersions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedRewardedAd, setSelectedRewardedAd] = useState(null);
  const [selectedRewardedAdPattern, setSelectedRewardedAdPattern] = useState(null);
  const [cohortData, setCohortData] = useState([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams(filters);

      // Create special params for unit loadout with level parameter
      const unitLoadoutParams = new URLSearchParams({
        ...filters,
        level: filters.loadoutLevel,
      });
      delete unitLoadoutParams.delete('loadoutLevel');

      const [
        rewardedAdsRes,
        levelAnalysisRes,
        silverBoostRes,
        unitLoadoutRes,
        unitUpgradesRes,
        churnAnalysisRes,
        boosterBoxesRes,
        baseStationRes,
        overallStatsRes,
      ] = await Promise.all([
        fetch(`${API_BASE_URL}/rewarded-ads?${params}`, { credentials: 'include' }),
        fetch(`${API_BASE_URL}/level-analysis?${params}`, { credentials: 'include' }),
        fetch(`${API_BASE_URL}/level-silver-coin-boost?${params}`, { credentials: 'include' }),
        fetch(`${API_BASE_URL}/unit-loadout-analysis?${unitLoadoutParams}`, { credentials: 'include' }),
        fetch(`${API_BASE_URL}/unit-upgrade-analysis?${params}`, { credentials: 'include' }),
        fetch(`${API_BASE_URL}/churn-analysis?${params}`, { credentials: 'include' }),
        fetch(`${API_BASE_URL}/booster-box-analysis?${params}`, { credentials: 'include' }),
        fetch(`${API_BASE_URL}/base-station-analysis?${params}`, { credentials: 'include' }),
        fetch(`${API_BASE_URL}/overall-stats?${params}`, { credentials: 'include' }),
      ]);

      // Helper function to safely parse JSON and ensure array type
      const safeParseArray = async (response) => {
        if (!response.ok) {
          console.error('API error:', response.status, response.statusText);
          return [];
        }
        const data = await response.json();
        return Array.isArray(data) ? data : [];
      };

      // Helper function for unit loadout which returns an object with arrays
      const safeParseUnitLoadout = async (response) => {
        if (!response.ok) {
          return { unitFrequency: [], topLoadouts: [] };
        }
        const data = await response.json();
        return {
          unitFrequency: Array.isArray(data.unitFrequency) ? data.unitFrequency : [],
          topLoadouts: Array.isArray(data.topLoadouts) ? data.topLoadouts : [],
        };
      };

      // Helper function for overall stats which returns an object
      const safeParseObject = async (response) => {
        if (!response.ok) {
          return {};
        }
        const data = await response.json();
        return data || {};
      };

      // Parse rewarded ads with totals
      const rewardedAdsData = await (async (response) => {
        if (!response.ok) {
          return { rows: [], totals: null };
        }
        const data = await response.json();
        // Handle both old format (array) and new format (object with rows/totals)
        if (Array.isArray(data)) {
          return { rows: data, totals: null };
        }
        return {
          rows: Array.isArray(data.rows) ? data.rows : [],
          totals: data.totals || null
        };
      })(rewardedAdsRes);

      setData({
        rewardedAds: rewardedAdsData,
        levelAnalysis: await safeParseArray(levelAnalysisRes),
        levelSilverBoost: await safeParseArray(silverBoostRes),
        unitLoadout: await safeParseUnitLoadout(unitLoadoutRes),
        unitUpgrades: await safeParseArray(unitUpgradesRes),
        churnAnalysis: await safeParseArray(churnAnalysisRes),
        boosterBoxes: await safeParseArray(boosterBoxesRes),
        baseStationUpgrades: await safeParseArray(baseStationRes),
        overallStats: await safeParseObject(overallStatsRes),
      });

      // If we're viewing cohort analysis, refresh that data too
      if (selectedRewardedAdPattern) {
        await fetchCohortData(selectedRewardedAdPattern, false);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
    setLoading(false);
  };

  const fetchFilterOptions = async () => {
    try {
      const params = new URLSearchParams({
        startDate: filters.startDate,
        endDate: filters.endDate,
        platform: filters.platform,
      });

      const [countriesRes, versionsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/available-countries?${params}`, { credentials: 'include' }),
        fetch(`${API_BASE_URL}/available-versions?${params}`, { credentials: 'include' }),
      ]);

      if (countriesRes.ok) {
        const countries = await countriesRes.json();
        setAvailableCountries(countries);
      }

      if (versionsRes.ok) {
        const versions = await versionsRes.json();
        setAvailableVersions(versions);
      }
    } catch (error) {
      console.error('Error fetching filter options:', error);
    }
  };

  const fetchCohortData = async (eventName, shouldSetLoading = true) => {
    if (shouldSetLoading) {
      setLoading(true);
    }
    try {
      const params = new URLSearchParams({
        startDate: filters.startDate,
        endDate: filters.endDate,
        platform: filters.platform,
        country: filters.country,
        version: filters.version,
        eventName: eventName,
      });

      console.log('Fetching cohort data with params:', {
        startDate: filters.startDate,
        endDate: filters.endDate,
        platform: filters.platform,
        country: filters.country,
        version: filters.version,
        eventName: eventName,
      });

      const response = await fetch(`${API_BASE_URL}/rewarded-ads-cohort?${params}`, {
        credentials: 'include',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Cohort data received, rows:', data.length);
        if (data.length > 0) {
          console.log('First row:', data[0]);
        }
        setCohortData(data);
      }
    } catch (error) {
      console.error('Error fetching cohort data:', error);
    }
    if (shouldSetLoading) {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
      fetchFilterOptions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // Refetch filter options when platform or date range changes
  useEffect(() => {
    if (isAuthenticated) {
      fetchFilterOptions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.platform, filters.startDate, filters.endDate]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  const StatCard = ({ title, value, icon: Icon, color = 'blue' }) => (
    <div className="bg-white rounded-lg shadow-md p-6 border-l-4" style={{ borderLeftColor: `#${color === 'blue' ? '3b82f6' : color === 'green' ? '10b981' : color === 'red' ? 'ef4444' : 'f59e0b'}` }}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
        <Icon className="w-8 h-8 text-gray-400" />
      </div>
    </div>
  );

  const FilterPanel = () => (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center">
          <Filter className="w-5 h-5 mr-2" />Filters
        </h2>
        <button
          onClick={fetchData}
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center"
        >
          {loading ? 'Loading...' : 'Apply Filters'}
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => handleFilterChange('startDate', e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => handleFilterChange('endDate', e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Platform</label>
          <select
            value={filters.platform}
            onChange={(e) => handleFilterChange('platform', e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Platforms</option>
            <option value="ios">iOS</option>
            <option value="android">Android</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
          <select
            value={filters.country}
            onChange={(e) => handleFilterChange('country', e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Countries</option>
            {availableCountries.map(country => (
              <option key={country.country} value={country.country}>
                {country.country} ({country.user_count} users)
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">App Version</label>
          <select
            value={filters.version}
            onChange={(e) => handleFilterChange('version', e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Versions</option>
            {availableVersions.map(version => (
              <option key={version.version} value={version.version}>
                {version.version} ({version.user_count} users)
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Max Levels</label>
          <input
            type="number"
            min="1"
            max="500"
            value={filters.levelCount}
            onChange={(e) => handleFilterChange('levelCount', parseInt(e.target.value) || 50)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="50"
          />
        </div>
      </div>
    </div>
  );

  const TabButton = ({ id, label, isActive, onClick }) => (
    <button
      onClick={() => onClick(id)}
      className={`px-4 py-2 rounded-md font-medium transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-gray-600 hover:text-blue-600 hover:bg-gray-100'}`}
    >
      {label}
    </button>
  );

  const OverviewTab = () => {
    const stats = data.overallStats;
    const totalRewardedAds = data.rewardedAds.totals ? data.rewardedAds.totals.total_count :
      (data.rewardedAds.rows || []).reduce((sum, item) => sum + item.total_count, 0);
    const avgCompletionRate = data.levelAnalysis.length > 0
      ? (data.levelAnalysis.reduce((sum, item) => sum + (item.completion_rate || 0), 0) / data.levelAnalysis.length).toFixed(1)
      : 0;

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <StatCard title="Total Users" value={stats.total_users?.toLocaleString() || 'N/A'} icon={Users} color="blue" />
          <StatCard title="Total Rewarded Ads" value={totalRewardedAds.toLocaleString()} icon={Target} color="green" />
          <StatCard title="Avg Completion Rate" value={`${avgCompletionRate}%`} icon={TrendingUp} color="yellow" />
          <StatCard title="Level Completions" value={stats.total_level_completions?.toLocaleString() || 'N/A'} icon={Award} color="blue" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4">Level Completion Rates</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.levelAnalysis.slice(0, 20)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="level" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="completion_rate" stroke="#8884d8" strokeWidth={2} name="Completion %" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4">Top 10 Rewarded Ads</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={(data.rewardedAds.rows || []).slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="event_name" angle={-45} textAnchor="end" height={100} interval={0} fontSize={10} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="total_count" fill="#82ca9d" name="Total Views" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    );
  };

  const RewardedAdsTab = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">Rewarded Ads Performance</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Event Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Count</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unique Users</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg per User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg per User (All)</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.rewardedAds.rows.map((item, index) => (
                <tr
                  key={index}
                  className="hover:bg-blue-50 cursor-pointer transition-colors"
                  onClick={() => {
                    setSelectedRewardedAd(item.event_name);
                    setSelectedRewardedAdPattern(item.event_name);
                    setActiveTab('cohort-analysis');
                    fetchCohortData(item.event_name);
                  }}
                >
                  <td className="px-6 py-4 text-sm font-medium text-blue-600 hover:text-blue-800">{item.event_name.replace('RV_Watched_', '').replace(/_/g, ' ')}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{item.total_count.toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{item.unique_users.toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{item.avg_per_user}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{item.avg_per_all_users}</td>
                </tr>
              ))}
              {data.rewardedAds.totals && (
                <tr
                  className="bg-gray-100 font-bold border-t-2 border-gray-400 hover:bg-gray-200 cursor-pointer transition-colors"
                  onClick={() => {
                    setSelectedRewardedAd('ALL_REWARDED_ADS');
                    setSelectedRewardedAdPattern('RV_Watched_%');
                    setActiveTab('cohort-analysis');
                    fetchCohortData('RV_Watched_%');
                  }}
                >
                  <td className="px-6 py-4 text-sm font-bold text-blue-700 hover:text-blue-900">{data.rewardedAds.totals.event_name}</td>
                  <td className="px-6 py-4 text-sm font-bold text-gray-900">{data.rewardedAds.totals.total_count.toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm font-bold text-gray-900">{data.rewardedAds.totals.unique_users.toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm font-bold text-gray-900">{data.rewardedAds.totals.avg_per_user}</td>
                  <td className="px-6 py-4 text-sm font-bold text-gray-900">{data.rewardedAds.totals.avg_per_all_users}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">Rewarded Ads Distribution</h3>
        <ResponsiveContainer width="100%" height={400}>
          <PieChart>
            <Pie
              data={data.rewardedAds.rows}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ event_name, total_count }) => `${event_name.replace('RV_Watched_', '').substring(0, 15)}: ${total_count}`}
              outerRadius={120}
              fill="#8884d8"
              dataKey="total_count"
            >
              {data.rewardedAds.rows.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  const LevelAnalysisTab = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">Level Completion Analysis</h3>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={data.levelAnalysis}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="level" />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip />
            <Legend />
            <Line yAxisId="left" type="monotone" dataKey="completion_rate" stroke="#8884d8" strokeWidth={2} name="Completion Rate %" />
            <Line yAxisId="right" type="monotone" dataKey="avg_attempts_to_complete" stroke="#82ca9d" strokeWidth={2} name="Avg Attempts" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">Level Statistics</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Level</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unique Users</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Completion Rate</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg Attempts</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg Duration (Complete)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg Duration (Fail)</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.levelAnalysis.map((item, index) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Level {item.level}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.unique_users?.toLocaleString() || 'N/A'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.completion_rate}%</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.avg_attempts_to_complete || 'N/A'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.avg_duration_complete ? `${item.avg_duration_complete}s` : 'N/A'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.avg_duration_fail ? `${item.avg_duration_fail}s` : 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">Silver Coin Boost Impact</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Level</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Boost Usage %</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Completion with Boost</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Completion without Boost</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Impact</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.levelSilverBoost.map((item, index) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Level {item.level}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.boost_usage_rate}%</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.completion_rate_with_boost}%</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.completion_rate_without_boost}%</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`font-medium ${(item.completion_rate_with_boost - item.completion_rate_without_boost) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {((item.completion_rate_with_boost || 0) - (item.completion_rate_without_boost || 0)).toFixed(2)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const UnitAnalysisTab = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">Most Used Units in Loadout</h3>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={data.unitLoadout.unitFrequency.slice(0, 15).map(item => ({
            ...item,
            name: cleanUnitName(item.name)
          }))}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} interval={0} />
            <YAxis />
            <Tooltip />
            <Bar dataKey="usage_count" fill="#8884d8" name="Usage Count" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Top 20 Unit Loadout Combinations</h3>
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">Filter by Level:</label>
            <input
              type="number"
              min="1"
              value={filters.loadoutLevel === 'all' ? '' : filters.loadoutLevel}
              onChange={(e) => {
                const value = e.target.value;
                handleFilterChange('loadoutLevel', value === '' ? 'all' : value);
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  fetchData();
                }
              }}
              className="w-24 border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="All"
            />
            <button
              onClick={fetchData}
              disabled={loading}
              className="bg-blue-600 text-white px-4 py-1 rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm"
            >
              {loading ? 'Loading...' : 'Apply'}
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Loadout</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usage Count</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.unitLoadout.topLoadouts.slice(0, 20).map((item, index) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">#{index + 1}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {item.name.split(',').map(unit => cleanUnitName(unit.trim())).join(', ')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.usage_count.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">Unit Upgrade Statistics</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Upgrades</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg Level</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Max Level</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.unitUpgrades.map((item, index) => (
                <tr key={index}>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{cleanUnitName(item.unit_name)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.total_upgrades.toLocaleString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.avg_upgrade_level}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.max_level}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const ChurnAnalysisTab = () => {
    const hardestLevel = data.churnAnalysis.reduce((max, item) =>
      (item.difficulty_score || 0) > (max.difficulty_score || 0) ? item : max
    , { level: 'N/A', difficulty_score: 0 });

    const maxChurnLevel = data.churnAnalysis.reduce((max, item) =>
      (item.churn_rate || 0) > (max.churn_rate || 0) ? item : max
    , { level: 'N/A', churn_rate: 0 });

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <StatCard
            title="Hardest Level"
            value={`Level ${hardestLevel.level} (Score: ${hardestLevel.difficulty_score?.toFixed(2) || 'N/A'})`}
            icon={TrendingDown}
            color="red"
          />
          <StatCard
            title="Maximum Churn Level"
            value={`Level ${maxChurnLevel.level} (${maxChurnLevel.churn_rate}% churn)`}
            icon={TrendingDown}
            color="red"
          />
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">Level Retention Funnel</h3>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={data.churnAnalysis}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="level" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="users_reached_level" stroke="#82ca9d" strokeWidth={2} name="Users Reached" />
              <Line type="monotone" dataKey="users_churned_at_level" stroke="#ff7300" strokeWidth={2} name="Users Churned" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">Churn Analysis by Level</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Level</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Users Reached</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Users Churned</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Churn Rate</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Failure Rate</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Difficulty Score</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.churnAnalysis.map((item, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Level {item.level}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.users_reached_level?.toLocaleString() || 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.users_churned_at_level?.toLocaleString() || 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.churn_rate}%</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.failure_rate}%</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.difficulty_score || 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const CohortAnalysisTab = () => {
    if (!selectedRewardedAd) {
      return (
        <div className="bg-white rounded-lg shadow-md p-6">
          <p className="text-gray-500">Please select a rewarded ad from the Rewarded Ads Performance table.</p>
        </div>
      );
    }

    const days = [0, 1, 2, 3, 4, 5, 6, 7, 14, 30, 45, 60, 75, 90];

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">
              Cohort Analysis: {selectedRewardedAd === 'ALL_REWARDED_ADS' ? 'All Rewarded Ads' : selectedRewardedAd.replace('RV_Watched_', '').replace(/_/g, ' ')}
            </h3>
            <button
              onClick={() => {
                setSelectedRewardedAd(null);
                setActiveTab('rewarded-ads');
              }}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
            >
              Back to Rewarded Ads
            </button>
          </div>

          {cohortData.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No cohort data available for the selected filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase sticky left-0 bg-gray-50">Install Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cohort Size</th>
                    {days.map(day => (
                      <th key={day} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Day {day}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {cohortData.map((cohort, index) => {
                    // Helper to safely get numeric value
                    const getNumValue = (val) => {
                      if (val === null || val === undefined) return 0;
                      if (typeof val === 'object' && val.value !== undefined) return Number(val.value);
                      return Number(val);
                    };

                    // Helper to safely get string value (for dates)
                    const getStringValue = (val) => {
                      if (val === null || val === undefined) return '';
                      if (typeof val === 'object' && val.value !== undefined) return String(val.value);
                      return String(val);
                    };

                    const cohortSize = getNumValue(cohort.cohort_size);
                    const installDate = getStringValue(cohort.install_date);

                    return (
                      <tr key={index}>
                        <td className="px-4 py-4 text-sm font-medium text-gray-900 sticky left-0 bg-white">
                          {installDate}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-900 font-semibold">
                          {cohortSize.toLocaleString()}
                        </td>
                        {days.map(day => {
                          const events = getNumValue(cohort[`day_${day}_events`]);
                          const users = getNumValue(cohort[`day_${day}_users`]);
                          const avg = users > 0 ? (events / users).toFixed(2) : '0.00';
                          return (
                            <td key={day} className="px-4 py-4 text-sm text-gray-500">
                              <div>{events.toLocaleString()}</div>
                              <div className="text-xs text-gray-400">({avg})</div>
                              <div className="text-xs text-blue-500">{users}</div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  };

  const OtherAnalyticsTab = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">Booster Box Analytics</h3>
        {data.boosterBoxes.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No booster box data available for the selected filters. This event may not exist in your Firebase Analytics data yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Box ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Times Opened</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unique Users</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg per User</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.boosterBoxes.map((item, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.box_id || 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.times_opened.toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.unique_users.toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.avg_per_user}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">Base Station Upgrades</h3>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={(() => {
            // Transform data: group by upgrade_level, with each skill as a separate series
            const levelMap = {};
            data.baseStationUpgrades.forEach(item => {
              if (!levelMap[item.upgrade_level]) {
                levelMap[item.upgrade_level] = { upgrade_level: item.upgrade_level };
              }
              levelMap[item.upgrade_level][item.skill] = item.upgrade_count;
            });
            return Object.values(levelMap).sort((a, b) => a.upgrade_level - b.upgrade_level);
          })()}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="upgrade_level" label={{ value: 'Upgrade Level', position: 'insideBottom', offset: -5 }} />
            <YAxis label={{ value: 'Upgrade Count', angle: -90, position: 'insideLeft' }} />
            <Tooltip />
            <Legend />
            {/* Dynamically create a Line for each unique skill */}
            {Array.from(new Set(data.baseStationUpgrades.map(item => item.skill))).map((skill, index) => (
              <Line
                key={skill}
                type="monotone"
                dataKey={skill}
                stroke={COLORS[index % COLORS.length]}
                name={skill}
                strokeWidth={2}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewTab />;
      case 'rewarded-ads':
        return <RewardedAdsTab />;
      case 'cohort-analysis':
        return <CohortAnalysisTab />;
      case 'level-analysis':
        return <LevelAnalysisTab />;
      case 'unit-analysis':
        return <UnitAnalysisTab />;
      case 'churn':
        return <ChurnAnalysisTab />;
      case 'other':
        return <OtherAnalyticsTab />;
      default:
        return <OverviewTab />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Cube Wars Analytics Dashboard</h1>
            <p className="text-gray-600 mt-2">Comprehensive analytics for your mobile game</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">{user?.name}</p>
              <p className="text-xs text-gray-500">{user?.email}</p>
            </div>
            {user?.picture && (
              <img
                src={user.picture}
                alt={user.name}
                className="w-10 h-10 rounded-full border-2 border-gray-300"
              />
            )}
            <button
              onClick={logout}
              className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>

        <FilterPanel />

        <div className="bg-white rounded-lg shadow-md mb-6">
          <div className="border-b border-gray-200 px-6 py-4">
            <nav className="flex space-x-4 flex-wrap gap-2">
              <TabButton id="overview" label="Overview" isActive={activeTab === 'overview'} onClick={setActiveTab} />
              <TabButton id="rewarded-ads" label="Rewarded Ads" isActive={activeTab === 'rewarded-ads'} onClick={setActiveTab} />
              <TabButton id="level-analysis" label="Level Analysis" isActive={activeTab === 'level-analysis'} onClick={setActiveTab} />
              <TabButton id="unit-analysis" label="Unit Analysis" isActive={activeTab === 'unit-analysis'} onClick={setActiveTab} />
              <TabButton id="churn" label="Churn Analysis" isActive={activeTab === 'churn'} onClick={setActiveTab} />
              <TabButton id="other" label="Other Analytics" isActive={activeTab === 'other'} onClick={setActiveTab} />
            </nav>
          </div>
          <div className="p-6">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              renderTabContent()
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
