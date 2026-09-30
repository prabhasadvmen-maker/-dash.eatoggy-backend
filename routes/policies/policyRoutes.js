import express from 'express';
import { getPrivacyPolicy, getTermsAndConditions } from '../../controllers/policies/policyController.js';

const router = express.Router();

router.get('/customer/privacy_policy', getPrivacyPolicy);
router.get('/customer/terms_and_conditions', getTermsAndConditions);

export default router;
