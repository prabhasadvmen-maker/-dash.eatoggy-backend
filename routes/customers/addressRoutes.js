import express from 'express';
import { protectCustomer } from '../../middleware/authMiddleware.js';
import {
  getAddresses,
  addAddress,
  deleteAddress,
  updateAddress
} from '../../controllers/customers/addressController.js';

const router = express.Router();

router.use(protectCustomer);

router.route('/')
  .get(getAddresses)
  .post(addAddress);

router.route('/:id')
  .delete(deleteAddress)
  .patch(updateAddress);

export default router;
