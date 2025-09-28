import express from "express";
import {
    getAllProperties,
    createProperty,
    getPropertyById,
    updateProperty,
    deleteProperty,
    getSimilarProperties
} from "../controllers/propertyController.js";
import { authMiddleware, optionalAuthMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

// Public routes
router.get("/", getAllProperties);
router.get("/:id", optionalAuthMiddleware, getPropertyById);
router.get("/:id/similar", getSimilarProperties);

// Protected routes
router.post("/", authMiddleware, createProperty);
router.put("/:id", authMiddleware, updateProperty);
router.delete("/:id", authMiddleware, deleteProperty);

export default router;