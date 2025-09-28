import express from "express";
import {
    register,
    login,
    logout,
    getProfile,
    updateProfile,
    changePassword,
    getUserProperties
} from "../controllers/userController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

// Public routes
router.post("/register", register);
router.post("/login", login);

// Protected routes
router.post("/logout", authMiddleware, logout);
router.get("/profile", authMiddleware, getProfile);
router.put("/profile", authMiddleware, updateProfile);
router.put("/change-password", authMiddleware, changePassword);
router.get("/properties", authMiddleware, getUserProperties);

export default router;