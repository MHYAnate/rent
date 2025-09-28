import express from "express";
import {
    addToFavorites,
    removeFromFavorites,
    getUserFavorites,
    checkFavoriteStatus
} from "../controllers/favoriteController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

// All routes require authentication
router.post("/", authMiddleware, addToFavorites);
router.delete("/:propertyId", authMiddleware, removeFromFavorites);
router.get("/", authMiddleware, getUserFavorites);
router.get("/status/:propertyId", authMiddleware, checkFavoriteStatus);

export default router;