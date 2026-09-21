import Order from '../../models/orders/Order.js';

/**
 * @desc    Get all orders across platform with filters & search
 * @route   GET /api/super-admin/orders
 * @access  Private/SuperAdmin
 */
export const getAllOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;
    const { search, status, orderType } = req.query;

    const filter = {};

    if (status) filter.orderStatus = status;
    if (orderType) filter.orderType = orderType;

    if (search) {
      filter.$or = [
        { orderNumber: { $regex: search, $options: 'i' } }
      ];
    }

    const total = await Order.countDocuments(filter);
    const orders = await Order.find(filter)
      .populate('customerId', 'name mobile email')
      .populate('restaurantId', 'name mobile')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.json({
      success: true,
      data: orders,
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
 * @desc    Get single order detail by ID
 * @route   GET /api/super-admin/orders/:id
 * @access  Private/SuperAdmin
 */
export const getOrderDetails = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('customerId', 'name mobile email')
      .populate('restaurantId', 'name mobile address')
      .populate('paymentId')
      .lean();

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
