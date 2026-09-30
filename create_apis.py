import os

controllers_dir = os.path.join(os.getcwd(), 'controllers')
routes_dir = os.path.join(os.getcwd(), 'routes')

apis = [
  {
    'name': 'banners',
    'controllerPath': 'banners/bannerController.js',
    'routePath': 'banners/bannerRoutes.js',
    'controllerCode': "import { successResponse } from '../../common/apiResponse.js';\nimport { asyncHandler } from '../../common/asyncHandler.js';\n\nexport const getBanners = asyncHandler(async (req, res) => {\n  const { page = 1, limit = 20, type } = req.query;\n  return successResponse(res, {\n    statusCode: 200,\n    message: 'Banners retrieved successfully',\n    data: [],\n    pagination: { total: 0, page: parseInt(page), limit: parseInt(limit), totalPages: 0 }\n  });\n});\n",
    'routeCode': "import express from 'express';\nimport { getBanners } from '../../controllers/banners/bannerController.js';\n\nconst router = express.Router();\n\nrouter.get('/', getBanners);\n\nexport default router;\n"
  },
  {
    'name': 'collections',
    'controllerPath': 'collections/collectionController.js',
    'routePath': 'collections/collectionRoutes.js',
    'controllerCode': "import { successResponse } from '../../common/apiResponse.js';\nimport { asyncHandler } from '../../common/asyncHandler.js';\n\nexport const getCollections = asyncHandler(async (req, res) => {\n  const { page = 1, limit = 20 } = req.query;\n  return successResponse(res, {\n    statusCode: 200,\n    message: 'Collections retrieved successfully',\n    data: [],\n    pagination: { total: 0, page: parseInt(page), limit: parseInt(limit), totalPages: 0 }\n  });\n});\n",
    'routeCode': "import express from 'express';\nimport { getCollections } from '../../controllers/collections/collectionController.js';\n\nconst router = express.Router();\n\nrouter.get('/', getCollections);\n\nexport default router;\n"
  },
  {
    'name': 'orderTracking',
    'controllerPath': 'orders/orderTrackingController.js',
    'routePath': 'orders/orderTrackingRoutes.js',
    'controllerCode': "import { successResponse } from '../../common/apiResponse.js';\nimport { asyncHandler } from '../../common/asyncHandler.js';\n\nexport const getOrderTracking = asyncHandler(async (req, res) => {\n  const { id } = req.params;\n  return successResponse(res, {\n    statusCode: 200,\n    message: 'Tracking info retrieved successfully',\n    data: { orderId: id, status: 'IN_TRANSIT', location: {}, estimatedTime: '15 mins', deliveryPartner: {} }\n  });\n});\n",
    'routeCode': "import express from 'express';\nimport { getOrderTracking } from '../../controllers/orders/orderTrackingController.js';\nimport { protectCustomer } from '../../middleware/authMiddleware.js';\n\nconst router = express.Router();\n\nrouter.get('/:id', protectCustomer, getOrderTracking);\n\nexport default router;\n"
  },
  {
    'name': 'starterPack',
    'controllerPath': 'offers/starterPackController.js',
    'routePath': 'offers/starterPackRoutes.js',
    'controllerCode': "import { successResponse } from '../../common/apiResponse.js';\nimport { asyncHandler } from '../../common/asyncHandler.js';\n\nexport const getStarterPack = asyncHandler(async (req, res) => {\n  return successResponse(res, {\n    statusCode: 200,\n    message: 'Starter pack retrieved successfully',\n    data: { offers: [], totalDiscount: 0, validity: 30 }\n  });\n});\n",
    'routeCode': "import express from 'express';\nimport { getStarterPack } from '../../controllers/offers/starterPackController.js';\nimport { protectCustomer } from '../../middleware/authMiddleware.js';\n\nconst router = express.Router();\n\nrouter.get('/', protectCustomer, getStarterPack);\n\nexport default router;\n"
  },
  {
    'name': 'wallet',
    'controllerPath': 'wallet/walletController.js',
    'routePath': 'wallet/walletRoutes.js',
    'controllerCode': "import { successResponse } from '../../common/apiResponse.js';\nimport { asyncHandler } from '../../common/asyncHandler.js';\n\nexport const getWallet = asyncHandler(async (req, res) => {\n  const { page = 1, limit = 20 } = req.query;\n  return successResponse(res, {\n    statusCode: 200,\n    message: 'Wallet retrieved successfully',\n    data: { balance: 0, transactions: [], pagination: { total: 0, page: parseInt(page), limit: parseInt(limit), totalPages: 0 } }\n  });\n});\n\nexport const addMoney = asyncHandler(async (req, res) => {\n  const { amount, paymentMethod } = req.body;\n  return successResponse(res, {\n    statusCode: 200,\n    message: 'Money added successfully',\n    data: { transactionId: 'TXN123', newBalance: amount }\n  });\n});\n",
    'routeCode': "import express from 'express';\nimport { getWallet, addMoney } from '../../controllers/wallet/walletController.js';\nimport { protectCustomer } from '../../middleware/authMiddleware.js';\n\nconst router = express.Router();\n\nrouter.use(protectCustomer);\nrouter.get('/', getWallet);\nrouter.post('/add-money', addMoney);\n\nexport default router;\n"
  },
  {
    'name': 'referral',
    'controllerPath': 'referrals/referralController.js',
    'routePath': 'referrals/referralRoutes.js',
    'controllerCode': "import { successResponse } from '../../common/apiResponse.js';\nimport { asyncHandler } from '../../common/asyncHandler.js';\n\nexport const getReferral = asyncHandler(async (req, res) => {\n  return successResponse(res, {\n    statusCode: 200,\n    message: 'Referral info retrieved successfully',\n    data: { referralCode: 'REF123', referralLink: '', earnedAmount: 0, referralCount: 0, rewards: [] }\n  });\n});\n",
    'routeCode': "import express from 'express';\nimport { getReferral } from '../../controllers/referrals/referralController.js';\nimport { protectCustomer } from '../../middleware/authMiddleware.js';\n\nconst router = express.Router();\n\nrouter.get('/', protectCustomer, getReferral);\n\nexport default router;\n"
  },
  {
    'name': 'faqs',
    'controllerPath': 'faqs/faqController.js',
    'routePath': 'faqs/faqRoutes.js',
    'controllerCode': "import { successResponse } from '../../common/apiResponse.js';\nimport { asyncHandler } from '../../common/asyncHandler.js';\n\nexport const getFaqs = asyncHandler(async (req, res) => {\n  return successResponse(res, {\n    statusCode: 200,\n    message: 'FAQs retrieved successfully',\n    data: []\n  });\n});\n",
    'routeCode': "import express from 'express';\nimport { getFaqs } from '../../controllers/faqs/faqController.js';\n\nconst router = express.Router();\n\nrouter.get('/', getFaqs);\n\nexport default router;\n"
  },
  {
    'name': 'policies',
    'controllerPath': 'policies/policyController.js',
    'routePath': 'policies/policyRoutes.js',
    'controllerCode': "import { successResponse } from '../../common/apiResponse.js';\nimport { asyncHandler } from '../../common/asyncHandler.js';\n\nexport const getPrivacyPolicy = asyncHandler(async (req, res) => {\n  return successResponse(res, {\n    statusCode: 200,\n    message: 'Privacy policy retrieved successfully',\n    data: { title: 'Privacy Policy', content: '', lastUpdated: new Date() }\n  });\n});\n\nexport const getTermsAndConditions = asyncHandler(async (req, res) => {\n  return successResponse(res, {\n    statusCode: 200,\n    message: 'Terms and Conditions retrieved successfully',\n    data: { title: 'Terms and Conditions', content: '', lastUpdated: new Date() }\n  });\n});\n",
    'routeCode': "import express from 'express';\nimport { getPrivacyPolicy, getTermsAndConditions } from '../../controllers/policies/policyController.js';\n\nconst router = express.Router();\n\nrouter.get('/customer/privacy_policy', getPrivacyPolicy);\nrouter.get('/customer/terms_and_conditions', getTermsAndConditions);\n\nexport default router;\n"
  },
  {
    'name': 'aiChat',
    'controllerPath': 'ai-chat/aiChatController.js',
    'routePath': 'ai-chat/aiChatRoutes.js',
    'controllerCode': "import { successResponse } from '../../common/apiResponse.js';\nimport { asyncHandler } from '../../common/asyncHandler.js';\n\nexport const sendChatMessage = asyncHandler(async (req, res) => {\n  return successResponse(res, {\n    statusCode: 200,\n    message: 'Message sent successfully',\n    data: { response: 'Hello, how can I help?', conversationId: 'conv123' }\n  });\n});\n\nexport const getChatHistory = asyncHandler(async (req, res) => {\n  const { page = 1, limit = 20 } = req.query;\n  return successResponse(res, {\n    statusCode: 200,\n    message: 'Chat history retrieved successfully',\n    data: [],\n    pagination: { total: 0, page: parseInt(page), limit: parseInt(limit), totalPages: 0 }\n  });\n});\n",
    'routeCode': "import express from 'express';\nimport { sendChatMessage, getChatHistory } from '../../controllers/ai-chat/aiChatController.js';\nimport { protectCustomer } from '../../middleware/authMiddleware.js';\n\nconst router = express.Router();\n\nrouter.use(protectCustomer);\nrouter.post('/', sendChatMessage);\nrouter.get('/history', getChatHistory);\n\nexport default router;\n"
  },
  {
    'name': 'services',
    'controllerPath': 'services/serviceController.js',
    'routePath': 'services/serviceRoutes.js',
    'controllerCode': "import { successResponse } from '../../common/apiResponse.js';\nimport { asyncHandler } from '../../common/asyncHandler.js';\n\nexport const getServices = asyncHandler(async (req, res) => {\n  const { page = 1, limit = 20 } = req.query;\n  return successResponse(res, {\n    statusCode: 200,\n    message: 'Services retrieved successfully',\n    data: [],\n    pagination: { total: 0, page: parseInt(page), limit: parseInt(limit), totalPages: 0 }\n  });\n});\n\nexport const getFeaturedServices = asyncHandler(async (req, res) => {\n  return successResponse(res, {\n    statusCode: 200,\n    message: 'Featured services retrieved successfully',\n    data: []\n  });\n});\n\nexport const getServiceDetails = asyncHandler(async (req, res) => {\n  return successResponse(res, {\n    statusCode: 200,\n    message: 'Service details retrieved successfully',\n    data: { service: {}, packages: [], reviews: [], rating: 0 }\n  });\n});\n\nexport const getServicePackages = asyncHandler(async (req, res) => {\n  const { page = 1, limit = 20 } = req.query;\n  return successResponse(res, {\n    statusCode: 200,\n    message: 'Service packages retrieved successfully',\n    data: [],\n    pagination: { total: 0, page: parseInt(page), limit: parseInt(limit), totalPages: 0 }\n  });\n});\n",
    'routeCode': "import express from 'express';\nimport { getServices, getFeaturedServices, getServiceDetails, getServicePackages } from '../../controllers/services/serviceController.js';\n\nconst router = express.Router();\n\nrouter.get('/', getServices);\nrouter.get('/customer/services/featured', getFeaturedServices);\nrouter.get('/services/details/:id', getServiceDetails);\nrouter.get('/packages/service/:id', getServicePackages);\n\nexport default router;\n"
  },
  {
    'name': 'bookings',
    'controllerPath': 'bookings/bookingController.js',
    'routePath': 'bookings/bookingRoutes.js',
    'controllerCode': "import { successResponse } from '../../common/apiResponse.js';\nimport { asyncHandler } from '../../common/asyncHandler.js';\n\nexport const getMyBookings = asyncHandler(async (req, res) => {\n  const { page = 1, limit = 20 } = req.query;\n  return successResponse(res, {\n    statusCode: 200,\n    message: 'Bookings retrieved successfully',\n    data: [],\n    pagination: { total: 0, page: parseInt(page), limit: parseInt(limit), totalPages: 0 }\n  });\n});\n",
    'routeCode': "import express from 'express';\nimport { getMyBookings } from '../../controllers/bookings/bookingController.js';\nimport { protectCustomer } from '../../middleware/authMiddleware.js';\n\nconst router = express.Router();\n\nrouter.get('/my-bookings', protectCustomer, getMyBookings);\n\nexport default router;\n"
  },
  {
    'name': 'translation',
    'controllerPath': 'translation/translationController.js',
    'routePath': 'translation/translationRoutes.js',
    'controllerCode': "import { successResponse } from '../../common/apiResponse.js';\nimport { asyncHandler } from '../../common/asyncHandler.js';\n\nexport const translateText = asyncHandler(async (req, res) => {\n  const { text, targetLanguage } = req.body;\n  return successResponse(res, {\n    statusCode: 200,\n    message: 'Translated successfully',\n    data: { original: text, translated: text, language: targetLanguage }\n  });\n});\n",
    'routeCode': "import express from 'express';\nimport { translateText } from '../../controllers/translation/translationController.js';\n\nconst router = express.Router();\n\nrouter.post('/translate', translateText);\n\nexport default router;\n"
  }
]

for api in apis:
  c_path = os.path.join(controllers_dir, api['controllerPath'])
  r_path = os.path.join(routes_dir, api['routePath'])
  
  os.makedirs(os.path.dirname(c_path), exist_ok=True)
  os.makedirs(os.path.dirname(r_path), exist_ok=True)
  
  with open(c_path, 'w', encoding='utf-8') as f:
    f.write(api['controllerCode'])
    
  with open(r_path, 'w', encoding='utf-8') as f:
    f.write(api['routeCode'])
    
  print(f"Created {api['name']}")
