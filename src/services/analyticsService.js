import { apiRequest } from './api';

export const analyticsService = {
  async getOverview(rangeOrDays = '7d') {
    let query = '';
    if (typeof rangeOrDays === 'number') {
      query = `?days=${rangeOrDays}`;
    } else if (rangeOrDays) {
      query = `?range=${encodeURIComponent(rangeOrDays)}`;
    }
    return await apiRequest(`/analytics/overview${query}`);
  },

  async getTimeSeries(rangeOrDays = '7d') {
    let query = '';
    if (typeof rangeOrDays === 'number') {
      query = `?days=${rangeOrDays}`;
    } else if (rangeOrDays) {
      query = `?range=${encodeURIComponent(rangeOrDays)}`;
    }
    return await apiRequest(`/analytics/timeseries${query}`);
  }
};
