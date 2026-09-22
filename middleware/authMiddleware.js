import jwt from 'jsonwebtoken';

export const protect = (req, res, next) => {
  // Get token from header
  const token = req.header('Authorization')?.split(' ')[1];

  // Check if no token
  if (!token) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  // Verify token
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) return res.status(500).json({ message: 'Server configuration error' });
    const decoded = jwt.verify(token, secret);

    if (decoded.admin) {
      req.admin = decoded.admin;
    }
    if (decoded.restaurant) {
      req.restaurant = decoded.restaurant;
    }
    if (decoded.user) {
      req.user = decoded.user;
      if (decoded.user.role === 'Customer') {
        req.customer = decoded.user;
      }
    }
    if (decoded.customer) {
      req.customer = decoded.customer;
      req.user = decoded.customer;
    }

    if (decoded.deliveryPartner) {
      req.deliveryPartner = decoded.deliveryPartner;
      req.user = decoded.deliveryPartner;
    }
    if (decoded.user && decoded.user.role === 'DeliveryPartner') {
      req.deliveryPartner = decoded.user;
    }

    next();
  } catch (err) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

export const protectAdmin = (req, res, next) => {
  protect(req, res, () => {
    if (!req.admin) {
      return res.status(403).json({ message: 'Admin access denied' });
    }
    next();
  });
};

export const protectSuperAdmin = (req, res, next) => {
  protect(req, res, () => {
    if (!req.admin || req.admin.role !== 'SuperAdmin') {
      return res.status(403).json({ message: 'SuperAdmin access denied' });
    }
    next();
  });
};

export const protectCustomer = (req, res, next) => {
  protect(req, res, () => {
    if (!req.customer || req.customer.role !== 'Customer') {
      return res.status(403).json({ message: 'Customer access denied' });
    }
    next();
  });
};

export const protectDeliveryPartner = (req, res, next) => {
  protect(req, res, () => {
    const partner = req.deliveryPartner || req.user;
    if (!partner || partner.role !== 'DeliveryPartner') {
      return res.status(403).json({ message: 'Delivery Partner access denied' });
    }
    next();
  });
};

export const protectRestaurant = (req, res, next) => {
  protect(req, res, () => {
    const restaurant = req.restaurant || req.user;
    if (!restaurant || (restaurant.role && restaurant.role !== 'Restaurant')) {
      return res.status(403).json({ message: 'Restaurant access denied' });
    }
    next();
  });
};

