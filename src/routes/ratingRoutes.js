import express from "express";
import {
    addRating,
    getPropertyRatings,
    deleteRating,
    getUserRatings
} from "../controllers/ratingController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

// Public routes
router.get("/property/:propertyId", getPropertyRatings);

// Protected routes
router.post("/", authMiddleware, addRating);
router.delete("/:ratingId", authMiddleware, deleteRating);
router.get("/user", authMiddleware, getUserRatings);

export default router;