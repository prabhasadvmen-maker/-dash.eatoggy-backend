import express from 'express';
import { getCollections } from '../../controllers/collections/collectionController.js';

const router = express.Router();

router.get('/', getCollections);

export default router;
