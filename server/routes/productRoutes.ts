import { Router } from 'express';
import {
  getProducts,
  getProductById,
  createProduct,
  bulkCreateProducts,
  updateProduct,
  deleteProduct,
} from '../controllers/productController';

const router = Router();

router.post('/bulk', bulkCreateProducts);
router.route('/').get(getProducts).post(createProduct);
router.route('/:id').get(getProductById).put(updateProduct).delete(deleteProduct);

export default router;
