// backend/routes/pushRoutes.js
import express from 'express';
import {
  subscribeToPush,
  unsubscribeFromPush,
  broadcastNotification,
  sendUserNotification
} from '../controllers/pushController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public route - no auth required for subscription (can be anonymous)
router.post('/subscribe', subscribeToPush);
router.post('/unsubscribe', unsubscribeFromPush);

// Protected routes - require authentication
router.post('/broadcast', authMiddleware, broadcastNotification);
router.post('/send-user', authMiddleware, sendUserNotification);

export default router;