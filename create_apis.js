const fs = require('fs');
const path = require('path');

const controllersDir = path.join(__dirname, 'controllers');
const routesDir = path.join(__dirname, 'routes');

const apis = [
  {
    name: 'banners',
    controllerPath: 'banners/bannerController.js',
    routePath: 'banners/bannerRoutes.js',
    controllerCode: `import { successResponse } from '../../common/apiResponse.js';
import { asyncHandler } from '../../common/asyncHandler.js';

export const getBanners = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, type } = req.query;
  return successResponse(res, {
    statusCode: 200,
    message: 'Banners retrieved successfully',
    data: [],
    pagination: { total: 0, page: parseInt(page), limit: parseInt(limit), totalPages: 0 }
  });
});
`,
    routeCode: `import express from 'express';
import { getBanners } from '../../controllers/banners/bannerController.js';

const router = express.Router();

router.get('/', getBanners);

export default router;
`,
    mountPath: '/api/banners'
  },
  {
    name: 'collections',
    controllerPath: 'collections/collectionController.js',
    routePath: 'collections/collectionRoutes.js',
    controllerCode: `import { successResponse } from '../../common/apiResponse.js';
import { asyncHandler } from '../../common/asyncHandler.js';

export const getCollections = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  return successResponse(res, {
    statusCode: 200,
    message: 'Collections retrieved successfully',
    data: [],
    pagination: { total: 0, page: parseInt(page), limit: parseInt(limit), totalPages: 0 }
  });
});
`,
    routeCode: `import express from 'express';
import { getCollections } from '../../controllers/collections/collectionController.js';

const router = express.Router();

router.get('/', getCollections);

export default router;
`,
    mountPath: '/api/collections'
  },
  {
    name: 'orderTracking',
    controllerPath: 'orders/orderTrackingController.js',
    routePath: 'orders/orderTrackingRoutes.js',
    controllerCode: `import { successResponse } from '../../common/apiResponse.js';
import { asyncHandler } from '../../common/asyncHandler.js';

export const getOrderTracking = asyncHandler(async (req, res) => {
  const { id } = req.params;
  return successResponse(res, {
    statusCode: 200,
    message: 'Tracking info retrieved successfully',
    data: { orderId: id, status: 'IN_TRANSIT', location: {}, estimatedTime: '15 mins', deliveryPartner: {} }
  });
});
`,
    routeCode: `import express from 'express';
import { getOrderTracking } from '../../controllers/orders/orderTrackingController.js';
import { protectCustomer } from '../../middleware/authMiddleware.js';

const router = express.Router();

router.get('/:id', protectCustomer, getOrderTracking);

export default router;
`,
    mountPath: '/api/customers/orders/tracking'
  },
  {
    name: 'starterPack',
    controllerPath: 'offers/starterPackController.js',
    routePath: 'offers/starterPackRoutes.js',
    controllerCode: `import { successResponse } from '../../common/apiResponse.js';
import { asyncHandler } from '../../common/asyncHandler.js';

export const getStarterPack = asyncHandler(async (req, res) => {
  return successResponse(res, {
    statusCode: 200,
    message: 'Starter pack retrieved successfully',
    data: { offers: [], totalDiscount: 0, validity: 30 }
  });
});
`,
    routeCode: `import express from 'express';
import { getStarterPack } from '../../controllers/offers/starterPackController.js';
import { protectCustomer } from '../../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', protectCustomer, getStarterPack);

export default router;
`,
    mountPath: '/api/customer/starter-pack'
  },
  {
    name: 'wallet',
    controllerPath: 'wallet/walletController.js',
    routePath: 'wallet/walletRoutes.js',
    controllerCode: `import { successResponse } from '../../common/apiResponse.js';
import { asyncHandler } from '../../common/asyncHandler.js';

export const getWallet = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  return successResponse(res, {
    statusCode: 200,
    message: 'Wallet retrieved successfully',
    data: { balance: 0, transactions: [], pagination: { total: 0, page: parseInt(page), limit: parseInt(limit), totalPages: 0 } }
  });
});

export const addMoney = asyncHandler(async (req, res) => {
  const { amount, paymentMethod } = req.body;
  return successResponse(res, {
    statusCode: 200,
    message: 'Money added successfully',
    data: { transactionId: 'TXN123', newBalance: amount }
  });
});
`,
    routeCode: `import express from 'express';
import { getWallet, addMoney } from '../../controllers/wallet/walletController.js';
import { protectCustomer } from '../../middleware/authMiddleware.js';

const router = express.Router();

router.use(protectCustomer);
router.get('/', getWallet);
router.post('/add-money', addMoney);

export default router;
`,
    mountPath: '/api/customer/wallet'
  },
  {
    name: 'referral',
    controllerPath: 'referrals/referralController.js',
    routePath: 'referrals/referralRoutes.js',
    controllerCode: `import { successResponse } from '../../common/apiResponse.js';
import { asyncHandler } from '../../common/asyncHandler.js';

export const getReferral = asyncHandler(async (req, res) => {
  return successResponse(res, {
    statusCode: 200,
    message: 'Referral info retrieved successfully',
    data: { referralCode: 'REF123', referralLink: '', earnedAmount: 0, referralCount: 0, rewards: [] }
  });
});
`,
    routeCode: `import express from 'express';
import { getReferral } from '../../controllers/referrals/referralController.js';
import { protectCustomer } from '../../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', protectCustomer, getReferral);

export default router;
`,
    mountPath: '/api/customer/referral'
  },
  {
    name: 'faqs',
    controllerPath: 'faqs/faqController.js',
    routePath: 'faqs/faqRoutes.js',
    controllerCode: `import { successResponse } from '../../common/apiResponse.js';
import { asyncHandler } from '../../common/asyncHandler.js';

export const getFaqs = asyncHandler(async (req, res) => {
  return successResponse(res, {
    statusCode: 200,
    message: 'FAQs retrieved successfully',
    data: []
  });
});
`,
    routeCode: `import express from 'express';
import { getFaqs } from '../../controllers/faqs/faqController.js';

const router = express.Router();

router.get('/', getFaqs);

export default router;
`,
    mountPath: '/api/customer/faqs'
  },
  {
    name: 'policies',
    controllerPath: 'policies/policyController.js',
    routePath: 'policies/policyRoutes.js',
    controllerCode: `import { successResponse } from '../../common/apiResponse.js';
import { asyncHandler } from '../../common/asyncHandler.js';

export const getPrivacyPolicy = asyncHandler(async (req, res) => {
  return successResponse(res, {
    statusCode: 200,
    message: 'Privacy policy retrieved successfully',
    data: { title: 'Privacy Policy', content: '', lastUpdated: new Date() }
  });
});

export const getTermsAndConditions = asyncHandler(async (req, res) => {
  return successResponse(res, {
    statusCode: 200,
    message: 'Terms and Conditions retrieved successfully',
    data: { title: 'Terms and Conditions', content: '', lastUpdated: new Date() }
  });
});
`,
    routeCode: `import express from 'express';
import { getPrivacyPolicy, getTermsAndConditions } from '../../controllers/policies/policyController.js';

const router = express.Router();

router.get('/customer/privacy_policy', getPrivacyPolicy);
router.get('/customer/terms_and_conditions', getTermsAndConditions);

export default router;
`,
    mountPath: '/api/public/policies'
  },
  {
    name: 'aiChat',
    controllerPath: 'ai-chat/aiChatController.js',
    routePath: 'ai-chat/aiChatRoutes.js',
    controllerCode: `import { successResponse } from '../../common/apiResponse.js';
import { asyncHandler } from '../../common/asyncHandler.js';

export const sendChatMessage = asyncHandler(async (req, res) => {
  return successResponse(res, {
    statusCode: 200,
    message: 'Message sent successfully',
    data: { response: 'Hello, how can I help?', conversationId: 'conv123' }
  });
});

export const getChatHistory = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  return successResponse(res, {
    statusCode: 200,
    message: 'Chat history retrieved successfully',
    data: [],
    pagination: { total: 0, page: parseInt(page), limit: parseInt(limit), totalPages: 0 }
  });
});
`,
    routeCode: `import express from 'express';
import { sendChatMessage, getChatHistory } from '../../controllers/ai-chat/aiChatController.js';
import { protectCustomer } from '../../middleware/authMiddleware.js';

const router = express.Router();

router.use(protectCustomer);
router.post('/', sendChatMessage);
router.get('/history', getChatHistory);

export default router;
`,
    mountPath: '/api/customer/ai-chat'
  },
  {
    name: 'services',
    controllerPath: 'services/serviceController.js',
    routePath: 'services/serviceRoutes.js',
    controllerCode: `import { successResponse } from '../../common/apiResponse.js';
import { asyncHandler } from '../../common/asyncHandler.js';

export const getServices = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  return successResponse(res, {
    statusCode: 200,
    message: 'Services retrieved successfully',
    data: [],
    pagination: { total: 0, page: parseInt(page), limit: parseInt(limit), totalPages: 0 }
  });
});

export const getFeaturedServices = asyncHandler(async (req, res) => {
  return successResponse(res, {
    statusCode: 200,
    message: 'Featured services retrieved successfully',
    data: []
  });
});

export const getServiceDetails = asyncHandler(async (req, res) => {
  return successResponse(res, {
    statusCode: 200,
    message: 'Service details retrieved successfully',
    data: { service: {}, packages: [], reviews: [], rating: 0 }
  });
});

export const getServicePackages = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  return successResponse(res, {
    statusCode: 200,
    message: 'Service packages retrieved successfully',
    data: [],
    pagination: { total: 0, page: parseInt(page), limit: parseInt(limit), totalPages: 0 }
  });
});
`,
    routeCode: `import express from 'express';
import { getServices, getFeaturedServices, getServiceDetails, getServicePackages } from '../../controllers/services/serviceController.js';

const router = express.Router();

router.get('/', getServices);
router.get('/featured', getFeaturedServices); // Will be mounted at /api/customer/services
router.get('/details/:id', getServiceDetails);
router.get('/packages/:id', getServicePackages); // Will be mounted at /api/packages/service

export default router;
`,
    mountPath: '/api/services' // Need to adjust mounting for some
  },
  {
    name: 'bookings',
    controllerPath: 'bookings/bookingController.js',
    routePath: 'bookings/bookingRoutes.js',
    controllerCode: `import { successResponse } from '../../common/apiResponse.js';
import { asyncHandler } from '../../common/asyncHandler.js';

export const getMyBookings = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  return successResponse(res, {
    statusCode: 200,
    message: 'Bookings retrieved successfully',
    data: [],
    pagination: { total: 0, page: parseInt(page), limit: parseInt(limit), totalPages: 0 }
  });
});
`,
    routeCode: `import express from 'express';
import { getMyBookings } from '../../controllers/bookings/bookingController.js';
import { protectCustomer } from '../../middleware/authMiddleware.js';

const router = express.Router();

router.get('/my-bookings', protectCustomer, getMyBookings);

export default router;
`,
    mountPath: '/api/bookings'
  },
  {
    name: 'translation',
    controllerPath: 'translation/translationController.js',
    routePath: 'translation/translationRoutes.js',
    controllerCode: `import { successResponse } from '../../common/apiResponse.js';
import { asyncHandler } from '../../common/asyncHandler.js';

export const translateText = asyncHandler(async (req, res) => {
  const { text, targetLanguage } = req.body;
  return successResponse(res, {
    statusCode: 200,
    message: 'Translated successfully',
    data: { original: text, translated: text, language: targetLanguage }
  });
});
`,
    routeCode: `import express from 'express';
import { translateText } from '../../controllers/translation/translationController.js';

const router = express.Router();

router.post('/translate', translateText);

export default router;
`,
    mountPath: '/api/translation'
  }
];

function ensureDirSync(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

apis.forEach(api => {
  const cPath = path.join(controllersDir, api.controllerPath);
  const rPath = path.join(routesDir, api.routePath);
  
  ensureDirSync(path.dirname(cPath));
  ensureDirSync(path.dirname(rPath));
  
  fs.writeFileSync(cPath, api.controllerCode);
  fs.writeFileSync(rPath, api.routeCode);
  
  console.log(\`Created \${api.name} controller and routes.\`);
});
