import express from 'express';
import { protectRestaurant } from '../../middleware/authMiddleware.js';
import { upload } from '../../integrations/storage/r2UploadService.js';
import {
  createMenuItem,
  getMenuItems,
  getMenuItemById,
  updateMenuItem,
  submitForVerification,
  toggleAvailability,
  deleteDraft,
  createCategory,
  getCategoryItems,
} from '../../controllers/restaurants/restaurantMenuController.js';
import { getCategories, getSubcategories } from '../../controllers/super-admin/superAdminCategoryController.js';

const router = express.Router();

// Middleware: Verify that the authenticated user is an approved restaurant
const checkRestaurantApproved = (req, res, next) => {
  next();
};

// Protect all routes with Restaurant JWT
router.use(protectRestaurant);

// Image upload config for single file named 'image'
const imageUpload = upload.single('image');

router.get('/items/categories/:categoryId/items', getCategoryItems);
router.post('/items', imageUpload, createMenuItem);
router.put('/items/:id', imageUpload, updateMenuItem);
router.patch('/items/:id/toggle-stock', toggleAvailability);
router.delete('/items/:id', deleteDraft);


router.post('/', imageUpload, createMenuItem);
router.get('/', getMenuItems);
router.post('/categories', createCategory);
router.get('/categories', getCategories);
router.get('/subcategories', getSubcategories);
router.get('/:id', getMenuItemById);
router.put('/:id', imageUpload, updateMenuItem);
router.patch('/:id/submit', submitForVerification);
router.patch('/:id/availability', toggleAvailability);
router.delete('/:id', deleteDraft);

export default router;
