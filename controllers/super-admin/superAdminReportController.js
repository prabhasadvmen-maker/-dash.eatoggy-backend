import {
  getPlatformAnalyticsReportService,
  getPlatformSettingsService,
  updatePlatformSettingsService,
  getPlatformSettingsHistoryService
} from '../../services/super-admin/reportService.js';

/**
 * SuperAdmin: Fetch platform analytics and financial report
 */
export const getPlatformAnalyticsReport = async (req, res) => {
  try {
    const report = await getPlatformAnalyticsReportService();
    res.json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * SuperAdmin: Fetch platform master settings
 */
export const getPlatformSettings = async (req, res) => {
  try {
    const settings = await getPlatformSettingsService();
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * SuperAdmin: Update platform master settings
 */
export const updatePlatformSettings = async (req, res) => {
  try {
    const settings = await updatePlatformSettingsService(req.body, req.admin);
    res.json({ success: true, message: 'Platform settings updated successfully', data: settings });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * SuperAdmin: Fetch settings audit history log
 */
export const getPlatformSettingsHistory = async (req, res) => {
  try {
    const history = await getPlatformSettingsHistoryService();
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
