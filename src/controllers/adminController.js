import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// --- Dashboard ---

/**
 * @desc    Get dashboard statistics
 * @route   GET /api/admin/dashboard
 * @access  Private (Admin)
 */
export const getDashboardStats = async (req, res) => {
    try {
        const totalUsers = prisma.user.count();
        const totalProperties = prisma.property.count();
        const pendingVerifications = prisma.userVerification.count({
            where: { status: 'PENDING' }
        });
        const pendingComplaints = prisma.complaint.count({
            where: { status: 'PENDING' }
        });

        const [users, properties, verifications, complaints] = await Promise.all([
            totalUsers,
            totalProperties,
            pendingVerifications,
            pendingComplaints,
        ]);

        const recentUsers = await prisma.user.findMany({
            take: 5,
            orderBy: { createdAt: 'desc' },
            select: { id: true, firstName: true, lastName: true, role: true, createdAt: true }
        });

        res.status(200).json({
            success: true,
            data: {
                totalUsers: users,
                totalProperties: properties,
                pendingVerifications: verifications,
                pendingComplaints: complaints,
                recentUsers
            }
        });

    } catch (error) {
        console.error("Dashboard Stats Error:", error);
        res.status(500).json({ success: false, message: "Server error fetching dashboard stats" });
    }
};


// --- User Management ---

/**
 * @desc    Get all users with filtering and pagination
 * @route   GET /api/admin/users
 * @access  Private (Admin)
 */
export const getAllUsers = async (req, res) => {
    try {
        const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc', role, verificationStatus, search } = req.query;

        const where = {};
        if (role) where.role = role;
        if (verificationStatus) where.verificationStatus = verificationStatus;
        if (search) {
            where.OR = [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search, mode: 'insensitive' } }
            ];
        }

        const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
        const take = parseInt(limit, 10);
        const orderBy = { [sortBy]: sortOrder };

        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                skip,
                take,
                orderBy,
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    phone: true,
                    role: true,
                    verificationStatus: true,
                    createdAt: true,
                    lastLogin: true
                }
            }),
            prisma.user.count({ where })
        ]);

        res.status(200).json({
            success: true,
            data: users,
            pagination: {
                total,
                limit: take,
                page: parseInt(page, 10),
                totalPages: Math.ceil(total / take)
            }
        });

    } catch (error) {
        console.error("Get All Users Error:", error);
        res.status(500).json({ success: false, message: "Server error fetching users" });
    }
};

/**
 * @desc    Get a single user by ID
 * @route   GET /api/admin/users/:id
 * @access  Private (Admin)
 */
export const getUserById = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await prisma.user.findUnique({
            where: { id },
            include: {
                verificationInfo: true,
                agentProfile: true,
                propertiesPosted: { take: 5, orderBy: { createdAt: 'desc' } },
                complaints: { take: 5, orderBy: { createdAt: 'desc' } }
            }
        });

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        
        const { password, ...userWithoutPassword } = user;

        res.status(200).json({ success: true, data: userWithoutPassword });

    } catch (error) {
        console.error("Get User By ID Error:", error);
        res.status(500).json({ success: false, message: "Server error fetching user details" });
    }
};


/**
 * @desc    Update a user's details (role, status, etc.)
 * @route   PUT /api/admin/users/:id
 * @access  Private (Admin)
 */
export const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { firstName, lastName, role, verificationStatus } = req.body;

        if (!firstName && !lastName && !role && !verificationStatus) {
            return res.status(400).json({ success: false, message: "No update data provided." });
        }

        const updatedUser = await prisma.user.update({
            where: { id },
            data: {
                ...(firstName && { firstName }),
                ...(lastName && { lastName }),
                ...(role && { role }),
                ...(verificationStatus && { verificationStatus }),
            },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                role: true,
                verificationStatus: true,
            }
        });

        res.status(200).json({ success: true, data: updatedUser, message: "User updated successfully" });

    } catch (error) {
        console.error("Admin Update User Error:", error);
        if (error.code === 'P2025') {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        res.status(500).json({ success: false, message: "Server error updating user" });
    }
};

/**
 * @desc    Delete a user
 * @route   DELETE /api/admin/users/:id
 * @access  Private (Admin)
 */
export const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        if (req.userId === id) {
             return res.status(400).json({ success: false, message: "Admin cannot delete their own account." });
        }

        await prisma.user.delete({
            where: { id }
        });

        res.status(200).json({ success: true, message: "User deleted successfully" });

    } catch (error) {
        console.error("Admin Delete User Error:", error);
        if (error.code === 'P2025') {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        res.status(500).json({ success: false, message: "Server error deleting user" });
    }
};


// --- Verification Management ---

/**
 * @desc    Get all verification requests
 * @route   GET /api/admin/verifications
 * @access  Private (Admin)
 */
export const getVerificationRequests = async (req, res) => {
     try {
        const { page = 1, limit = 10, sortBy = 'submittedAt', sortOrder = 'desc', status } = req.query;

        const where = {};
        if (status) where.status = status;

        const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
        const take = parseInt(limit, 10);
        const orderBy = { [sortBy]: sortOrder };

        const [requests, total] = await Promise.all([
            prisma.userVerification.findMany({
                where,
                skip,
                take,
                orderBy,
                include: {
                    user: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true,
                            role: true,
                        }
                    }
                }
            }),
            prisma.userVerification.count({ where })
        ]);

        res.status(200).json({
            success: true,
            data: requests,
            pagination: {
                total,
                limit: take,
                page: parseInt(page, 10),
                totalPages: Math.ceil(total / take)
            }
        });

    } catch (error) {
        console.error("Get Verification Requests Error:", error);
        res.status(500).json({ success: false, message: "Server error fetching verification requests" });
    }
};

/**
 * @desc    Review a verification request (Approve/Reject)
 * @route   PUT /api/admin/verifications/:id/review
 * @access  Private (Admin)
 */
export const reviewVerificationRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, statusReason } = req.body;

        if (!status || !['VERIFIED', 'REJECTED'].includes(status)) {
            return res.status(400).json({ success: false, message: "Invalid status provided. Must be 'VERIFIED' or 'REJECTED'." });
        }
        if (status === 'REJECTED' && !statusReason) {
             return res.status(400).json({ success: false, message: "A reason is required for rejection." });
        }

        const verificationRequest = await prisma.userVerification.findUnique({
            where: { id }
        });

        if (!verificationRequest) {
            return res.status(404).json({ success: false, message: "Verification request not found." });
        }

        // Use a transaction to ensure both user and verification records are updated together
        await prisma.$transaction([
            prisma.userVerification.update({
                where: { id },
                data: {
                    status,
                    statusReason: status === 'REJECTED' ? statusReason : null,
                    reviewedAt: new Date()
                }
            }),
            prisma.user.update({
                where: { id: verificationRequest.userId },
                data: {
                    verificationStatus: status
                }
            })
        ]);

        res.status(200).json({
            success: true,
            message: `User verification has been ${status.toLowerCase()}.`
        });

    } catch (error) {
        console.error("Review Verification Error:", error);
        res.status(500).json({ success: false, message: "Server error processing verification request" });
    }
};


// --- Complaint Management ---

/**
 * @desc    Get all complaints
 * @route   GET /api/admin/complaints
 * @access  Private (Admin)
 */
export const getAllComplaints = async (req, res) => {
    try {
        const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc', status } = req.query;

        const where = {};
        if (status) where.status = status;

        const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
        const take = parseInt(limit, 10);
        const orderBy = { [sortBy]: sortOrder };

        const [complaints, total] = await Promise.all([
            prisma.complaint.findMany({
                where,
                skip,
                take,
                orderBy,
                include: {
                    client: {
                        select: { id: true, firstName: true, lastName: true, email: true }
                    },
                    property: {
                        select: { id: true, title: true }
                    }
                }
            }),
            prisma.complaint.count({ where })
        ]);

         res.status(200).json({
            success: true,
            data: complaints,
            pagination: {
                total,
                limit: take,
                page: parseInt(page, 10),
                totalPages: Math.ceil(total / take)
            }
        });

    } catch (error) {
        console.error("Get All Complaints Error:", error);
        res.status(500).json({ success: false, message: "Server error fetching complaints" });
    }
};

/**
 * @desc    Update a complaint (status, resolution notes)
 * @route   PUT /api/admin/complaints/:id
 * @access  Private (Admin)
 */
export const updateComplaint = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, resolutionNotes } = req.body;
        const adminId = req.userId;

        if (!status) {
            return res.status(400).json({ success: false, message: "Status is required." });
        }

        const dataToUpdate = {
            status,
            ...(resolutionNotes && { resolutionNotes })
        };

        if (status === 'RESOLVED') {
            dataToUpdate.resolvedAt = new Date();
            dataToUpdate.resolvedBy = adminId;
        }

        const updatedComplaint = await prisma.complaint.update({
            where: { id },
            data: dataToUpdate
        });

        res.status(200).json({
            success: true,
            data: updatedComplaint,
            message: "Complaint updated successfully"
        });

    } catch (error) {
        console.error("Update Complaint Error:", error);
        if (error.code === 'P2025') {
            return res.status(404).json({ success: false, message: "Complaint not found" });
        }
        res.status(500).json({ success: false, message: "Server error updating complaint" });
    }
};