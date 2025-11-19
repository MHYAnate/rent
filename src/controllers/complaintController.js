import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * @desc    Create a new complaint
 * @route   POST /api/complaints
 * @access  Private (Client)
 */
export const createComplaint = async (req, res) => {
    try {
        const { subject, description, propertyId, imageUrls = [] } = req.body;
        const clientId = req.userId;

        // Validation
        if (!subject || !description) {
            return res.status(400).json({
                success: false,
                message: "Subject and description are required"
            });
        }

        // Verify property exists if provided
        if (propertyId) {
            const property = await prisma.property.findUnique({
                where: { id: propertyId }
            });
            
            if (!property) {
                return res.status(404).json({
                    success: false,
                    message: "Property not found"
                });
            }
        }

        // Create complaint
        const complaint = await prisma.complaint.create({
            data: {
                subject,
                description,
                imageUrls,
                propertyId: propertyId || null,
                clientId
            },
            include: {
                property: {
                    select: {
                        id: true,
                        title: true,
                        postedBy: {
                            select: {
                                firstName: true,
                                lastName: true,
                                phone: true
                            }
                        }
                    }
                },
                client: {
                    select: {
                        firstName: true,
                        lastName: true,
                        email: true,
                        phone: true
                    }
                }
            }
        });

        res.status(201).json({
            success: true,
            data: complaint,
            message: "Complaint filed successfully"
        });

    } catch (error) {
        console.error("Create Complaint Error:", error);
        res.status(500).json({
            success: false,
            message: "Server error filing complaint"
        });
    }
};

/**
 * @desc    Get complaints for the current user
 * @route   GET /api/complaints/user
 * @access  Private (Client)
 */
export const getUserComplaints = async (req, res) => {
    try {
        const userId = req.userId;
        const { 
            page = 1, 
            limit = 10, 
            status,
            sortBy = 'createdAt', 
            sortOrder = 'desc' 
        } = req.query;

        const where = { clientId: userId };
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
                    property: {
                        select: {
                            id: true,
                            title: true,
                            imageUrls: true
                        }
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
        console.error("Get User Complaints Error:", error);
        res.status(500).json({
            success: false,
            message: "Server error fetching complaints"
        });
    }
};

/**
 * @desc    Get single complaint by ID for the current user
 * @route   GET /api/complaints/user/:id
 * @access  Private (Client)
 */
export const getComplaintById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userId;

        const complaint = await prisma.complaint.findFirst({
            where: {
                id,
                clientId: userId
            },
            include: {
                property: {
                    select: {
                        id: true,
                        title: true,
                        address: true,
                        city: true,
                        state: true,
                        imageUrls: true,
                        postedBy: {
                            select: {
                                firstName: true,
                                lastName: true,
                                phone: true,
                                email: true
                            }
                        }
                    }
                },
                client: {
                    select: {
                        firstName: true,
                        lastName: true,
                        email: true,
                        phone: true
                    }
                }
            }
        });

        if (!complaint) {
            return res.status(404).json({
                success: false,
                message: "Complaint not found"
            });
        }

        res.status(200).json({
            success: true,
            data: complaint
        });

    } catch (error) {
        console.error("Get Complaint Error:", error);
        res.status(500).json({
            success: false,
            message: "Server error fetching complaint"
        });
    }
};

/**
 * @desc    Update a complaint (only by the owner and only if pending)
 * @route   PUT /api/complaints/user/:id
 * @access  Private (Client)
 */
export const updateComplaint = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userId;
        const { subject, description, imageUrls } = req.body;

        // Check if complaint exists and belongs to user
        const existingComplaint = await prisma.complaint.findFirst({
            where: {
                id,
                clientId: userId
            }
        });

        if (!existingComplaint) {
            return res.status(404).json({
                success: false,
                message: "Complaint not found"
            });
        }

        // Only allow updates for pending complaints
        if (existingComplaint.status !== 'PENDING') {
            return res.status(400).json({
                success: false,
                message: "Only pending complaints can be updated"
            });
        }

        const updatedComplaint = await prisma.complaint.update({
            where: { id },
            data: {
                ...(subject && { subject }),
                ...(description && { description }),
                ...(imageUrls && { imageUrls }),
                updatedAt: new Date()
            },
            include: {
                property: {
                    select: {
                        id: true,
                        title: true
                    }
                }
            }
        });

        res.status(200).json({
            success: true,
            data: updatedComplaint,
            message: "Complaint updated successfully"
        });

    } catch (error) {
        console.error("Update Complaint Error:", error);
        res.status(500).json({
            success: false,
            message: "Server error updating complaint"
        });
    }
};

/**
 * @desc    Delete a complaint (only by the owner and only if pending)
 * @route   DELETE /api/complaints/user/:id
 * @access  Private (Client)
 */
export const deleteComplaint = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userId;

        // Check if complaint exists and belongs to user
        const existingComplaint = await prisma.complaint.findFirst({
            where: {
                id,
                clientId: userId
            }
        });

        if (!existingComplaint) {
            return res.status(404).json({
                success: false,
                message: "Complaint not found"
            });
        }

        // Only allow deletion for pending complaints
        if (existingComplaint.status !== 'PENDING') {
            return res.status(400).json({
                success: false,
                message: "Only pending complaints can be deleted"
            });
        }

        await prisma.complaint.delete({
            where: { id }
        });

        res.status(200).json({
            success: true,
            message: "Complaint deleted successfully"
        });

    } catch (error) {
        console.error("Delete Complaint Error:", error);
        res.status(500).json({
            success: false,
            message: "Server error deleting complaint"
        });
    }
};

/**
 * @desc    Get complaints for a specific property
 * @route   GET /api/complaints/property/:propertyId
 * @access  Private (Property Owner/Agent/Admin)
 */
// export const getPropertyComplaints = async (req, res) => {
//     try {
//         const { propertyId } = req.params;
//         const userId = req.userId;
//         const userRole = req.userRole;

//         // Verify property exists and user has access
//         const property = await prisma.property.findUnique({
//             where: { id: propertyId },
//             include: {
//                 postedBy: true,
//                 managedByAgent: true
//             }
//         });

//         if (!property) {
//             return res.status(404).json({
//                 success: false,
//                 message: "Property not found"
//             });
//         }

//         // Check authorization - property owner, managing agent, or admin
//         const isAuthorized = 
//             property.postedById === userId ||
//             property.managedByAgentId === userId ||
//             ['ADMIN', 'SUPER_ADMIN'].includes(userRole);

//         if (!isAuthorized) {
//             return res.status(403).json({
//                 success: false,
//                 message: "Not authorized to view complaints for this property"
//             });
//         }

//         const complaints = await prisma.complaint.findMany({
//             where: { propertyId },
//             include: {
//                 client: {
//                     select: {
//                         firstName: true,
//                         lastName: true,
//                         email: true,
//                         phone: true
//                     }
//                 }
//             },
//             orderBy: { createdAt: 'desc' }
//         });

//         res.status(200).json({
//             success: true,
//             data: complaints
//         });

//     } catch (error) {
//         console.error("Get Property Complaints Error:", error);
//         res.status(500).json({
//             success: false,
//             message: "Server error fetching property complaints"
//         });
//     }
// };
export const getPropertyComplaints = async (req, res) => {
    try {
        const { propertyId } = req.params;
        const { page = 1, limit = 10, status } = req.query;

        const where = { propertyId };
        if (status && status !== 'ALL') {
            where.status = status;
        }

        const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
        const take = parseInt(limit, 10);

        // Fetch both complaints and total count
        const [complaints, total] = await Promise.all([
            prisma.complaint.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: 'desc' },
                include: {
                    client: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true,
                            phone: true
                        }
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
        console.error("Get Property Complaints Error:", error);
        res.status(500).json({
            success: false,
            message: "Server error fetching property complaints",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
/**
 * @desc    Get comprehensive complaint statistics for admin dashboard
 * @route   GET /api/admin/complaints/stats
 * @access  Private (Admin)
 */
export const getComplaintStats = async (req, res) => {
  try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

      // Define all possible complaint statuses
      const ALL_COMPLAINT_STATUS = ['PENDING', 'IN_REVIEW', 'RESOLVED', 'REJECTED'];

      // Fetch all complaint statistics in parallel
      const [
          totalComplaints,
          complaintsByStatus,
          complaintsByPeriod,
          recentComplaintsTrend,
          complaintsWithProperties,
          topComplainedProperties,
          averageResolutionTime,
          complaintResolutionRate
      ] = await Promise.all([
          // Total complaints count
          prisma.complaint.count().catch(() => 0),

          // Complaints grouped by status
          prisma.complaint.groupBy({
              by: ['status'],
              _count: { status: true },
          }).catch(() => []),

          // Complaints by time period
          Promise.all([
              // Last 7 days
              prisma.complaint.count({
                  where: {
                      createdAt: {
                          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                      }
                  }
              }).catch(() => 0),
              // Last 30 days
              prisma.complaint.count({
                  where: {
                      createdAt: {
                          gte: thirtyDaysAgo
                      }
                  }
              }).catch(() => 0),
              // Previous 30 days (for comparison)
              prisma.complaint.count({
                  where: {
                      createdAt: {
                          gte: sixtyDaysAgo,
                          lt: thirtyDaysAgo
                      }
                  }
              }).catch(() => 0)
          ]),

          // Recent complaints trend (last 30 days)
          prisma.complaint.findMany({
              where: {
                  createdAt: {
                      gte: thirtyDaysAgo
                  }
              },
              select: {
                  createdAt: true,
                  status: true
              }
          }).then(complaints => {
              const trends = {};
              complaints.forEach(complaint => {
                  const date = complaint.createdAt.toISOString().split('T')[0];
                  if (!trends[date]) {
                      trends[date] = { total: 0, byStatus: {} };
                  }
                  trends[date].total++;
                  trends[date].byStatus[complaint.status] = (trends[date].byStatus[complaint.status] || 0) + 1;
              });
              return Object.entries(trends).map(([date, data]) => ({
                  date,
                  total: data.total,
                  byStatus: data.byStatus
              })).sort((a, b) => a.date.localeCompare(b.date));
          }).catch(() => []),

          // Complaints with property association
          prisma.complaint.groupBy({
              by: ['propertyId'],
              where: {
                  propertyId: { not: null }
              },
              _count: { propertyId: true },
          }).then(results => {
              const withProperty = results.filter(r => r.propertyId).length;
              const withoutProperty = results.filter(r => !r.propertyId).length;
              return { withProperty, withoutProperty };
          }).catch(() => ({ withProperty: 0, withoutProperty: 0 })),

          // Top complained properties
          prisma.complaint.groupBy({
              by: ['propertyId'],
              where: {
                  propertyId: { not: null }
              },
              _count: { propertyId: true },
              orderBy: {
                  _count: {
                      propertyId: 'desc'
                  }
              },
              take: 10
          }).then(async results => {
              const propertyDetails = await Promise.all(
                  results.map(async (item) => {
                      const property = await prisma.property.findUnique({
                          where: { id: item.propertyId },
                          select: {
                              id: true,
                              title: true,
                              city: true,
                              state: true,
                              postedBy: {
                                  select: {
                                      firstName: true,
                                      lastName: true
                                  }
                              }
                          }
                      }).catch(() => null);
                      
                      return {
                          propertyId: item.propertyId,
                          complaintCount: item._count.propertyId,
                          property: property || { title: 'Unknown Property' }
                      };
                  })
              );
              return propertyDetails.filter(item => item.property);
          }).catch(() => []),

          // Average resolution time for resolved complaints
          prisma.complaint.findMany({
              where: {
                  status: 'RESOLVED',
                  resolvedAt: { not: null },
                  createdAt: { not: null }
              },
              select: {
                  createdAt: true,
                  resolvedAt: true
              }
          }).then(complaints => {
              if (complaints.length === 0) return 0;
              
              const totalResolutionTime = complaints.reduce((total, complaint) => {
                  const resolutionTime = complaint.resolvedAt - complaint.createdAt;
                  return total + resolutionTime;
              }, 0);
              
              return Math.round(totalResolutionTime / complaints.length / (1000 * 60 * 60 * 24)); // Convert to days
          }).catch(() => 0),

          // Complaint resolution rate
          prisma.complaint.groupBy({
              by: ['status'],
              _count: { status: true },
          }).then(results => {
              const total = results.reduce((sum, item) => sum + item._count.status, 0);
              const resolved = results.find(item => item.status === 'RESOLVED')?._count.status || 0;
              return total > 0 ? Math.round((resolved / total) * 100) : 0;
          }).catch(() => 0)
      ]);

      // Process complaints by status with all possible statuses
      const statusCounts = {};
      ALL_COMPLAINT_STATUS.forEach(status => {
          statusCounts[status] = 0;
      });

      complaintsByStatus.forEach(item => {
          if (item.status && statusCounts.hasOwnProperty(item.status)) {
              statusCounts[item.status] = item._count.status;
          }
      });

      // Calculate period comparisons
      const [last7Days, last30Days, previous30Days] = complaintsByPeriod;
      const thirtyDayChange = previous30Days > 0 
          ? Math.round(((last30Days - previous30Days) / previous30Days) * 100)
          : 0;

      // Prepare response data
      const statsData = {
          overview: {
              total: totalComplaints,
              pending: statusCounts.PENDING,
              inReview: statusCounts.IN_REVIEW,
              resolved: statusCounts.RESOLVED,
              rejected: statusCounts.REJECTED
          },
          trends: {
              last7Days,
              last30Days,
              previous30Days,
              thirtyDayChange,
              dailyTrends: recentComplaintsTrend
          },
          analysis: {
              resolutionRate: complaintResolutionRate,
              averageResolutionDays: averageResolutionTime,
              withProperty: complaintsWithProperties.withProperty,
              withoutProperty: complaintsWithProperties.withoutProperty,
              propertyAssociationRate: totalComplaints > 0 
                  ? Math.round((complaintsWithProperties.withProperty / totalComplaints) * 100)
                  : 0
          },
          topComplainedProperties: topComplainedProperties,
          statusDistribution: statusCounts
      };

      res.status(200).json({
          success: true,
          data: statsData
      });

  } catch (error) {
      console.error("Get Complaint Stats Error:", error);
      res.status(500).json({
          success: false,
          message: "Server error fetching complaint statistics",
          error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
  }
};

/**
 * @desc    Get all complaints (Admin only)
 * @route   GET /api/admin/complaints
 * @access  Private (Admin)
 */
export const getAllComplaints = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            status,
            search,
            propertyId,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        const where = {};

        if (status) where.status = status;
        if (propertyId) where.propertyId = propertyId;
        
        if (search) {
            where.OR = [
                { subject: { contains: search, mode: 'insensitive' } },
                { 
                    client: {
                        OR: [
                            { firstName: { contains: search, mode: 'insensitive' } },
                            { lastName: { contains: search, mode: 'insensitive' } },
                            { email: { contains: search, mode: 'insensitive' } }
                        ]
                    }
                }
            ];
        }

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
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true,
                            phone: true
                        }
                    },
                    property: {
                        select: {
                            id: true,
                            title: true,
                            address: true,
                            city: true,
                            state: true,
                            postedBy: {
                                select: {
                                    firstName: true,
                                    lastName: true
                                }
                            }
                        }
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
        res.status(500).json({
            success: false,
            message: "Server error fetching complaints"
        });
    }
};