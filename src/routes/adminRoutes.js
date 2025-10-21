import express from "express";
import { authMiddleware, adminOnly } from "../middleware/authMiddleware.js";
import {
    getDashboardStats,
    getAllUsers,
    getUserById,
    updateUser,
    deleteUser,
    getVerificationRequests,
    reviewVerificationRequest,
    getAllComplaints,
    updateComplaint,
} from "../controllers/adminController.js";
import { 
    getAllProperties, 
    updateProperty,
    deleteProperty
} from "../controllers/propertyController.js";

const router = express.Router();

// Apply auth and admin-only middleware to all routes in this file
router.use(authMiddleware);
router.use(adminOnly);

// --- Dashboard ---
router.get("/dashboard", getDashboardStats);

// --- User Management ---
router.get("/users", getAllUsers);
router.get("/users/:id", getUserById);
router.put("/users/:id", updateUser);
router.delete("/users/:id", deleteUser);

// --- Verification Management ---
router.get("/verifications", getVerificationRequests);
router.put("/verifications/:id/review", reviewVerificationRequest);

// --- Property Management (for Admins) ---
// These routes reuse existing property controllers which already handle the ADMIN role
router.get("/properties", getAllProperties);
router.put("/properties/:id", updateProperty);
router.delete("/properties/:id", deleteProperty);

// --- Complaint Management ---
router.get("/complaints", getAllComplaints);
router.put("/complaints/:id", updateComplaint);


export default router;