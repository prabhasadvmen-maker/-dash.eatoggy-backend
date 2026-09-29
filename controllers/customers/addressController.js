import * as checkoutService from '../../services/cart/checkoutService.js';

const getCustomerId = (req) => {
  return req.customer?.id || req.customer?._id || req.user?.id || req.user?._id;
};

/**
 * @desc    Get customer addresses
 * @route   GET /api/customers/addresses
 * @access  Private (Customer)
 */
export const getAddresses = async (req, res, next) => {
  try {
    const customerId = getCustomerId(req);
    if (!customerId) {
      return res.status(401).json({ success: false, message: 'Unauthorized customer access' });
    }

    const addresses = await checkoutService.getAddresses(customerId);
    res.status(200).json({
      success: true,
      message: 'Addresses fetched successfully',
      data: addresses
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Add new customer delivery address
 * @route   POST /api/customers/addresses
 * @access  Private (Customer)
 */
export const addAddress = async (req, res, next) => {
  try {
    const customerId = getCustomerId(req);
    if (!customerId) {
      return res.status(401).json({ success: false, message: 'Unauthorized customer access' });
    }

    const { name, mobile, addressLine1, city, state, pincode } = req.body;
    if (!name || !mobile || !addressLine1 || !city || !pincode) {
      return res.status(400).json({
        success: false,
        message: 'Name, mobile, addressLine1, city, and pincode are required'
      });
    }

    const address = await checkoutService.createAddress(customerId, req.body);
    res.status(201).json({
      success: true,
      message: 'Address added successfully',
      data: address
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    next(err);
  }
};

/**
 * @desc    Delete customer delivery address
 * @route   DELETE /api/customers/addresses/:id
 * @access  Private (Customer)
 */
export const deleteAddress = async (req, res, next) => {
  try {
    const customerId = getCustomerId(req);
    if (!customerId) {
      return res.status(401).json({ success: false, message: 'Unauthorized customer access' });
    }

    const { id } = req.params;
    const result = await checkoutService.deleteAddress(customerId, id);
    res.status(200).json({
      success: true,
      message: result.message
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    next(err);
  }
};

/**
 * @desc    Update customer delivery address
 * @route   PATCH /api/customers/addresses/:id
 * @access  Private (Customer)
 */
export const updateAddress = async (req, res, next) => {
  try {
    const customerId = getCustomerId(req);
    if (!customerId) {
      return res.status(401).json({ success: false, message: 'Unauthorized customer access' });
    }

    const { id } = req.params;
    
    const Address = (await import('../../models/customers/Address.js')).default;
    
    const address = await Address.findOne({ _id: id, customerId });
    if (!address) {
      return res.status(404).json({ success: false, message: 'Address not found' });
    }

    const { isDefault, addressLine1, landmark, name, mobile, city, pincode, state } = req.body;

    if (isDefault) {
      await Address.updateMany({ customerId }, { isDefault: false });
      address.isDefault = true;
    } else if (isDefault === false) {
      address.isDefault = false;
    }

    if (addressLine1) address.addressLine1 = addressLine1;
    if (landmark) address.landmark = landmark;
    if (name) address.name = name;
    if (mobile) address.mobile = mobile;
    if (city) address.city = city;
    if (pincode) address.pincode = pincode;
    if (state) address.state = state;

    await address.save();

    res.status(200).json({
      success: true,
      message: 'Address updated successfully',
      data: address
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    next(err);
  }
};
