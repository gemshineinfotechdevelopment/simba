import { Router } from 'express';
import {
  getAccountDetails,
  addCredit,
  deleteAccountEntry,
  getCreditOptions,
  createCreditOption,
  updateCreditOption,
  deleteCreditOption,
} from '../controllers/accountController';

const router = Router();

router.route('/').get(getAccountDetails);
router.route('/credit').post(addCredit);
router.route('/options').get(getCreditOptions).post(createCreditOption);
router.route('/options/:id').put(updateCreditOption).delete(deleteCreditOption);
router.route('/:id').delete(deleteAccountEntry);

export default router;
