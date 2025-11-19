import express from "express";
import {
    createComplaint,
    getUserComplaints,
    getComplaintById,
    updateComplaint,
    deleteComplaint,
    getPropertyComplaints
} from "../controllers/complaintController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

// All complaint routes require authentication
router.use(authMiddleware);

// Client routes
router.post("/", createComplaint);
router.get("/user", getUserComplaints);
router.get("/user/:id", getComplaintById);
router.put("/user/:id", updateComplaint);
router.delete("/user/:id", deleteComplaint);

// Property-specific complaints
router.get("/property/:propertyId", getPropertyComplaints);

export default router;