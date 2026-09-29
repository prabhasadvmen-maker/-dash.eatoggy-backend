import express from 'express';
import { getCategories } from '../../controllers/categories/categoryController.js';

const router = express.Router();

router.get('/', getCategories);

export default router;
