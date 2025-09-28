import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const JWT_EXPIRATION = '7d';

// Register new user
export const register = async (req, res) => {
    try {
        const {
            email,
            password,
            firstName,
            lastName,
            phone,
            role = 'CLIENT'
        } = req.body;

        // Validation
        if (!email || !password || !firstName || !lastName) {
            return res.status(400).json({
                success: false,
                message: "Please provide email, password, first name, and last name"
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 6 characters long"
            });
        }

        // Check if user exists
        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [
                    { email },
                    ...(phone ? [{ phone }] : [])
                ]
            }
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: existingUser.email === email ? "Email is already in use" : "Phone number is already in use"
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Create user
        const newUser = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                firstName,
                lastName,
                phone: phone || null,
                role: ['CLIENT', 'LANDLORD', 'AGENT'].includes(role) ? role : 'CLIENT'
            },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                isEmailVerified: true,
                verificationStatus: true,
                createdAt: true
            }
        });

        res.status(201).json({
            success: true,
            data: newUser,
            message: "User registered successfully"
        });

    } catch (error) {
        console.error("Registration Error:", error);
        res.status(500).json({
            success: false,
            message: "Server error during registration"
        });
    }
};

// Login user
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Please provide both email and password"
            });
        }

        // Find user
        const user = await prisma.user.findUnique({
            where: { email },
            select: {
                id: true,
                email: true,
                password: true,
                firstName: true,
                lastName: true,
                role: true,
                isEmailVerified: true,
                verificationStatus: true,
                avatarUrl: true
            }
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid credentials"
            });
        }

        // Validate password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: "Invalid credentials"
            });
        }

        // Generate JWT token
        const token = jwt.sign(
            { id: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: JWT_EXPIRATION }
        );

        // Calculate expiration date
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        // Create session
        await prisma.session.create({
            data: {
                userId: user.id,
                token,
                expiresAt
            }
        });

        // Update last login
        await prisma.user.update({
            where: { id: user.id },
            data: { lastLogin: new Date() }
        });

        const { password: _, ...userWithoutPassword } = user;

        res.status(200).json({
            success: true,
            data: {
                user: userWithoutPassword,
                token
            },
            message: "Login successful"
        });

    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({
            success: false,
            message: "Server error during login"
        });
    }
};

// Logout user
export const logout = async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (token) {
            await prisma.session.deleteMany({
                where: { token }
            });
        }

        res.status(200).json({
            success: true,
            message: "Successfully logged out"
        });

    } catch (error) {
        console.error("Logout Error:", error);
        res.status(500).json({
            success: false,
            message: "Server error during logout"
        });
    }
};

// Get current user profile
export const getProfile = async (req, res) => {
    try {
        const userId = req.userId;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
                avatarUrl: true,
                role: true,
                isEmailVerified: true,
                verificationStatus: true,
                createdAt: true,
                lastLogin: true,
                verificationInfo: {
                    select: {
                        status: true,
                        statusReason: true,
                        submittedAt: true,
                        reviewedAt: true
                    }
                },
                agentProfile: true,
                _count: {
                    select: {
                        propertiesPosted: true,
                        propertiesManaged: true,
                        ratings: true,
                        complaints: true,
                        favorites: true
                    }
                }
            }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        res.status(200).json({
            success: true,
            data: user
        });

    } catch (error) {
        console.error("Profile Fetch Error:", error);
        res.status(500).json({
            success: false,
            message: "Server error fetching profile"
        });
    }
};

// Update user profile
export const updateProfile = async (req, res) => {
    try {
        const userId = req.userId;
        const {
            firstName,
            lastName,
            phone,
            avatarUrl
        } = req.body;

        // Check if phone is already taken by another user
        if (phone) {
            const existingUser = await prisma.user.findFirst({
                where: {
                    phone,
                    id: { not: userId }
                }
            });

            if (existingUser) {
                return res.status(409).json({
                    success: false,
                    message: "Phone number is already in use"
                });
            }
        }

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: {
                ...(firstName && { firstName }),
                ...(lastName && { lastName }),
                ...(phone !== undefined && { phone: phone || null }),
                ...(avatarUrl !== undefined && { avatarUrl: avatarUrl || null })
            },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
                avatarUrl: true,
                role: true,
                isEmailVerified: true,
                verificationStatus: true,
                createdAt: true,
                lastLogin: true
            }
        });

        res.status(200).json({
            success: true,
            data: updatedUser,
            message: "Profile updated successfully"
        });

    } catch (error) {
        console.error("Profile Update Error:", error);
        res.status(500).json({
            success: false,
            message: "Server error updating profile"
        });
    }
};

// Change password
export const changePassword = async (req, res) => {
    try {
        const userId = req.userId;
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: "Please provide both current and new password"
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: "New password must be at least 6 characters long"
            });
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { password: true }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
        if (!isCurrentPasswordValid) {
            return res.status(400).json({
                success: false,
                message: "Current password is incorrect"
            });
        }

        const hashedNewPassword = await bcrypt.hash(newPassword, 12);

        await prisma.user.update({
            where: { id: userId },
            data: { password: hashedNewPassword }
        });

        // Invalidate all sessions for security
        await prisma.session.deleteMany({
            where: { userId }
        });

        res.status(200).json({
            success: true,
            message: "Password changed successfully. Please log in again."
        });

    } catch (error) {
        console.error("Change Password Error:", error);
        res.status(500).json({
            success: false,
            message: "Server error changing password"
        });
    }
};

// Get user's properties
export const getUserProperties = async (req, res) => {
    try {
        const userId = req.userId;
        const { page = 1, limit = 10, status } = req.query;

        const where = { postedById: userId };
        if (status) {
            where.status = status;
        }

        const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
        const take = parseInt(limit, 10);

        const [properties, total] = await Promise.all([
            prisma.property.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: 'desc' },
                include: {
                    managedByAgent: {
                        select: {
                            firstName: true,
                            lastName: true,
                            avatarUrl: true
                        }
                    },
                    _count: {
                        select: {
                            views: true,
                            favoritedBy: true,
                            ratings: true,
                            complaints: true
                        }
                    }
                }
            }),
            prisma.property.count({ where })
        ]);

        res.status(200).json({
            success: true,
            data: properties,
            pagination: {
                total,
                limit: take,
                page: parseInt(page, 10),
                totalPages: Math.ceil(total / take)
            }
        });

    } catch (error) {
        console.error("Get User Properties Error:", error);
        res.status(500).json({
            success: false,
            message: "Server error fetching user properties"
        });
    }
};