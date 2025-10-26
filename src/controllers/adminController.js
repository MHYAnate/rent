import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * @desc    Get all users with filtering and pagination
 * @route   GET /api/admin/users
 * @access  Private (Admin)
 */

// Helper function to safely process grouped data
function safeGroupedData(data, groupByField, countField) {
    if (!data || !Array.isArray(data)) return {};
    
    return data.reduce((acc, item) => {
        const key = item[groupByField];
        if (key != null) {
            acc[key] = item._count[countField] || 0;
        }
        return acc;
    }, {});
}

// Helper to safely calculate totals
function safeTotal(data, field = 'role') {
    if (!data || !Array.isArray(data)) return 0;
    return data.reduce((sum, item) => sum + (item?._count?.[field] || 0), 0);
}

// Add BigInt serialization support globally
BigInt.prototype.toJSON = function() {
    return Number(this.toString());
};

export const getDashboardStats = async (req, res) => {
    try {
        // --- Step 1: Define Time Windows ---
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
        // --- Step 2: Define all possible enum values from schema ---
        const ALL_PROPERTY_STATUS = ['AVAILABLE', 'RENTED', 'UNDER_MAINTENANCE', 'UNAVAILABLE'];
        const ALL_PROPERTY_TYPES = ['HOUSE', 'APARTMENT', 'SHOP', 'OFFICE', 'LAND', 'WAREHOUSE', 'COMMERCIAL', 'INDUSTRIAL'];
        const ALL_LISTING_TYPES = ['FOR_RENT', 'FOR_SALE'];
        const ALL_USER_ROLES = ['CLIENT', 'LANDLORD', 'AGENT', 'ADMIN'];
        const ALL_VERIFICATION_STATUS = ['UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED'];
  
        // --- Step 3: Prepare All Database Queries ---
        const [
            userCounts,
            userVerificationCounts,
            propertyCountsByStatus,
            propertyCountsByType,
            propertyCountsByListingType,
            pendingVerifications,
            pendingComplaints,
            totalRatings,
            totalFavorites,
            totalViews,
            newUsersCount,
            recentUsers,
            averagePropertyPrice,
            userRegistrationTrends,
            propertyCreationTrends,
            userEngagementStats
        ] = await Promise.all([
            // --- User Metrics ---
            prisma.user.groupBy({
                by: ['role'],
                _count: { role: true },
            }).catch(() => []),
  
            prisma.user.groupBy({
                by: ['verificationStatus'],
                _count: { verificationStatus: true },
            }).catch(() => []),
  
            // --- Property Metrics ---
            prisma.property.groupBy({
                by: ['status'],
                _count: { status: true },
            }).catch(() => []),
  
            prisma.property.groupBy({
                by: ['type'],
                _count: { type: true },
            }).catch(() => []),
  
            prisma.property.groupBy({
                by: ['listingType'],
                _count: { listingType: true },
            }).catch(() => []),
  
            // --- System Health ---
            prisma.userVerification.count({ where: { status: 'PENDING' } }).catch(() => 0),
            prisma.complaint.count({ where: { status: 'PENDING' } }).catch(() => 0),
            
            // --- Engagement ---
            prisma.rating.count().catch(() => 0),
            prisma.favorite.count().catch(() => 0),
            prisma.propertyView.count().catch(() => 0),
  
            // --- User Activity ---
            prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }).catch(() => 0),
  
            // --- Recent Activity ---
            prisma.user.findMany({
                take: 5,
                orderBy: { createdAt: 'desc' },
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
                },
            }).catch(() => []),
            
            // --- Average Price ---
            prisma.property.aggregate({
                _avg: { price: true }
            }).catch(() => ({ _avg: { price: null } })),
  
            // --- FIXED: User Registration Trends for Charts ---
            prisma.user.findMany({
                where: {
                    createdAt: { gte: thirtyDaysAgo }
                },
                select: {
                    createdAt: true
                }
            }).then(users => {
                const trends = {};
                users.forEach(user => {
                    const date = user.createdAt.toISOString().split('T')[0];
                    trends[date] = (trends[date] || 0) + 1;
                });
                return Object.entries(trends).map(([date, count]) => ({
                    date,
                    count
                })).sort((a, b) => a.date.localeCompare(b.date));
            }).catch(() => []),
  
            // --- FIXED: Property Creation Trends for Charts ---
            prisma.property.findMany({
                where: {
                    createdAt: { gte: thirtyDaysAgo }
                },
                select: {
                    createdAt: true
                }
            }).then(properties => {
                const trends = {};
                properties.forEach(property => {
                    const date = property.createdAt.toISOString().split('T')[0];
                    trends[date] = (trends[date] || 0) + 1;
                });
                return Object.entries(trends).map(([date, count]) => ({
                    date,
                    count
                })).sort((a, b) => a.date.localeCompare(b.date));
            }).catch(() => []),
  
            // --- User Engagement Statistics ---
            prisma.user.findMany({
                where: {
                    role: { in: ['CLIENT', 'LANDLORD', 'AGENT'] }
                },
                select: {
                    id: true,
                    role: true,
                    lastLogin: true,
                    _count: {
                        select: {
                            propertiesPosted: true,
                            ratings: true,
                            favorites: true,
                            complaints: true
                        }
                    }
                }
            }).catch(() => [])
        ]);
  
        // --- Step 4: FIXED - Get Property Data with Correct Field Names ---
        let allProperties = [];
        let topViewedProperties = [];
        let allUsers = [];
  
        try {
            // FIXED: Use the same structure as getAllProperties
            allProperties = await prisma.property.findMany({
                orderBy: { createdAt: 'desc' },
                include: {
                    postedBy: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true,
                            phone: true,
                            role: true,
                            avatarUrl: true
                        }
                    },
                    managedByAgent: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true,
                            phone: true,
                            avatarUrl: true
                        }
                    },
                    _count: {
                        select: {
                            views: true,
                            favoritedBy: true,  // FIXED: Changed from 'favorites' to 'favoritedBy'
                            ratings: true,
                            complaints: true
                        }
                    }
                }
            });
            console.log(`Found ${allProperties.length} properties`);
        } catch (propertyError) {
            console.error("Properties query error:", propertyError);
            allProperties = [];
        }
  
        try {
            // FIXED: Top viewed properties with correct field names
            topViewedProperties = await prisma.property.findMany({
                take: 10,
                orderBy: {
                    createdAt: 'desc'
                },
                include: {
                    postedBy: {
                        select: {
                            firstName: true,
                            lastName: true,
                            email: true,
                            phone: true
                        }
                    },
                    _count: {
                        select: {
                            views: true,
                            favoritedBy: true,  // FIXED: Changed from 'favorites' to 'favoritedBy'
                            ratings: true
                        }
                    }
                }
            });
            console.log(`Found ${topViewedProperties.length} top properties`);
        } catch (topPropertiesError) {
            console.error("Top properties query error:", topPropertiesError);
            topViewedProperties = [];
        }
  
        try {
            // Get all users for user table data
            allUsers = await prisma.user.findMany({
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    phone: true,
                    role: true,
                    verificationStatus: true,
                    isEmailVerified: true,
                    createdAt: true,
                    updatedAt: true,
                    lastLogin: true,
                    avatarUrl: true,
                    verificationInfo: {
                        select: {
                            status: true,
                            submittedAt: true,
                            reviewedAt: true
                        }
                    },
                    agentProfile: {
                        select: {
                            experience: true,
                            specialties: true
                        }
                    },
                    _count: {
                        select: {
                            propertiesPosted: true,
                            ratings: true,
                            complaints: true,
                            favorites: true
                        }
                    }
                },
            });
            console.log(`Found ${allUsers.length} users`);
        } catch (usersError) {
            console.error("Users query error:", usersError);
            allUsers = [];
        }
  
        // --- Step 5: Helper Functions ---
        const convertBigIntToNumber = (obj) => {
            if (obj === null || obj === undefined) return obj;
            if (typeof obj === 'bigint') return Number(obj);
            if (obj instanceof Date) return obj.toISOString();
            if (Array.isArray(obj)) return obj.map(convertBigIntToNumber);
            if (typeof obj === 'object') {
                const newObj = {};
                for (const key in obj) {
                    newObj[key] = convertBigIntToNumber(obj[key]);
                }
                return newObj;
            }
            return obj;
        };
  
        // Function to ensure all enum keys are present with default 0 values
        const ensureAllEnumKeys = (data, allPossibleKeys, keyField) => {
            const result = {};
            
            // Initialize all possible keys with 0
            allPossibleKeys.forEach(key => {
                result[key] = 0;
            });
  
            // Update with actual data from database
            if (data && Array.isArray(data)) {
                data.forEach(item => {
                    const key = item[keyField];
                    if (key !== undefined && key !== null) {
                        const count = item._count[keyField];
                        result[key] = typeof count === 'bigint' ? Number(count) : (count || 0);
                    }
                });
            }
  
            return result;
        };
  
        // --- Step 6: Process and Transform Data ---
        
        // User metrics with all enum keys
        const usersByRole = ensureAllEnumKeys(userCounts, ALL_USER_ROLES, 'role');
        const usersByVerification = ensureAllEnumKeys(userVerificationCounts, ALL_VERIFICATION_STATUS, 'verificationStatus');
        
        // Property metrics with all enum keys
        const propertiesByStatus = ensureAllEnumKeys(propertyCountsByStatus, ALL_PROPERTY_STATUS, 'status');
        const propertiesByType = ensureAllEnumKeys(propertyCountsByType, ALL_PROPERTY_TYPES, 'type');
        const propertiesByListingType = ensureAllEnumKeys(propertyCountsByListingType, ALL_LISTING_TYPES, 'listingType');
  
        // Safe average price calculation
        const avgPrice = averagePropertyPrice?._avg?.price;
        const averagePrice = avgPrice ? 
            Number(parseFloat(avgPrice.toString()).toFixed(2)) : 0;
  
        // Calculate totals
        const totalUsers = Object.values(usersByRole).reduce((sum, count) => sum + count, 0);
        const totalNonAdminUsers = ALL_USER_ROLES
            .filter(role => role !== 'ADMIN')
            .reduce((sum, role) => sum + (usersByRole[role] || 0), 0);
        const totalProperties = Object.values(propertiesByStatus).reduce((sum, count) => sum + count, 0);
  
        // --- Process User Data ---
        const processedUsers = (allUsers || []).map(user => ({
            id: user.id,
            name: `${user.firstName} ${user.lastName}`,
            email: user.email || 'N/A',
            phone: user.phone,
            role: user.role,
            verificationStatus: user.verificationStatus,
            isEmailVerified: user.isEmailVerified,
            lastLogin: user.lastLogin ? user.lastLogin.toISOString() : null,
            joinDate: user.createdAt.toISOString(),
            propertiesCount: convertBigIntToNumber(user._count?.propertiesPosted) || 0,
            reviewsCount: convertBigIntToNumber(user._count?.ratings) || 0,
            favoritesCount: convertBigIntToNumber(user._count?.favorites) || 0,
            complaintsCount: convertBigIntToNumber(user._count?.complaints) || 0,
            avatar: user.avatarUrl,
            experience: user.agentProfile?.experience,
            specialties: user.agentProfile?.specialties || []
        }));
  
        const userMetrics = {
            totalUsers,
            totalNonAdminUsers,
            byRole: usersByRole,
            byVerificationStatus: usersByVerification,
            newLast30Days: newUsersCount || 0,
            userTableData: processedUsers,
            registrationTrends: userRegistrationTrends || [],
            engagementAnalytics: (userEngagementStats || []).map(user => ({
                userId: user.id,
                role: user.role,
                lastActive: user.lastLogin ? user.lastLogin.toISOString() : null,
                propertiesPosted: convertBigIntToNumber(user._count?.propertiesPosted) || 0,
                reviewsGiven: convertBigIntToNumber(user._count?.ratings) || 0,
                favoritesAdded: convertBigIntToNumber(user._count?.favorites) || 0,
                complaintsFiled: convertBigIntToNumber(user._count?.complaints) || 0
            }))
        };
  
        // --- FIXED: Process Property Data ---
        const propertyTableData = (allProperties || []).map(property => {
            const price = property.price ? parseFloat(property.price.toString()) : 0;
            return {
                id: property.id,
                title: property.title,
                type: property.type,
                listingType: property.listingType,
                status: property.status,
                price: price,
                currency: property.currency,
                location: `${property.city}, ${property.state}`,
                address: property.address,
                bedrooms: property.bedrooms,
                bathrooms: property.bathrooms,
                area: property.area,
                yearBuilt: property.yearBuilt,
                imageUrls: property.imageUrls,
                videoUrls: property.videoUrls,
                amenities: property.amenities,
                postedBy: property.postedBy ? 
                    `${property.postedBy.firstName} ${property.postedBy.lastName}` : 'N/A',
                postedById: property.postedBy?.id,
                managedBy: property.managedByAgent ? 
                    `${property.managedByAgent.firstName} ${property.managedByAgent.lastName}` : 'N/A',
                managedById: property.managedByAgent?.id,
                createdAt: property.createdAt.toISOString(),
                updatedAt: property.updatedAt.toISOString(),
                availableFrom: property.availableFrom?.toISOString(),
                // Engagement metrics - FIXED: using correct field names
                views: convertBigIntToNumber(property._count?.views) || 0,
                favorites: convertBigIntToNumber(property._count?.favoritedBy) || 0, // FIXED: favoritedBy
                ratings: convertBigIntToNumber(property._count?.ratings) || 0,
                complaints: convertBigIntToNumber(property._count?.complaints) || 0,
                isFeatured: property.isFeatured
            };
        });
  
        const topPerformingProperties = (topViewedProperties || []).map(property => {
            const price = property.price ? parseFloat(property.price.toString()) : 0;
            return {
                id: property.id,
                title: property.title,
                type: property.type,
                listingType: property.listingType,
                price: price,
                currency: property.currency,
                location: `${property.city}, ${property.state}`,
                postedBy: property.postedBy ? 
                    `${property.postedBy.firstName} ${property.postedBy.lastName}` : 'N/A',
                postedByEmail: property.postedBy?.email,
                postedByPhone: property.postedBy?.phone,
                views: convertBigIntToNumber(property._count?.views) || 0,
                favorites: convertBigIntToNumber(property._count?.favoritedBy) || 0, // FIXED: favoritedBy
                ratings: convertBigIntToNumber(property._count?.ratings) || 0,
                createdAt: property.createdAt.toISOString(),
                isFeatured: property.isFeatured
            };
        });
  
        const propertyMetrics = {
            totalProperties,
            byStatus: propertiesByStatus,
            byType: propertiesByType,
            byListingType: propertiesByListingType,
            averagePrice: averagePrice,
            propertyTableData: propertyTableData,
            creationTrends: propertyCreationTrends || [],
            topPerforming: topPerformingProperties
        };
  
        // --- Process Recent Users ---
        const processedRecentUsers = (recentUsers || []).map(user => ({
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            phone: user.phone,
            role: user.role,
            verificationStatus: user.verificationStatus,
            createdAt: user.createdAt.toISOString(),
            lastLogin: user.lastLogin ? user.lastLogin.toISOString() : null
        }));
  
        // --- Step 7: Assemble Final Response ---
        const responseData = {
            userMetrics: convertBigIntToNumber(userMetrics),
            propertyMetrics: convertBigIntToNumber(propertyMetrics),
            systemHealth: {
                pendingVerifications: Number(pendingVerifications) || 0,
                pendingComplaints: Number(pendingComplaints) || 0,
            },
            engagement: {
                totalRatings: Number(totalRatings) || 0,
                totalFavorites: Number(totalFavorites) || 0,
                totalViews: Number(totalViews) || 0,
            },
            recentActivity: {
                recentUsers: processedRecentUsers,
                recentProperties: propertyTableData.slice(0, 5) // Get first 5 properties
            },
            analytics: {
                userGrowth: userRegistrationTrends || [],
                propertyGrowth: propertyCreationTrends || [],
                userEngagement: convertBigIntToNumber(userEngagementStats) || [],
                topProperties: topPerformingProperties
            }
        };
  
        res.status(200).json({
            success: true,
            data: responseData,
        });
  
    } catch (error) {
        console.error("Dashboard Stats Error:", error);
        res.status(500).json({ 
            success: false, 
            message: "Server error fetching dashboard stats",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
  };


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

// Get paginated users for admin table
export const getUsersForAdmin = async (req, res) => {
    try {
        const { page = 1, limit = 10, role, verificationStatus } = req.query;
        const skip = (page - 1) * limit;

        const where = {};
        if (role) where.role = role;
        if (verificationStatus) where.verificationStatus = verificationStatus;

        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                skip,
                take: parseInt(limit),
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    phone: true,
                    role: true,
                    verificationStatus: true,
                    isEmailVerified: true,
                    createdAt: true,
                    lastLogin: true,
                    _count: {
                        select: {
                            propertiesPosted: true,
                            ratings: true,
                            complaints: true
                        }
                    }
                }
            }),
            prisma.user.count({ where })
        ]);

        res.status(200).json({
            success: true,
            data: {
                users,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        console.error("Get Users Error:", error);
        res.status(500).json({ success: false, message: "Server error fetching users" });
    }
};

// Get paginated properties for admin table
export const getPropertiesForAdmin = async (req, res) => {
    try {
        const { page = 1, limit = 10, status, type } = req.query;
        const skip = (page - 1) * limit;

        const where = {};
        if (status) where.status = status;
        if (type) where.type = type;

        const [properties, total] = await Promise.all([
            prisma.property.findMany({
                where,
                skip,
                take: parseInt(limit),
                orderBy: { createdAt: 'desc' },
                include: {
                    postedBy: {
                        select: {
                            firstName: true,
                            lastName: true,
                            email: true
                        }
                    },
                    _count: {
                        select: {
                            views: true,
                            favorites: true,
                            ratings: true
                        }
                    }
                }
            }),
            prisma.property.count({ where })
        ]);

        res.status(200).json({
            success: true,
            data: {
                properties,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        console.error("Get Properties Error:", error);
        res.status(500).json({ success: false, message: "Server error fetching properties" });
    }
};