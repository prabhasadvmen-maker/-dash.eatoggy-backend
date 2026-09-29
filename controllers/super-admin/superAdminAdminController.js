import Admin from '../../models/admin/Admin.js';
import bcrypt from 'bcryptjs';
import { successResponse, errorResponse } from '../../common/apiResponse.js';
import { asyncHandler } from '../../common/asyncHandler.js';

export const getAllAdmins = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, search, role, isActive, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

  const query = {};
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
  }
  if (role) query.role = role;
  if (isActive !== undefined) query.isActive = isActive === 'true';

  const sortObj = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

  const [admins, total] = await Promise.all([
    Admin.find(query).select('-password').sort(sortObj).skip((page - 1) * limit).limit(Number(limit)),
    Admin.countDocuments(query)
  ]);

  return successResponse(res, {
    message: 'Admins retrieved successfully',
    data: admins,
    meta: {
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit)
      }
    }
  });
});

export const createAdmin = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password || !role) {
    return errorResponse(res, { statusCode: 400, message: 'Name, email, password, and role are required' });
  }

  if (role === 'SuperAdmin') {
    return errorResponse(res, { statusCode: 400, message: 'Cannot create a SuperAdmin role directly' });
  }

  if (!['Admin', 'Manager', 'Support'].includes(role)) {
    return errorResponse(res, { statusCode: 400, message: 'Invalid role' });
  }

  const existingAdmin = await Admin.findOne({ email });
  if (existingAdmin) {
    return errorResponse(res, { statusCode: 400, message: 'Email already in use' });
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const admin = await Admin.create({
    name,
    email,
    password: hashedPassword,
    role
  });

  const adminData = admin.toObject();
  delete adminData.password;

  return successResponse(res, {
    message: 'Admin created successfully',
    data: { admin: adminData }
  });
});

export const updateAdmin = asyncHandler(async (req, res) => {
  const { name, role, isActive } = req.body;
  const admin = await Admin.findById(req.params.id);

  if (!admin) {
    return errorResponse(res, { statusCode: 404, message: 'Admin not found' });
  }

  if (name) admin.name = name;
  if (role && role !== 'SuperAdmin' && ['Admin', 'Manager', 'Support'].includes(role)) admin.role = role;
  if (isActive !== undefined) admin.isActive = isActive;

  await admin.save();
  const adminData = admin.toObject();
  delete adminData.password;

  return successResponse(res, {
    message: 'Admin updated successfully',
    data: { admin: adminData }
  });
});

export const resetAdminPassword = asyncHandler(async (req, res) => {
  const { password } = req.body;

  if (!password) {
    return errorResponse(res, { statusCode: 400, message: 'New password is required' });
  }

  const admin = await Admin.findById(req.params.id);
  if (!admin) {
    return errorResponse(res, { statusCode: 404, message: 'Admin not found' });
  }

  const salt = await bcrypt.genSalt(10);
  admin.password = await bcrypt.hash(password, salt);
  await admin.save();

  return successResponse(res, {
    message: 'Admin password reset successfully',
    data: {}
  });
});

export const deleteAdmin = asyncHandler(async (req, res) => {
  const admin = await Admin.findById(req.params.id);
  if (!admin) {
    return errorResponse(res, { statusCode: 404, message: 'Admin not found' });
  }

  if (admin.role === 'SuperAdmin') {
    return errorResponse(res, { statusCode: 403, message: 'Cannot delete a SuperAdmin' });
  }

  await Admin.findByIdAndDelete(req.params.id);

  return successResponse(res, {
    message: 'Admin deleted successfully',
    data: {}
  });
});
