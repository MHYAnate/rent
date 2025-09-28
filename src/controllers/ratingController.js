import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Add or update rating for a property
export const addRating = async (req, res) => {
    try {
        const userId = req.userId;
        const { propertyId, rating, comment } = req.body;

        if (!propertyId || !rating) {
            return res.status(400).json({
                success: false,
                message: "Property ID and rating are required"
            });
        }

        if (rating < 1 || rating > 5) {
            return res.status(400).json({
                success: false,
                message: "Rating must be between 1 and 5"
            });
        }

        // Check if property exists
        const property = await prisma.property.findUnique({
            where: { id: propertyId },
            select: { id: true, title: true, postedById: true }
        });

        if (!property) {
            return res.status(404).json({
                success: false,
                message: "Property not found"
            });
        }

        // Users cannot rate their own properties
        if (property.postedById === userId) {
            return res.status(403).json({
                success: false,
                message: "You cannot rate your own property"
            });
        }

        // Check if user already rated this property
        const existingRating = await prisma.rating.findUnique({
            where: {
                propertyId_clientId: {
                    propertyId,
                    clientId: userId
                }
            }
        });

        let result;
        if (existingRating) {
            // Update existing rating
            result = await prisma.rating.update({
                where: {
                    propertyId_clientId: {
                        propertyId,
                        clientId: userId
                    }
                },
                data: {
                    rating: parseInt(rating, 10),
                    comment: comment || null
                },
                include: {
                    client: {
                        select: {
                            firstName: true,
                            lastName: true,
                            avatarUrl: true
                        }
                    }
                }
            });
        } else {
            // Create new rating
            result = await prisma.rating.create({
                data: {
                    propertyId,
                    clientId: userId,
                    rating: parseInt(rating, 10),
                    comment: comment || null
                },
                include: {
                    client: {
                        select: {
                            firstName: true,
                            lastName: true,
                            avatarUrl: true
                        }
                    }
                }
            });
        }

        res.status(existingRating ? 200 : 201).json({
            success: true,
            data: result,
            message: existingRating ? "Rating updated successfully" : "Rating added successfully"
        });

    } catch (error) {
        console.error("Add Rating Error:", error);
        res.status(500).json({
            success: false,
            message: "Server error adding rating"
        });
    }
};

// Get ratings for a property
export const getPropertyRatings = async (req, res) => {
    try {
        const { propertyId } = req.params;
        const { page = 1, limit = 10 } = req.query;

        const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
        const take = parseInt(limit, 10);

        const [ratings, total, avgRating] = await Promise.all([
            prisma.rating.findMany({
                where: { propertyId },
                skip,
                take,
                orderBy: { createdAt: 'desc' },
                include: {
                    client: {
                        select: {
                            firstName: true,
                            lastName: true,
                            avatarUrl: true
                        }
                    }
                }
            }),
            prisma.rating.count({ where: { propertyId } }),
            prisma.rating.aggregate({
                where: { propertyId },
                _avg: { rating: true },
                _count: { rating: true }
            })
        ]);

        // Calculate rating distribution
        const ratingDistribution = await prisma.rating.groupBy({
            by: ['rating'],
            where: { propertyId },
            _count: { rating: true }
        });

        const distribution = [1, 2, 3, 4, 5].map(star => {
            const found = ratingDistribution.find(d => d.rating === star);
            return {
                rating: star,
                count: found ? found._count.rating : 0
            };
        });

        res.status(200).json({
            success: true,
            data: {
                ratings,
                summary: {
                    averageRating: avgRating._avg.rating ? Math.round(avgRating._avg.rating * 10) / 10 : 0,
                    totalRatings: avgRating._count.rating,
                    distribution
                },
                pagination: {
                    total,
                    limit: take,
                    page: parseInt(page, 10),
                    totalPages: Math.ceil(total / take)
                }
            }
        });

    } catch (error) {
        console.error("Get Property Ratings Error:", error);
        res.status(500).json({
            success: false,
            message: "Server error fetching ratings"
        });
    }
};

// Delete a rating
export const deleteRating = async (req, res) => {
    try {
        const userId = req.userId;
        const userRole = req.userRole;
        const { ratingId } = req.params;

        const rating = await prisma.rating.findUnique({
            where: { id: ratingId },
            include: {
                client: {
                    select: { id: true }
                }
            }
        });

        if (!rating) {
            return res.status(404).json({
                success: false,
                message: "Rating not found"
            });
        }

        // Only the rating author or admin can delete
        if (rating.clientId !== userId && userRole !== 'ADMIN') {
            return res.status(403).json({
                success: false,
                message: "You are not authorized to delete this rating"
            });
        }

        await prisma.rating.delete({
            where: { id: ratingId }
        });

        res.status(200).json({
            success: true,
            message: "Rating deleted successfully"
        });

    } catch (error) {
        console.error("Delete Rating Error:", error);
        res.status(500).json({
            success: false,
            message: "Server error deleting rating"
        });
    }
};

// Get user's ratings
export const getUserRatings = async (req, res) => {
    try {
        const userId = req.userId;
        const { page = 1, limit = 10 } = req.query;

        const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
        const take = parseInt(limit, 10);

        const [ratings, total] = await Promise.all([
            prisma.rating.findMany({
                where: { clientId: userId },
                skip,
                take,
                orderBy: { createdAt: 'desc' },
                include: {
                    property: {
                        select: {
                            id: true,
                            title: true,
                            imageUrls: true,
                            city: true,
                            state: true,
                            price: true,
                            type: true
                        }
                    }
                }
            }),
            prisma.rating.count({ where: { clientId: userId } })
        ]);

        res.status(200).json({
            success: true,
            data: ratings,
            pagination: {
                total,
                limit: take,
                page: parseInt(page, 10),
                totalPages: Math.ceil(total / take)
            }
        });

    } catch (error) {
        console.error("Get User Ratings Error:", error);
        res.status(500).json({
            success: false,
            message: "Server error fetching user ratings"
        });
    }
};