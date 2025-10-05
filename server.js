import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

// Import routes
import landingRoutes from "./src/routes/landingRoutes.js";
import propertyRoutes from "./src/routes/propertyRoutes.js";
import userRoutes from "./src/routes/userRoutes.js";
import favoriteRoutes from "./src/routes/favoriteRoutes.js";
import ratingRoutes from "./src/routes/ratingRoutes.js";

dotenv.config();

const prisma = new PrismaClient();
const app = express();

// Middleware
app.use(cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
    console.log(`${req.method} ${req.path} - ${new Date().toISOString()}`);
    next();
});

// API Routes
app.use("/api/landing", landingRoutes);
app.use("/api/properties", propertyRoutes);
app.use("/api/users", userRoutes);
app.use("/api/favorites", favoriteRoutes);
app.use("/api/ratings", ratingRoutes);

// Health check
app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Property Management API is running",
        version: "1.0.0",
        timestamp: new Date().toISOString()
    });
});

// API status endpoint
app.get("/api/status", async (req, res) => {
    try {
        // Test database connection
        await prisma.$queryRaw`SELECT 1`;
        
        res.json({
            success: true,
            message: "API and database are healthy",
            database: "connected",
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Database connection failed",
            database: "disconnected",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// 404 handler - FIX: Removed the "*" from app.use()
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "Route not found",
        path: req.originalUrl
    });
});

// Global error handler
app.use((error, req, res, next) => {
    console.error("Global error:", error);
    
    res.status(error.status || 500).json({
        success: false,
        message: error.message || "Internal server error",
        ...(process.env.NODE_ENV === 'development' && {
            stack: error.stack,
            details: error
        })
    });
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Received SIGINT. Gracefully shutting down...');
    await prisma.$disconnect();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('Received SIGTERM. Gracefully shutting down...');
    await prisma.$disconnect();
    process.exit(0);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`🚀 Property Management API running on port ${PORT}`);
    console.log(`📍 Health check: http://localhost:${PORT}`);
    console.log(`📊 API status: http://localhost:${PORT}/api/status`);
    console.log(`🏠 Landing page data: http://localhost:${PORT}/api/landing`);
});
