import Customer from '../../models/customers/Customer.js';
import Order from '../../models/orders/Order.js';
import Subscription from '../../models/subscriptions/Subscription.js';

/**
 * @desc    Get all customers with search & pagination
 * @route   GET /api/super-admin/customers
 * @access  Private/SuperAdmin
 */
export const getAllCustomers = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;
    const { search, status } = req.query;

    const filter = {};

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { mobile: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    if (status) {
      if (status === 'ACTIVE') filter.isActive = true;
      if (status === 'SUSPENDED') filter.isActive = false;
    }

    const total = await Customer.countDocuments(filter);
    const customers = await Customer.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Attach order & subscription counts for each customer
    const customerIds = customers.map(c => c._id);
    
    const orderCounts = await Order.aggregate([
      { $match: { customerId: { $in: customerIds } } },
      { $group: { _id: '$customerId', count: { $sum: 1 }, totalSpent: { $sum: '$pricing.grandTotal' } } }
    ]);

    const subCounts = await Subscription.aggregate([
      { $match: { customerId: { $in: customerIds } } },
      { $group: { _id: '$customerId', count: { $sum: 1 } } }
    ]);

    const orderMap = {};
    orderCounts.forEach(o => { orderMap[o._id.toString()] = { count: o.count, totalSpent: o.totalSpent || 0 }; });

    const subMap = {};
    subCounts.forEach(s => { subMap[s._id.toString()] = s.count; });

    const enrichedCustomers = customers.map(c => {
      const idStr = c._id.toString();
      return {
        ...c,
        totalOrders: orderMap[idStr]?.count || 0,
        totalSpent: orderMap[idStr]?.totalSpent || 0,
        totalSubscriptions: subMap[idStr] || 0
      };
    });

    res.json({
      success: true,
      data: enrichedCustomers,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get customer detail by ID with orders and subscriptions
 * @route   GET /api/super-admin/customers/:id
 * @access  Private/SuperAdmin
 */
export const getCustomerById = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id).lean();
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const orders = await Order.find({ customerId: req.params.id })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('restaurantId', 'name mobile address')
      .lean();

    const subscriptions = await Subscription.find({ customerId: req.params.id })
      .sort({ createdAt: -1 })
      .populate('restaurantId', 'name mobile')
      .lean();

    res.json({
      success: true,
      data: {
        customer,
        orders,
        subscriptions
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Toggle customer active/suspended status
 * @route   PATCH /api/super-admin/customers/:id/status
 * @access  Private/SuperAdmin
 */
export const toggleCustomerStatus = async (req, res) => {
  try {
    const { isActive } = req.body;
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ success: false, message: 'isActive boolean is required' });
    }

    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    customer.isActive = isActive;
    await customer.save();

    res.json({
      success: true,
      message: `Customer ${isActive ? 'activated' : 'suspended'} successfully`,
      data: customer
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
