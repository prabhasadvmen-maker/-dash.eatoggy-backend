import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import logger from '../../config/logger.js';
import Admin from '../../models/admin/Admin.js';
import TiffinPlan from '../../models/subscriptions/TiffinPlan.js';
import Restaurant from '../../models/restaurants/Restaurant.js';
import Order from '../../models/orders/Order.js';
import DeliveryPartner from '../../models/delivery/DeliveryPartner.js';
import Payment from '../../models/payments/Payment.js';
import { protectAdmin } from '../../middleware/authMiddleware.js';
import { getPresignedDocumentUrls } from '../../integrations/storage/r2UploadService.js';
import { upload } from '../../services/r2UploadService.js';
import {
  createBanner,
  getBanners,
  getBannerById,
  updateBanner,
  deleteBanner,
  toggleBannerStatus
} from '../../controllers/super-admin/superAdminBannerController.js';
import { 
  getAllCustomers, 
  getCustomerById, 
  toggleCustomerStatus 
} from '../../controllers/super-admin/superAdminCustomerController.js';
import {
  getAdminTickets,
  getSingleTicket,
  postTicketMessage,
  patchTicketStatus,
  patchTicketPriority,
  patchTicketAssignment
} from '../../controllers/support/supportTicketController.js';
import { getPlatformAnalyticsReport } from '../../controllers/super-admin/superAdminReportController.js';

const router = express.Router();

// All admin routes require admin authentication
router.use(protectAdmin);

// ==========================================
// Customer / User Management Routes
// ==========================================
router.get('/customers', getAllCustomers);
router.get('/customers/:id', getCustomerById);
router.patch('/customers/:id/status', toggleCustomerStatus);

// ==========================================
// Admin Management Routes
// ==========================================
// @route   GET /api/admins
// @desc    Get all admins
router.get('/', async (req, res) => {
  try {
    const admins = await Admin.find({}).select('-password').sort({ createdAt: -1 });
    res.json(admins);
  } catch (err) {
    logger.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   POST /api/admins
// @desc    Create a new admin
router.post('/', async (req, res) => {
  const { name, email, password, role } = req.body;

  try {
    let admin = await Admin.findOne({ email });

    if (admin) {
      return res.status(400).json({ message: 'Admin already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    admin = new Admin({
      name,
      email,
      password: hashedPassword,
      role
    });

    await admin.save();
    
    // Return admin without password
    const adminObj = admin.toObject();
    delete adminObj.password;
    
    res.json(adminObj);
  } catch (err) {
    logger.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   DELETE /api/admins/:id
// @desc    Delete an admin
router.delete('/:id', async (req, res) => {
  try {
    const admin = await Admin.findById(req.params.id);

    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    // Prevent deleting yourself
    if (admin._id.toString() === req.admin.id) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }

    await Admin.findByIdAndDelete(req.params.id);
    res.json({ message: 'Admin removed' });
  } catch (err) {
    logger.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Admin not found' });
    }
    res.status(500).send('Server error');
  }
});

// @route   PUT /api/admins/:id
// @desc    Update an admin
router.put('/:id', async (req, res) => {
  const { name, email, role, password } = req.body;

  try {
    let admin = await Admin.findById(req.params.id);

    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    // Check if email is being updated to an existing one
    if (email && email !== admin.email) {
      let emailExists = await Admin.findOne({ email });
      if (emailExists) {
        return res.status(400).json({ message: 'Email already exists' });
      }
    }

    if (name) admin.name = name;
    if (email) admin.email = email;
    if (role) admin.role = role;
    
    // Hash new password if provided
    if (password) {
      const salt = await bcrypt.genSalt(10);
      admin.password = await bcrypt.hash(password, salt);
    }

    await admin.save();
    
    // Return updated admin without password
    const adminObj = admin.toObject();
    delete adminObj.password;
    
    res.json(adminObj);
  } catch (err) {
    logger.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   PUT /api/admins/:id/toggle-status
// @desc    Toggle admin active status
router.put('/:id/toggle-status', async (req, res) => {
  try {
    const admin = await Admin.findById(req.params.id);

    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    if (admin._id.toString() === req.admin.id) {
      return res.status(400).json({ message: 'Cannot deactivate your own account' });
    }

    admin.isActive = !admin.isActive;
    await admin.save();
    
    // Return the updated user without password
    const adminObj = admin.toObject();
    delete adminObj.password;

    res.json(adminObj);
  } catch (err) {
    logger.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Admin not found' });
    }
    res.status(500).send('Server error');
  }
});

// @route   GET /api/admins/restaurants
// @desc    Get all restaurants (for SuperAdmin review)
router.get('/restaurants', async (req, res) => {
  try {
    const restaurants = await Restaurant.find({}).sort({ createdAt: -1 });
    const formattedRestaurants = await Promise.all(
      restaurants.map(async (r) => {
        const rObj = r.toObject();
        if (rObj.documents) {
          rObj.documents = await getPresignedDocumentUrls(rObj.documents);
        }
        
        // Mask Bank Account Number
        if (rObj.bankDetails && rObj.bankDetails.accountNumber) {
          const accNum = rObj.bankDetails.accountNumber;
          rObj.bankDetails.accountNumber = accNum.length > 4 ? `••••••••${accNum.slice(-4)}` : accNum;
        }

        // Attach Payment info
        const payment = await Payment.findOne({
          restaurant: r._id,
          purpose: 'RESTAURANT_PARTNER_ONBOARDING'
        }).sort({ createdAt: -1 });

        if (payment) {
          rObj.paymentData = {
            amount: payment.amount,
            currency: payment.currency,
            status: payment.status,
            purpose: payment.purpose,
            razorpayOrderId: payment.razorpayOrderId,
            razorpayPaymentId: payment.razorpayPaymentId,
            timestamp: payment.createdAt
          };
        }

        return rObj;
      })
    );
    res.json(formattedRestaurants);
  } catch (err) {
    logger.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   PUT /api/admins/restaurants/:id/approve
// @desc    Approve a restaurant application
router.put('/restaurants/:id/approve', async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id);
    if (!restaurant) return res.status(404).json({ message: 'Restaurant not found' });
    
    restaurant.status = 'APPROVED';
    restaurant.onboardingStatus = 'APPROVED';
    restaurant.currentStep = 'APPROVED';
    restaurant.rejectionReason = '';
    await restaurant.save();
    
    res.json({ message: 'Restaurant approved successfully', restaurant });
  } catch (err) {
    logger.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   PUT /api/admins/restaurants/:id/reject
// @desc    Reject a restaurant application
router.put('/restaurants/:id/reject', async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ message: 'Rejection reason is required' });

    const restaurant = await Restaurant.findById(req.params.id);
    if (!restaurant) return res.status(404).json({ message: 'Restaurant not found' });
    
    restaurant.status = 'REJECTED';
    restaurant.onboardingStatus = 'REJECTED';
    restaurant.currentStep = 'REJECTED';
    restaurant.rejectionReason = reason;
    await restaurant.save();
    
    res.json({ message: 'Restaurant rejected', restaurant });
  } catch (err) {
    logger.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   DELETE /api/admins/restaurants/:id
// @desc    Delete a restaurant
router.delete('/restaurants/:id', async (req, res) => {
  try {
    const restaurant = await Restaurant.findByIdAndDelete(req.params.id);
    if (!restaurant) return res.status(404).json({ message: 'Restaurant not found' });
    res.json({ message: 'Restaurant deleted successfully' });
  } catch (err) {
    logger.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   PUT /api/admins/restaurants/:id/toggle-status
// @desc    Toggle Enable/Disable (APPROVED / SUSPENDED) for a restaurant
router.put('/restaurants/:id/toggle-status', async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id);
    if (!restaurant) return res.status(404).json({ message: 'Restaurant not found' });
    
    if (restaurant.status === 'APPROVED') {
      restaurant.status = 'SUSPENDED';
      restaurant.suspensionReason = 'Disabled by Administrator';
    } else {
      restaurant.status = 'APPROVED';
      restaurant.suspensionReason = '';
    }
    
    await restaurant.save();
    res.json({ message: `Restaurant ${restaurant.status === 'APPROVED' ? 'Enabled' : 'Disabled'} successfully`, restaurant });
  } catch (err) {
    logger.error(err.message);
    res.status(500).send('Server error');
  }
});

// ==========================================
// Admin Services (Partner Services) Routes
// ==========================================

// @route   GET /api/admins/services
// @desc    Get all services/plans offered by partners
router.get('/services', async (req, res) => {
  try {
    const services = await TiffinPlan.find({})
      .populate('restaurantId', 'restaurantName ownerName mobile city status isPhoneVerified')
      .sort({ createdAt: -1 });
    res.json(services);
  } catch (err) {
    logger.error(err.message);
    res.status(500).send('Server error');
  }
});

// ==========================================
// Admin Bookings (Orders) Routes
// ==========================================

// @route   GET /api/admins/bookings
// @desc    Get all bookings/orders
router.get('/bookings', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const orders = await Order.find({})
      .populate('customerId', 'name mobile')
      .populate('restaurantId', 'restaurantName city')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Order.countDocuments({});

    res.json({
      data: orders,
      meta: {
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (err) {
    logger.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   GET /api/admins/bookings/:id
// @desc    Get a specific booking/order details
router.get('/bookings/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('customerId', 'name mobile email')
      .populate('restaurantId', 'restaurantName city mobile fullAddress');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json({ data: order });
  } catch (err) {
    logger.error(err.message);
    res.status(500).send('Server error');
  }
});

// ==========================================
// Admin Live Tracking Routes
// ==========================================

// @route   GET /api/admins/live-tracking
// @desc    Get data for live tracking (delivery agents & geoapify key)
router.get('/live-tracking', async (req, res) => {
  try {
    const agents = await DeliveryPartner.find({ isActive: true }).select('fullName mobile vehicleType currentLocation isOnline');
    
    res.json({
      geoapifyKey: process.env.GEOAPIFY_API_KEY || '',
      agents: agents
    });
  } catch (err) {
    logger.error(err.message);
    res.status(500).send('Server error');
  }
});

// ==========================================
// Admin Finance Routes
// ==========================================

// @route   GET /api/admins/finance
// @desc    Get all payments/finance data
router.get('/finance', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const payments = await Payment.find({})
      .populate('customer', 'name mobile')
      .populate('restaurant', 'restaurantName mobile')
      .populate('deliveryPartner', 'fullName mobile')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Payment.countDocuments({});
    
    // Aggregations for dashboard stats
    const stats = await Payment.aggregate([
      { $match: { status: 'PAID' } },
      { 
        $group: {
          _id: null,
          totalRevenue: { $sum: '$amount' }
        }
      }
    ]);

    res.json({
      data: payments,
      stats: stats[0] || { totalRevenue: 0 },
      meta: {
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (err) {
    logger.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   POST /api/admins/payments/:id/refund
// @desc    Process a refund
router.post('/payments/:id/refund', async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }
    
    if (payment.status === 'REFUNDED') {
      return res.status(400).json({ message: 'Payment is already refunded' });
    }

    // Update status to REFUNDED
    payment.status = 'REFUNDED';
    await payment.save();
    
    res.json({ message: 'Refund processed successfully', data: payment });
  } catch (err) {
    logger.error(err.message);
    res.status(500).send('Server error');
  }
});

// ==========================================
// Admin Marketing / Banners Routes
// ==========================================
router.post('/banners', upload.single('image'), createBanner);
router.get('/banners', getBanners);
router.get('/banners/:id', getBannerById);
router.put('/banners/:id', upload.single('image'), updateBanner);
router.delete('/banners/:id', deleteBanner);
router.patch('/banners/:id/status', toggleBannerStatus);

// ==========================================
// Admin Support Routes
// ==========================================
router.get('/support/tickets', getAdminTickets);
router.get('/support/tickets/:id', getSingleTicket);
router.post('/support/tickets/:id/messages', postTicketMessage);
router.patch('/support/tickets/:id/status', patchTicketStatus);
router.patch('/support/tickets/:id/priority', patchTicketPriority);
router.patch('/support/tickets/:id/assign', patchTicketAssignment);

// ==========================================
// Admin Analytics Routes
// ==========================================
router.get('/analytics', getPlatformAnalyticsReport);

export default router;
