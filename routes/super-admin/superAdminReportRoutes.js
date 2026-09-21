import express from 'express';
import { protectSuperAdmin } from '../../middleware/authMiddleware.js';
import {
  getPlatformAnalyticsReport,
  getPlatformSettings,
  updatePlatformSettings,
  getPlatformSettingsHistory
} from '../../controllers/super-admin/superAdminReportController.js';

const router = express.Router();

router.get('/super-admin/reports', protectSuperAdmin, getPlatformAnalyticsReport);
router.get('/super-admin/settings', protectSuperAdmin, getPlatformSettings);
router.patch('/super-admin/settings', protectSuperAdmin, updatePlatformSettings);
router.get('/super-admin/settings/history', protectSuperAdmin, getPlatformSettingsHistory);

export default router;
