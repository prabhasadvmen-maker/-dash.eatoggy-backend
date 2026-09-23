import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Admin from '../../models/admin/Admin.js';

const router = express.Router();

// @route   POST /api/auth/login
// @desc    Authenticate admin & get token
// @access  Public
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Check for admin
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check if active
    if (admin.isActive === false) {
      return res.status(403).json({ message: 'Account is deactivated' });
    }

    // Validate password
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Update last login
    admin.lastLogin = new Date();
    await admin.save();

    // Create payload
    const payload = {
      admin: {
        id: admin.id,
        role: admin.role
      }
    };

    // Sign token
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET not set');
    jwt.sign(
      payload,
      secret,
      { expiresIn: '1d' },
      (err, token) => {
        if (err) throw err;
        res.json({ token, user: { email: admin.email, id: admin.id, role: admin.role || 'Admin', name: admin.name } });
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   POST /api/auth/impersonate/:adminId
// @desc    SuperAdmin login as another admin
// @access  SuperAdmin only
router.post('/impersonate/:adminId', async (req, res) => {
  const superadminToken = req.header('Authorization')?.split(' ')[1];
  if (!superadminToken) return res.status(401).json({ message: 'No token' });

  try {
    const secret = process.env.JWT_SECRET;
    const decoded = jwt.verify(superadminToken, secret);
    const superadmin = await Admin.findById(decoded.admin.id);

    if (!superadmin || superadmin.role !== 'SuperAdmin') {
      return res.status(403).json({ message: 'Only SuperAdmin can impersonate' });
    }

    const targetAdmin = await Admin.findById(req.params.adminId);
    if (!targetAdmin) return res.status(404).json({ message: 'Admin not found' });

    const token = jwt.sign({ admin: { id: targetAdmin.id, role: targetAdmin.role } }, secret, { expiresIn: '8h' });
    res.json({ token, user: { email: targetAdmin.email, id: targetAdmin.id, role: targetAdmin.role, name: targetAdmin.name } });
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
});

export default router;
