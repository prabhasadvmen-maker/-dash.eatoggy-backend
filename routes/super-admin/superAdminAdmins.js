import express from 'express';
import { protectSuperAdmin } from '../../middleware/authMiddleware.js';
import * as superAdminAdminController from '../../controllers/super-admin/superAdminAdminController.js';

const router = express.Router();

router.use(protectSuperAdmin);

router.get('/admins', superAdminAdminController.getAllAdmins);
router.post('/admins', superAdminAdminController.createAdmin);
router.put('/admins/:id', superAdminAdminController.updateAdmin);
router.patch('/admins/:id/reset-password', superAdminAdminController.resetAdminPassword);
router.delete('/admins/:id', superAdminAdminController.deleteAdmin);

export default router;
