import { PrismaClient } from "@prisma/client";
import { v2 as cloudinary } from 'cloudinary';
import streamifier from 'streamifier';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

// Get all properties with advanced filtering
export const getAllProperties = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            sortBy = 'createdAt',
            sortOrder = 'desc',
            listingType,
            propertyType,
            city,
            state,
            minPrice,
            maxPrice,
            bedrooms,
            bathrooms,
            amenities,
            search,
            isFeatured,
            userId
        } = req.query;

        // Build dynamic where clause
        const where = {};

        // Only show available properties by default unless user is viewing their own
        if (!userId) {
            where.status = 'AVAILABLE';
        } else {
            where.postedById = userId;
        }

        if (listingType) where.listingType = listingType;
        if (propertyType) where.type = propertyType;
        if (city) where.city = { contains: city, mode: 'insensitive' };
        if (state) where.state = { contains: state, mode: 'insensitive' };
        if (isFeatured !== undefined) where.isFeatured = isFeatured === 'true';

        if (minPrice || maxPrice) {
            where.price = {};
            if (minPrice) where.price.gte = parseFloat(minPrice);
            if (maxPrice) where.price.lte = parseFloat(maxPrice);
        }

        if (bedrooms) where.bedrooms = { gte: parseInt(bedrooms, 10) };
        if (bathrooms) where.bathrooms = { gte: parseInt(bathrooms, 10) };

        if (amenities) {
            const amenityList = amenities.split(',').map(a => a.trim());
            where.amenities = { hasSome: amenityList };
        }

        if (search) {
            where.OR = [
                { title: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
                { address: { contains: search, mode: 'insensitive' } }
            ];
        }

        const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
        const take = parseInt(limit, 10);
        const orderBy = { [sortBy]: sortOrder };

        const [properties, total] = await Promise.all([
            prisma.property.findMany({
                where,
                skip,
                take,
                orderBy,
                include: {
                    postedBy: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            avatarUrl: true,
                            role: true,
                            phone: true
                        }
                    },
                    managedByAgent: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            avatarUrl: true,
                            phone: true
                        }
                    },
                    ratings: {
                        include: {
                            client: {
                                select: {
                                    firstName: true,
                                    lastName: true,
                                    avatarUrl: true
                                }
                            }
                        }
                    },
                    _count: {
                        select: {
                            views: true,
                            favoritedBy: true,
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
        console.error("Get Properties Error:", error);
        res.status(500).json({
            success: false,
            message: "Server error fetching properties"
        });
    }
};

// Configure Cloudinary
// Ensure your .env file has these variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Helper function to upload files to Cloudinary
const uploadToCloudinary = (fileBuffer) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: 'properties' }, // Optional: organize uploads in a folder
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }
    );
    streamifier.createReadStream(fileBuffer).pipe(uploadStream);
  });
};


export const createProperty = async (req, res) => {
  try {
    const postedById = req.userId;
    const {
        title, description, type, listingType, price,
        address, city, state, zipCode,
        latitude, longitude, bedrooms, bathrooms, area, yearBuilt,
        amenities = [], isFeatured = false, availableFrom,
        imageUrls = []
    } = req.body;

    // --- LOGGING FOR DEBUGGING ---
    // This is invaluable for seeing exactly what the backend receives
    console.log('Received payload:', req.body);

    // 1. Validation (remains mostly the same)
    if (!title || !description || !type || !listingType || !price || !address || !city || !state) {
        return res.status(400).json({ success: false, message: "Missing required fields." });
    }
    if (!imageUrls || imageUrls.length === 0) {
        return res.status(400).json({ success: false, message: "At least one image is required." });
    }

    // 2. Authorization (remains the same)
    const user = await prisma.user.findUnique({ where: { id: postedById } });
    if (!user || !['LANDLORD', 'AGENT', 'ADMIN'].includes(user.role)) {
        return res.status(403).json({ success: false, message: "Only landlords, agents, and admins can post." });
    }
    
    // --- Data Formatting for Prisma ---
    // This is the CRITICAL fix section
    const dataForPrisma = {
        title,
        description,
        type, // e.g., "APARTMENT" (must match Prisma enum)
        listingType, // e.g., "FOR_RENT" (must match Prisma enum)
        price: parseFloat(price), // Prisma's Decimal type accepts a number
        currency: 'NGN',
        address, city, state, zipCode,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        bedrooms: bedrooms ? parseInt(bedrooms, 10) : null,
        bathrooms: bathrooms ? parseInt(bathrooms, 10) : null,
        area: area ? parseFloat(area) : null,
        yearBuilt: yearBuilt ? parseInt(yearBuilt, 10) : null,
        imageUrls,
        amenities,
        isFeatured: user.role === 'ADMIN' ? isFeatured : false,
        // FIX: Convert string to Date object, or null if not provided
        availableFrom: availableFrom ? new Date(availableFrom) : null,
        postedById,
    };

    // 3. Create Property in Database
    const newProperty = await prisma.property.create({
        data: dataForPrisma,
        include: { postedBy: { select: { firstName: true, lastName: true, avatarUrl: true, role: true } } }
    });

    res.status(201).json({ success: true, data: newProperty, message: "Property created successfully" });

  } catch (error) {
    // --- More Detailed Error Logging ---
    console.error("Create Property Error:", error);
    // Prisma validation errors are often detailed and useful
    if (error.code === 'P2002' || error.message.includes('validation failed')) {
      return res.status(400).json({ success: false, message: "Invalid data provided. Please check your inputs.", details: error.message });
    }
    res.status(500).json({ success: false, message: "Server error creating property" });
  }
};


// Get single property by ID with view tracking
export const getPropertyById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userId || null; // Optional user ID from auth middleware
        const { trackView = 'true' } = req.query;

        const property = await prisma.property.findUnique({
            where: { id },
            include: {
                postedBy: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        avatarUrl: true,
                        role: true,
                        phone: true
                    }
                },
                managedByAgent: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        avatarUrl: true,
                        phone: true
                    }
                },
                ratings: {
                    include: {
                        client: {
                            select: {
                                firstName: true,
                                lastName: true,
                                avatarUrl: true
                            }
                        }
                    },
                    orderBy: { createdAt: 'desc' }
                },
                _count: {
                    select: {
                        views: true,
                        favoritedBy: true,
                        complaints: true
                    }
                }
            }
        });

        if (!property) {
            return res.status(404).json({
                success: false,
                message: "Property not found"
            });
        }

        // Track property view if requested
        if (trackView === 'true') {
            const viewData = {
                propertyId: id,
                userId: userId,
                ipAddress: req.ip || req.connection.remoteAddress,
                userAgent: req.get('User-Agent')
            };

            // Don't track multiple views from the same user/IP within a short timeframe
            const recentView = await prisma.propertyView.findFirst({
                where: {
                    propertyId: id,
                    ...(userId ? { userId } : { ipAddress: viewData.ipAddress }),
                    viewedAt: {
                        gte: new Date(Date.now() - 30 * 60 * 1000) // 30 minutes ago
                    }
                }
            });

            if (!recentView) {
                await prisma.propertyView.create({ data: viewData });
            }
        }

        // Calculate average rating
        const avgRating = property.ratings.length > 0
            ? property.ratings.reduce((sum, r) => sum + r.rating, 0) / property.ratings.length
            : 0;

        const propertyWithStats = {
            ...property,
            averageRating: Math.round(avgRating * 10) / 10,
            totalRatings: property.ratings.length
        };

        res.status(200).json({
            success: true,
            data: propertyWithStats
        });

    } catch (error) {
        console.error("Get Property Error:", error);
        res.status(500).json({
            success: false,
            message: "Server error fetching property"
        });
    }
};

// Update property
export const updateProperty = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userId;
        const userRole = req.userRole;

        const property = await prisma.property.findUnique({
            where: { id },
            include: { managedByAgent: true }
        });

        if (!property) {
            return res.status(404).json({
                success: false,
                message: "Property not found"
            });
        }

        // Check authorization
        const canUpdate = property.postedById === userId ||
                         property.managedByAgentId === userId ||
                         userRole === 'ADMIN'||
                         userRole === "SUPER_ADMIN";
                       
                         

        if (!canUpdate) {
            return res.status(403).json({
                success: false,
                message: "You are not authorized to update this property"
            });
        }

        const updatedData = { ...req.body };
        
        // Only admins can set featured status
        // if (userRole !== 'ADMIN' || userRole !== "SUPER_ADMIN") {
        //     delete updatedData.isFeatured;
        // }

        if (!['ADMIN', 'SUPER_ADMIN'].includes(userRole)) {
            delete updatedData.isFeatured;
            }
        // Convert numeric fields
        if (updatedData.price) updatedData.price = parseFloat(updatedData.price);
        if (updatedData.latitude) updatedData.latitude = parseFloat(updatedData.latitude);
        if (updatedData.longitude) updatedData.longitude = parseFloat(updatedData.longitude);
        if (updatedData.bedrooms) updatedData.bedrooms = parseInt(updatedData.bedrooms, 10);
        if (updatedData.bathrooms) updatedData.bathrooms = parseInt(updatedData.bathrooms, 10);
        if (updatedData.area) updatedData.area = parseFloat(updatedData.area);
        if (updatedData.yearBuilt) updatedData.yearBuilt = parseInt(updatedData.yearBuilt, 10);

        const updatedProperty = await prisma.property.update({
            where: { id },
            data: updatedData,
            include: {
                postedBy: {
                    select: {
                        firstName: true,
                        lastName: true,
                        avatarUrl: true,
                        role: true
                    }
                }
            }
        });

        res.status(200).json({
            success: true,
            data: updatedProperty,
            message: "Property updated successfully"
        });

    } catch (error) {
        console.error("Update Property Error:", error);
        res.status(500).json({
            success: false,
            message: "Server error updating property"
        });
    }
};

// Delete property
export const deleteProperty = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userId;
        const userRole = req.userRole;

        const property = await prisma.property.findUnique({
            where: { id }
        });

        if (!property) {
            return res.status(404).json({
                success: false,
                message: "Property not found"
            });
        }

        // Check authorization
        const canDelete = property.postedById === userId || userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';

        if (!canDelete) {
            return res.status(403).json({
                success: false,
                message: "You are not authorized to delete this property"
            });
        }

        await prisma.property.delete({ where: { id } });

        res.status(200).json({
            success: true,
            message: "Property deleted successfully"
        });

    } catch (error) {
        console.error("Delete Property Error:", error);
        res.status(500).json({
            success: false,
            message: "Server error deleting property"
        });
    }
};

// Get similar properties
export const getSimilarProperties = async (req, res) => {
    try {
        const { id } = req.params;
        const { limit = 4 } = req.query;

        const property = await prisma.property.findUnique({
            where: { id },
            select: { type: true, city: true, listingType: true, price: true }
        });

        if (!property) {
            return res.status(404).json({
                success: false,
                message: "Property not found"
            });
        }

        // Find similar properties based on type, city, and price range
        const priceRange = property.price * 0.3; // 30% price variation

        const similarProperties = await prisma.property.findMany({
            where: {
                id: { not: id },
                status: 'AVAILABLE',
                type: property.type,
                listingType: property.listingType,
                city: property.city,
                price: {
                    gte: property.price - priceRange,
                    lte: property.price + priceRange
                }
            },
            take: parseInt(limit, 10),
            orderBy: { createdAt: 'desc' },
            include: {
                postedBy: {
                    select: {
                        firstName: true,
                        lastName: true,
                        avatarUrl: true
                    }
                },
                _count: {
                    select: {
                        views: true,
                        favoritedBy: true
                    }
                }
            }
        });

        res.status(200).json({
            success: true,
            data: similarProperties
        });

    } catch (error) {
        console.error("Similar Properties Error:", error);
        res.status(500).json({
            success: false,
            message: "Server error fetching similar properties"
        });
    }
};