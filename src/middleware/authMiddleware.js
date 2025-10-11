import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import multer from 'multer';

const prisma = new PrismaClient();



// Configure multer to use memory storage.
// This is efficient because we don't need to save the file to disk
// before uploading it to a cloud service like Cloudinary.
const storage = multer.memoryStorage();

export const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB file size limit
  },
  fileFilter: (req, file, cb) => {
    // Allow only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Not an image! Please upload only images.'), false);
    }
  },
});




// Standard auth middleware - requires authentication
export const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Access token is required"
            });
        }

        // Verify JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Check if session exists in database
        const session = await prisma.session.findFirst({
            where: {
                token,
                userId: decoded.id,
                expiresAt: {
                    gt: new Date()
                }
            },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                        role: true,
                        isEmailVerified: true,
                        verificationStatus: true
                    }
                }
            }
        });

        if (!session) {
            return res.status(401).json({
                success: false,
                message: "Invalid or expired token"
            });
        }

        // Add user info to request object
        req.userId = session.user.id;
        req.userRole = session.user.role;
        req.user = session.user;

        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: "Invalid token"
            });
        } else if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: "Token expired"
            });
        } else {
            console.error("Auth middleware error:", error);
            return res.status(500).json({
                success: false,
                message: "Server error during authentication"
            });
        }
    }
};

// Optional auth middleware - doesn't require authentication but adds user info if present
export const optionalAuthMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return next(); // Continue without auth info
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const session = await prisma.session.findFirst({
            where: {
                token,
                userId: decoded.id,
                expiresAt: {
                    gt: new Date()
                }
            },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                        role: true,
                        isEmailVerified: true,
                        verificationStatus: true
                    }
                }
            }
        });

        if (session) {
            req.userId = session.user.id;
            req.userRole = session.user.role;
            req.user = session.user;
        }

        next();
    } catch (error) {
        // In optional auth, we continue even if token is invalid
        next();
    }
};

// Role-based middleware
export const requireRole = (roles) => {
    return (req, res, next) => {
        if (!req.userRole) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }

        const allowedRoles = Array.isArray(roles) ? roles : [roles];
        
        if (!allowedRoles.includes(req.userRole)) {
            return res.status(403).json({
                success: false,
                message: "Insufficient permissions"
            });
        }

        next();
    };
};

// Admin only middleware
export const adminOnly = requireRole(['ADMIN']);

// Landlord and Agent middleware
export const landlordOrAgent = requireRole(['LANDLORD', 'AGENT', 'ADMIN']);