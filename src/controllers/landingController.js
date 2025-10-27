// import { PrismaClient } from "@prisma/client";

// const prisma = new PrismaClient();

// // Landing Page Controller - Get properties and metrics
// export const getLandingPageData = async (req, res) => {
//     try {
//         // Get query parameters for filtering
//         const {
//             page = 1,
//             limit = 12,
//             sortBy = 'createdAt',
//             sortOrder = 'desc',
//             listingType,
//             propertyType,
//             city,
//             state,
//             minPrice,
//             maxPrice,
//             bedrooms,
//             bathrooms,
//             amenities,
//             search,
//             isFeatured
//         } = req.query;

//         // Build dynamic where clause
//         const where = {
//             status: 'AVAILABLE'
//         };

//         if (listingType) where.listingType = listingType;
//         if (propertyType) where.type = propertyType;
//         if (city) where.city = { contains: city, mode: 'insensitive' };
//         if (state) where.state = { contains: state, mode: 'insensitive' };
//         if (isFeatured !== undefined) where.isFeatured = isFeatured === 'true';

//         // Price range filter
//         if (minPrice || maxPrice) {
//             where.price = {};
//             if (minPrice) where.price.gte = parseFloat(minPrice);
//             if (maxPrice) where.price.lte = parseFloat(maxPrice);
//         }

//         // Bedroom and bathroom filters
//         if (bedrooms) where.bedrooms = { gte: parseInt(bedrooms, 10) };
//         if (bathrooms) where.bathrooms = { gte: parseInt(bathrooms, 10) };

//         // Amenities filter
//         if (amenities) {
//             const amenityList = amenities.split(',').map(a => a.trim());
//             where.amenities = { hasSome: amenityList };
//         }

//         // Search filter (title, description, address)
//         if (search) {
//             where.OR = [
//                 { title: { contains: search, mode: 'insensitive' } },
//                 { description: { contains: search, mode: 'insensitive' } },
//                 { address: { contains: search, mode: 'insensitive' } }
//             ];
//         }

//         // Pagination and sorting
//         const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
//         const take = parseInt(limit, 10);
//         const orderBy = { [sortBy]: sortOrder };

//         // Execute queries concurrently for better performance
//         const [
//             properties,
//             totalProperties,
//             featuredProperties,
//             metrics
//         ] = await Promise.all([
//             // Get paginated properties
//             prisma.property.findMany({
//                 where,
//                 skip,
//                 take,
//                 orderBy,
//                 include: {
//                     postedBy: {
//                         select: {
//                             firstName: true,
//                             lastName: true,
//                             avatarUrl: true,
//                             role: true
//                         }
//                     },
//                     managedByAgent: {
//                         select: {
//                             firstName: true,
//                             lastName: true,
//                             avatarUrl: true
//                         }
//                     },
//                     ratings: {
//                         select: {
//                             rating: true
//                         }
//                     },
//                     _count: {
//                         select: {
//                             views: true,
//                             favoritedBy: true
//                         }
//                     }
//                 }
//             }),
            
//             // Get total count for pagination
//             prisma.property.count({ where }),
            
//             // Get featured properties for homepage showcase
//             prisma.property.findMany({
//                 where: { isFeatured: true, status: 'AVAILABLE' },
//                 take: 6,
//                 orderBy: { createdAt: 'desc' },
//                 include: {
//                     postedBy: {
//                         select: { firstName: true, lastName: true, avatarUrl: true }
//                     },
//                     ratings: {
//                         select: { rating: true }
//                     }
//                 }
//             }),
            
//             // Get platform metrics
//             getMetrics()
//         ]);

//         // Calculate average ratings for properties
//         const propertiesWithRatings = properties.map(property => {
//             const avgRating = property.ratings.length > 0
//                 ? property.ratings.reduce((sum, r) => sum + r.rating, 0) / property.ratings.length
//                 : 0;
            
//             return {
//                 ...property,
//                 averageRating: Math.round(avgRating * 10) / 10,
//                 totalRatings: property.ratings.length,
//                 ratings: undefined // Remove ratings array from response
//             };
//         });

//         const featuredWithRatings = featuredProperties.map(property => {
//             const avgRating = property.ratings.length > 0
//                 ? property.ratings.reduce((sum, r) => sum + r.rating, 0) / property.ratings.length
//                 : 0;
            
//             return {
//                 ...property,
//                 averageRating: Math.round(avgRating * 10) / 10,
//                 totalRatings: property.ratings.length,
//                 ratings: undefined
//             };
//         });

//         res.status(200).json({
//             success: true,
//             data: {
//                 properties: propertiesWithRatings,
//                 featuredProperties: featuredWithRatings,
//                 metrics,
//                 pagination: {
//                     total: totalProperties,
//                     limit: take,
//                     page: parseInt(page, 10),
//                     totalPages: Math.ceil(totalProperties / take)
//                 }
//             }
//         });

//     } catch (error) {
//         console.error("Landing Page Data Error:", error);
//         res.status(500).json({
//             success: false,
//             message: "Server error fetching landing page data",
//             error: process.env.NODE_ENV === 'development' ? error.message : undefined
//         });
//     }
// };

// // Helper function to get platform metrics
// const getMetrics = async () => {
//     try {
//         const [
//             totalProperties,
//             availableProperties,
//             featuredProperties,
//             totalUsers,
//             totalLandlords,
//             totalAgents,
//             totalViews,
//             avgPrice,
//             topCities,
//             recentActivity
//         ] = await Promise.all([
//             prisma.property.count(),
//             prisma.property.count({ where: { status: 'AVAILABLE' } }),
//             prisma.property.count({ where: { isFeatured: true } }),
//             prisma.user.count(),
//             prisma.user.count({ where: { role: 'LANDLORD' } }),
//             prisma.user.count({ where: { role: 'AGENT' } }),
//             prisma.propertyView.count(),
//             prisma.property.aggregate({
//                 _avg: { price: true },
//                 where: { status: 'AVAILABLE' }
//             }),
//             prisma.property.groupBy({
//                 by: ['city'],
//                 _count: { city: true },
//                 orderBy: { _count: { city: 'desc' } },
//                 take: 5
//             }),
//             prisma.property.findMany({
//                 take: 5,
//                 orderBy: { createdAt: 'desc' },
//                 select: {
//                     id: true,
//                     title: true,
//                     city: true,
//                     price: true,
//                     createdAt: true,
//                     postedBy: {
//                         select: { firstName: true, lastName: true }
//                     }
//                 }
//             })
//         ]);

//         return {
//             totalProperties,
//             availableProperties,
//             featuredProperties,
//             totalUsers,
//             totalLandlords,
//             totalAgents,
//             totalViews,
//             averagePrice: avgPrice._avg.price || 0,
//             topCities: topCities.map(city => ({
//                 city: city.city,
//                 count: city._count.city
//             })),
//             recentActivity
//         };
//     } catch (error) {
//         console.error("Metrics Error:", error);
//         return {
//             totalProperties: 0,
//             availableProperties: 0,
//             featuredProperties: 0,
//             totalUsers: 0,
//             totalLandlords: 0,
//             totalAgents: 0,
//             totalViews: 0,
//             averagePrice: 0,
//             topCities: [],
//             recentActivity: []
//         };
//     }
// };

// // Get search suggestions for autocomplete
// export const getSearchSuggestions = async (req, res) => {
//     try {
//         const { query, type = 'all' } = req.query;

//         if (!query || query.length < 2) {
//             return res.status(200).json({ success: true, data: [] });
//         }

//         let suggestions = [];

//         if (type === 'all' || type === 'location') {
//             // Get city suggestions
//             const cities = await prisma.property.findMany({
//                 where: {
//                     OR: [
//                         { city: { contains: query, mode: 'insensitive' } },
//                         { state: { contains: query, mode: 'insensitive' } }
//                     ],
//                     status: 'AVAILABLE'
//                 },
//                 select: { city: true, state: true },
//                 distinct: ['city', 'state'],
//                 take: 5
//             });

//             suggestions.push(...cities.map(item => ({
//                 type: 'location',
//                 value: `${item.city}, ${item.state}`,
//                 label: `${item.city}, ${item.state}`
//             })));
//         }

//         if (type === 'all' || type === 'property') {
//             // Get property title suggestions
//             const properties = await prisma.property.findMany({
//                 where: {
//                     title: { contains: query, mode: 'insensitive' },
//                     status: 'AVAILABLE'
//                 },
//                 select: { id: true, title: true, city: true },
//                 take: 5
//             });

//             suggestions.push(...properties.map(property => ({
//                 type: 'property',
//                 value: property.id,
//                 label: property.title,
//                 subtitle: property.city
//             })));
//         }

//         res.status(200).json({
//             success: true,
//             data: suggestions.slice(0, 10) // Limit total suggestions
//         });

//     } catch (error) {
//         console.error("Search Suggestions Error:", error);
//         res.status(500).json({
//             success: false,
//             message: "Error fetching search suggestions"
//         });
//     }
// };

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Landing Page Controller - Get properties and metrics
export const getLandingPageData = async (req, res) => {
    try {
        // Get query parameters for filtering
        const {
            page = 1,
            limit = 12,
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
            isFeatured
        } = req.query;

        // Build dynamic where clause
        const where = {
            status: 'AVAILABLE'
        };

        if (listingType) where.listingType = listingType;
        if (propertyType) where.type = propertyType;
        if (city) where.city = { contains: city, mode: 'insensitive' };
        if (state) where.state = { contains: state, mode: 'insensitive' };
        if (isFeatured !== undefined) where.isFeatured = isFeatured === 'true';

        // Price range filter
        if (minPrice || maxPrice) {
            where.price = {};
            if (minPrice) where.price.gte = parseFloat(minPrice);
            if (maxPrice) where.price.lte = parseFloat(maxPrice);
        }

        // Bedroom and bathroom filters
        if (bedrooms) where.bedrooms = { gte: parseInt(bedrooms, 10) };
        if (bathrooms) where.bathrooms = { gte: parseInt(bathrooms, 10) };

        // Amenities filter
        if (amenities) {
            const amenityList = amenities.split(',').map(a => a.trim());
            where.amenities = { hasSome: amenityList };
        }

        // Search filter (title, description, address)
        if (search) {
            where.OR = [
                { title: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
                { address: { contains: search, mode: 'insensitive' } }
            ];
        }

        // Pagination and sorting
        const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
        const take = parseInt(limit, 10);
        const orderBy = { [sortBy]: sortOrder };

        // Execute queries concurrently for better performance
        const [
            properties,
            totalProperties,
            featuredProperties,
            metrics
        ] = await Promise.all([
            // Get paginated properties
            prisma.property.findMany({
                where,
                skip,
                take,
                orderBy,
                include: {
                    postedBy: {
                        select: {
                            firstName: true,
                            lastName: true,
                            avatarUrl: true,
                            role: true
                        }
                    },
                    managedByAgent: {
                        select: {
                            firstName: true,
                            lastName: true,
                            avatarUrl: true
                        }
                    },
                    ratings: {
                        select: {
                            rating: true
                        }
                    },
                    _count: {
                        select: {
                            views: true,
                            favoritedBy: true
                        }
                    }
                }
            }),
            
            // Get total count for pagination
            prisma.property.count({ where }),
            
            // Get featured properties for homepage showcase - UPDATED TO MATCH MAIN PROPERTIES STRUCTURE
            prisma.property.findMany({
                where: { isFeatured: true, status: 'AVAILABLE' },
                take: 6,
                orderBy: { createdAt: 'desc' },
                include: {
                    postedBy: {
                        select: { 
                            firstName: true, 
                            lastName: true, 
                            avatarUrl: true,
                            role: true  // Added role to match main properties
                        }
                    },
                    managedByAgent: {  // Added managedByAgent to match main properties
                        select: {
                            firstName: true,
                            lastName: true,
                            avatarUrl: true
                        }
                    },
                    ratings: {
                        select: { 
                            rating: true 
                        }
                    },
                    _count: {  // Added _count to get views and favoritedBy counts
                        select: {
                            views: true,
                            favoritedBy: true
                        }
                    }
                }
            }),
            
            // Get platform metrics
            getMetrics()
        ]);

        // Calculate average ratings for properties
        const propertiesWithRatings = properties.map(property => {
            const avgRating = property.ratings.length > 0
                ? property.ratings.reduce((sum, r) => sum + r.rating, 0) / property.ratings.length
                : 0;
            
            return {
                ...property,
                averageRating: Math.round(avgRating * 10) / 10,
                totalRatings: property.ratings.length,
                ratings: undefined // Remove ratings array from response
            };
        });

        // Process featured properties the same way as main properties
        const featuredWithRatings = featuredProperties.map(property => {
            const avgRating = property.ratings.length > 0
                ? property.ratings.reduce((sum, r) => sum + r.rating, 0) / property.ratings.length
                : 0;
            
            return {
                ...property,
                averageRating: Math.round(avgRating * 10) / 10,
                totalRatings: property.ratings.length,
                ratings: undefined // Remove ratings array from response
            };
        });

        res.status(200).json({
            success: true,
            data: {
                properties: propertiesWithRatings,
                featuredProperties: featuredWithRatings,
                metrics,
                pagination: {
                    total: totalProperties,
                    limit: take,
                    page: parseInt(page, 10),
                    totalPages: Math.ceil(totalProperties / take)
                }
            }
        });

    } catch (error) {
        console.error("Landing Page Data Error:", error);
        res.status(500).json({
            success: false,
            message: "Server error fetching landing page data",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Helper function to get platform metrics (unchanged)
const getMetrics = async () => {
    try {
        const [
            totalProperties,
            availableProperties,
            featuredProperties,
            totalUsers,
            totalLandlords,
            totalAgents,
            totalViews,
            avgPrice,
            topCities,
            recentActivity
        ] = await Promise.all([
            prisma.property.count(),
            prisma.property.count({ where: { status: 'AVAILABLE' } }),
            prisma.property.count({ where: { isFeatured: true } }),
            prisma.user.count(),
            prisma.user.count({ where: { role: 'LANDLORD' } }),
            prisma.user.count({ where: { role: 'AGENT' } }),
            prisma.propertyView.count(),
            prisma.property.aggregate({
                _avg: { price: true },
                where: { status: 'AVAILABLE' }
            }),
            prisma.property.groupBy({
                by: ['city'],
                _count: { city: true },
                orderBy: { _count: { city: 'desc' } },
                take: 5
            }),
            prisma.property.findMany({
                take: 5,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    title: true,
                    city: true,
                    price: true,
                    createdAt: true,
                    postedBy: {
                        select: { firstName: true, lastName: true }
                    }
                }
            })
        ]);

        return {
            totalProperties,
            availableProperties,
            featuredProperties,
            totalUsers,
            totalLandlords,
            totalAgents,
            totalViews,
            averagePrice: avgPrice._avg.price || 0,
            topCities: topCities.map(city => ({
                city: city.city,
                count: city._count.city
            })),
            recentActivity
        };
    } catch (error) {
        console.error("Metrics Error:", error);
        return {
            totalProperties: 0,
            availableProperties: 0,
            featuredProperties: 0,
            totalUsers: 0,
            totalLandlords: 0,
            totalAgents: 0,
            totalViews: 0,
            averagePrice: 0,
            topCities: [],
            recentActivity: []
        };
    }
};

// Get search suggestions for autocomplete (unchanged)
export const getSearchSuggestions = async (req, res) => {
    try {
        const { query, type = 'all' } = req.query;

        if (!query || query.length < 2) {
            return res.status(200).json({ success: true, data: [] });
        }

        let suggestions = [];

        if (type === 'all' || type === 'location') {
            // Get city suggestions
            const cities = await prisma.property.findMany({
                where: {
                    OR: [
                        { city: { contains: query, mode: 'insensitive' } },
                        { state: { contains: query, mode: 'insensitive' } }
                    ],
                    status: 'AVAILABLE'
                },
                select: { city: true, state: true },
                distinct: ['city', 'state'],
                take: 5
            });

            suggestions.push(...cities.map(item => ({
                type: 'location',
                value: `${item.city}, ${item.state}`,
                label: `${item.city}, ${item.state}`
            })));
        }

        if (type === 'all' || type === 'property') {
            // Get property title suggestions
            const properties = await prisma.property.findMany({
                where: {
                    title: { contains: query, mode: 'insensitive' },
                    status: 'AVAILABLE'
                },
                select: { id: true, title: true, city: true },
                take: 5
            });

            suggestions.push(...properties.map(property => ({
                type: 'property',
                value: property.id,
                label: property.title,
                subtitle: property.city
            })));
        }

        res.status(200).json({
            success: true,
            data: suggestions.slice(0, 10) // Limit total suggestions
        });

    } catch (error) {
        console.error("Search Suggestions Error:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching search suggestions"
        });
    }
};