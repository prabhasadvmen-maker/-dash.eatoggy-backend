import express from 'express';
import {
  registerProfile,
  updateProfile,
  updateLocation,
  uploadDocuments,
  updateBank,
  getActiveFee,
  createPaymentOrder,
  verifyPayment,
  submitOnboarding,
  resubmitOnboarding
} from '../../controllers/delivery/deliveryOnboardingController.js';
import { protectDeliveryPartner } from '../../middleware/authMiddleware.js';
import { upload } from '../../integrations/storage/r2UploadService.js';

const router = express.Router();

router.get('/fee', getActiveFee);
router.post('/profile', registerProfile);  // New user registration - Public
router.put('/profile', updateProfile);     // Existing user profile update - Public (requires mobile if no token)

// Protected Onboarding Routes
router.use(protectDeliveryPartner);
router.put('/location', updateLocation);

router.post(
  '/documents',
  upload.fields([
    { name: 'aadhaarFront', maxCount: 1 },
    { name: 'aadhaarBack', maxCount: 1 },
    { name: 'panImage', maxCount: 1 }
  ]),
  uploadDocuments
);

router.put('/bank', updateBank);
router.post('/create-payment-order', createPaymentOrder);
router.post('/verify-payment', verifyPayment);
router.post('/submit', submitOnboarding);
router.post('/resubmit', resubmitOnboarding);

export default router;
