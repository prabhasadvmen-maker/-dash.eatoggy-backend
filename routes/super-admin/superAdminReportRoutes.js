import express from 'express';
import { protectSuperAdmin } from '../../middleware/authMiddleware.js';
import {
  getPlatformAnalyticsReport,
  getPlatformSettings,
  updatePlatformSettings,
  getPlatformSettingsHistory
} from '../../controllers/super-admin/superAdminReportController.js';

const router = express.Router();

router.get('/reports', protectSuperAdmin, getPlatformAnalyticsReport);
router.get('/settings', protectSuperAdmin, getPlatformSettings);
router.patch('/settings', protectSuperAdmin, updatePlatformSettings);
router.get('/settings/history', protectSuperAdmin, getPlatformSettingsHistory);

export default router;
