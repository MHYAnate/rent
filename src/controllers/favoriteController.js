import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Add property to favorites
export const addToFavorites = async (req, res) => {
    try {
        const userId = req.userId;
        const { propertyId } = req.body;

        if (!propertyId) {
            return res.status(400).json({
                success: false,
                message: "Property ID is required"
            });
        }

        // Check if property exists
        const property = await prisma.property.findUnique({
            where: { id: propertyId },
            select: { id: true, title: true }
        });

        if (!property) {
            return res.status(404).json({
                success: false,
                message: "Property not found"
            });
        }

        // Check if already favorited
        const existingFavorite = await prisma.favorite.findUnique({
            where: {
                propertyId_userId: {
                    propertyId,
                    userId
                }
            }
        });

        if (existingFavorite) {
            return res.status(409).json({
                success: false,
                message: "Property is already in your favorites"
            });
        }

        // Add to favorites
        const favorite = await prisma.favorite.create({
            data: {
                propertyId,
                userId
            },
            include: {
                property: {
                    select: {
                        id: true,
                        title: true,
                        price: true,
                        city: true,
                        state: true,
                        imageUrls: true,
                        type: true,
                        listingType: true
                    }
                }
            }
        });

        res.status(201).json({
            success: true,
            data: favorite,
            message: "Property added to favorites"
        });

    } catch (error) {
        console.error("Add to Favorites Error:", error);
        res.status(500).json({
            success: false,
            message: "Server error adding to favorites"
        });
    }
};

// Remove property from favorites
export const removeFromFavorites = async (req, res) => {
    try {
        const userId = req.userId;
        const { propertyId } = req.params;

        const favorite = await prisma.favorite.findUnique({
            where: {
                propertyId_userId: {
                    propertyId,
                    userId
                }
            }
        });

        if (!favorite) {
            return res.status(404).json({
                success: false,
                message: "Property not found in favorites"
            });
        }

        await prisma.favorite.delete({
            where: {
                propertyId_userId: {
                    propertyId,
                    userId
                }
            }
        });

        res.status(200).json({
            success: true,
            message: "Property removed from favorites"
        });

    } catch (error) {
        console.error("Remove from Favorites Error:", error);
        res.status(500).json({
            success: false,
            message: "Server error removing from favorites"
        });
    }
};

// Get user's favorite properties
export const getUserFavorites = async (req, res) => {
    try {
        const userId = req.userId;
        const { page = 1, limit = 10 } = req.query;

        const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
        const take = parseInt(limit, 10);

        const [favorites, total] = await Promise.all([
            prisma.favorite.findMany({
                where: { userId },
                skip,
                take,
                orderBy: { createdAt: 'desc' },
                include: {
                    property: {
                        include: {
                            postedBy: {
                                select: {
                                    firstName: true,
                                    lastName: true,
                                    avatarUrl: true
                                }
                            },
                            ratings: {
                                select: { rating: true }
                            },
                            _count: {
                                select: {
                                    views: true,
                                    favoritedBy: true
                                }
                            }
                        }
                    }
                }
            }),
            prisma.favorite.count({ where: { userId } })
        ]);

        // Calculate average ratings for properties
        const favoritesWithRatings = favorites.map(favorite => {
            const property = favorite.property;
            const avgRating = property.ratings.length > 0
                ? property.ratings.reduce((sum, r) => sum + r.rating, 0) / property.ratings.length
                : 0;

            return {
                ...favorite,
                property: {
                    ...property,
                    averageRating: Math.round(avgRating * 10) / 10,
                    totalRatings: property.ratings.length,
                    ratings: undefined
                }
            };
        });

        res.status(200).json({
            success: true,
            data: favoritesWithRatings,
            pagination: {
                total,
                limit: take,
                page: parseInt(page, 10),
                totalPages: Math.ceil(total / take)
            }
        });

    } catch (error) {
        console.error("Get Favorites Error:", error);
        res.status(500).json({
            success: false,
            message: "Server error fetching favorites"
        });
    }
};

// Check if property is favorited by user
export const checkFavoriteStatus = async (req, res) => {
    try {
        const userId = req.userId;
        const { propertyId } = req.params;

        const favorite = await prisma.favorite.findUnique({
            where: {
                propertyId_userId: {
                    propertyId,
                    userId
                }
            }
        });

        res.status(200).json({
            success: true,
            data: {
                isFavorited: !!favorite,
                favoriteId: favorite?.id || null
            }
        });

    } catch (error) {
        console.error("Check Favorite Status Error:", error);
        res.status(500).json({
            success: false,
            message: "Server error checking favorite status"
        });
    }
};