// controllers/pushController.js
import webpush from 'web-push';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Configure webpush
webpush.setVapidDetails(
  process.env.VAPID_EMAIL,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// // Subscribe user to push notifications
// export const subscribeToPush = async (req, res) => {
//   try {
//     const { subscription, userId } = req.body;
//     const { endpoint, keys } = subscription;

//     if (!endpoint || !keys || !keys.auth || !keys.p256dh) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid subscription data"
//       });
//     }

//     // Check if subscription already exists
//     const existingSubscription = await prisma.pushSubscription.findUnique({
//       where: { endpoint }
//     });

//     if (existingSubscription) {
//       return res.status(200).json({
//         success: true,
//         message: "Already subscribed to push notifications"
//       });
//     }

//     // Create new subscription
//     await prisma.pushSubscription.create({
//       data: {
//         endpoint,
//         auth: keys.auth,
//         p256dh: keys.p256dh,
//         userId: userId || null
//       }
//     });

//     res.status(201).json({
//       success: true,
//       message: "Subscribed to push notifications successfully"
//     });

//   } catch (error) {
//     console.error("Push subscription error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Server error during push subscription"
//     });
//   }
// };

// // Unsubscribe user from push notifications
// export const unsubscribeFromPush = async (req, res) => {
//   try {
//     const { endpoint } = req.body;

//     if (!endpoint) {
//       return res.status(400).json({
//         success: false,
//         message: "Endpoint is required"
//       });
//     }

//     await prisma.pushSubscription.delete({
//       where: { endpoint }
//     });

//     res.status(200).json({
//       success: true,
//       message: "Unsubscribed from push notifications successfully"
//     });

//   } catch (error) {
//     console.error("Push unsubscribe error:", error);
//     // If subscription not found, still return success
//     if (error.code === 'P2025') {
//       return res.status(200).json({
//         success: true,
//         message: "Already unsubscribed"
//       });
//     }
//     res.status(500).json({
//       success: false,
//       message: "Server error during push unsubscription"
//     });
//   }
// };

// // Send notification to all users
// export const broadcastNotification = async (req, res) => {
//   try {
//     const { title, body, icon, data } = req.body;

//     if (!title || !body) {
//       return res.status(400).json({
//         success: false,
//         message: "Title and body are required"
//       });
//     }

//     const subscriptions = await prisma.pushSubscription.findMany();
    
//     const payload = JSON.stringify({
//       title,
//       body,
//       icon: icon || '/icon-192x192.png',
//       data: data || {}
//     });

//     const results = [];
//     const failedSubscriptions = [];

//     for (const subscription of subscriptions) {
//       try {
//         const pushSubscription = {
//           endpoint: subscription.endpoint,
//           keys: {
//             auth: subscription.auth,
//             p256dh: subscription.p256dh
//           }
//         };

//         await webpush.sendNotification(pushSubscription, payload);
//         results.push({ endpoint: subscription.endpoint, status: 'success' });
        
//       } catch (error) {
//         console.error(`Failed to send to ${subscription.endpoint}:`, error);
        
//         // Remove invalid subscriptions
//         if (error.statusCode === 410) {
//           failedSubscriptions.push(subscription.endpoint);
//         }
        
//         results.push({ 
//           endpoint: subscription.endpoint, 
//           status: 'failed', 
//           error: error.message 
//         });
//       }
//     }

//     // Clean up failed subscriptions
//     if (failedSubscriptions.length > 0) {
//       await prisma.pushSubscription.deleteMany({
//         where: {
//           endpoint: { in: failedSubscriptions }
//         }
//       });
//     }

//     res.status(200).json({
//       success: true,
//       message: `Notification sent to ${results.filter(r => r.status === 'success').length} users`,
//       results
//     });

//   } catch (error) {
//     console.error("Broadcast notification error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Server error sending notifications"
//     });
//   }
// };

// // Send notification to specific user
// export const sendUserNotification = async (req, res) => {
//   try {
//     const { userId, title, body, icon, data } = req.body;

//     if (!userId || !title || !body) {
//       return res.status(400).json({
//         success: false,
//         message: "User ID, title and body are required"
//       });
//     }

//     const subscriptions = await prisma.pushSubscription.findMany({
//       where: { userId }
//     });

//     if (subscriptions.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: "No push subscriptions found for this user"
//       });
//     }

//     const payload = JSON.stringify({
//       title,
//       body,
//       icon: icon || '/icon-192x192.png',
//       data: data || {}
//     });

//     const results = [];
//     const failedSubscriptions = [];

//     for (const subscription of subscriptions) {
//       try {
//         const pushSubscription = {
//           endpoint: subscription.endpoint,
//           keys: {
//             auth: subscription.auth,
//             p256dh: subscription.p256dh
//           }
//         };

//         await webpush.sendNotification(pushSubscription, payload);
//         results.push({ endpoint: subscription.endpoint, status: 'success' });
        
//       } catch (error) {
//         console.error(`Failed to send to ${subscription.endpoint}:`, error);
        
//         if (error.statusCode === 410) {
//           failedSubscriptions.push(subscription.endpoint);
//         }
        
//         results.push({ 
//           endpoint: subscription.endpoint, 
//           status: 'failed', 
//           error: error.message 
//         });
//       }
//     }

//     // Clean up failed subscriptions
//     if (failedSubscriptions.length > 0) {
//       await prisma.pushSubscription.deleteMany({
//         where: {
//           endpoint: { in: failedSubscriptions }
//         }
//       });
//     }

//     res.status(200).json({
//       success: true,
//       message: `Notification sent to ${results.filter(r => r.status === 'success').length} devices`,
//       results
//     });

//   } catch (error) {
//     console.error("User notification error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Server error sending user notification"
//     });
//   }
// };

// // Property-specific notification helpers
// export const notifyNewProperty = async (property) => {
//   try {
//     const subscriptions = await prisma.pushSubscription.findMany();
    
//     const payload = JSON.stringify({
//       title: '🏠 New Property Available!',
//       body: `Check out ${property.title} in ${property.city}`,
//       icon: '/icon-192x192.png',
//       data: {
//         url: `/properties/${property.id}`,
//         propertyId: property.id,
//         type: 'NEW_PROPERTY'
//       }
//     });

//     const failedSubscriptions = [];

//     for (const subscription of subscriptions) {
//       try {
//         const pushSubscription = {
//           endpoint: subscription.endpoint,
//           keys: {
//             auth: subscription.auth,
//             p256dh: subscription.p256dh
//           }
//         };

//         await webpush.sendNotification(pushSubscription, payload);
        
//       } catch (error) {
//         if (error.statusCode === 410) {
//           failedSubscriptions.push(subscription.endpoint);
//         }
//       }
//     }

//     // Clean up invalid subscriptions
//     if (failedSubscriptions.length > 0) {
//       await prisma.pushSubscription.deleteMany({
//         where: {
//           endpoint: { in: failedSubscriptions }
//         }
//       });
//     }

//     console.log(`New property notification sent to ${subscriptions.length - failedSubscriptions.length} users`);

//   } catch (error) {
//     console.error("New property notification error:", error);
//   }
// };

// export const notifyPropertyUpdate = async (property) => {
//   try {
//     const subscriptions = await prisma.pushSubscription.findMany();
    
//     const payload = JSON.stringify({
//       title: '📝 Property Updated',
//       body: `${property.title} has been updated`,
//       icon: '/icon-192x192.png',
//       data: {
//         url: `/properties/${property.id}`,
//         propertyId: property.id,
//         type: 'PROPERTY_UPDATE'
//       }
//     });

//     const failedSubscriptions = [];

//     for (const subscription of subscriptions) {
//       try {
//         const pushSubscription = {
//           endpoint: subscription.endpoint,
//           keys: {
//             auth: subscription.auth,
//             p256dh: subscription.p256dh
//           }
//         };

//         await webpush.sendNotification(pushSubscription, payload);
        
//       } catch (error) {
//         if (error.statusCode === 410) {
//           failedSubscriptions.push(subscription.endpoint);
//         }
//       }
//     }

//     if (failedSubscriptions.length > 0) {
//       await prisma.pushSubscription.deleteMany({
//         where: {
//           endpoint: { in: failedSubscriptions }
//         }
//       });
//     }

//     console.log(`Property update notification sent to ${subscriptions.length - failedSubscriptions.length} users`);

//   } catch (error) {
//     console.error("Property update notification error:", error);
//   }
// };

// controllers/pushController.js - Enhanced version

// Subscribe user to push notifications (supports all users)
export const subscribeToPush = async (req, res) => {
  try {
    const { subscription, userId } = req.body;
    const { endpoint, keys } = subscription;

    if (!endpoint || !keys || !keys.auth || !keys.p256dh) {
      return res.status(400).json({
        success: false,
        message: "Invalid subscription data"
      });
    }

    // Check if subscription already exists for this endpoint
    const existingSubscription = await prisma.pushSubscription.findUnique({
      where: { endpoint }
    });

    if (existingSubscription) {
      // Update user association if needed
      if (userId && existingSubscription.userId !== userId) {
        await prisma.pushSubscription.update({
          where: { endpoint },
          data: { userId }
        });
      }

      return res.status(200).json({
        success: true,
        message: "Push subscription updated"
      });
    }

    // Create new subscription for any user
    await prisma.pushSubscription.create({
      data: {
        endpoint,
        auth: keys.auth,
        p256dh: keys.p256dh,
        userId: userId || null // Support anonymous subscriptions
      }
    });

    console.log(`New push subscription created for user: ${userId || 'anonymous'}`);

    res.status(201).json({
      success: true,
      message: "Subscribed to push notifications successfully"
    });

  } catch (error) {
    console.error("Push subscription error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during push subscription"
    });
  }
};

// Enhanced broadcast to support user segmentation
export const broadcastNotification = async (req, res) => {
  try {
    const { title, body, icon, data, userRoles, userIds } = req.body;

    if (!title || !body) {
      return res.status(400).json({
        success: false,
        message: "Title and body are required"
      });
    }

    // Build where clause for targeted notifications
    const where = {};
    if (userRoles && userRoles.length > 0) {
      where.user = {
        role: { in: userRoles }
      };
    }
    if (userIds && userIds.length > 0) {
      where.userId = { in: userIds };
    }

    const subscriptions = await prisma.pushSubscription.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true
          }
        }
      }
    });
    
    const payload = JSON.stringify({
      title,
      body,
      icon: icon || '/image/192x192.png',
      data: data || {},
      timestamp: new Date().toISOString()
    });

    const results = await sendBulkNotifications(subscriptions, payload);

    res.status(200).json({
      success: true,
      message: `Notification sent to ${results.successCount} users`,
      results: {
        total: subscriptions.length,
        success: results.successCount,
        failed: results.failedCount,
        failedSubscriptions: results.failedEndpoints
      }
    });

  } catch (error) {
    console.error("Broadcast notification error:", error);
    res.status(500).json({
      success: false,
      message: "Server error sending notifications"
    });
  }
};

// Helper function for bulk notification sending
async function sendBulkNotifications(subscriptions, payload) {
  const results = {
    successCount: 0,
    failedCount: 0,
    failedEndpoints: []
  };

  const failedSubscriptions = [];

  // Send notifications in batches to avoid overwhelming the server
  const batchSize = 100;
  for (let i = 0; i < subscriptions.length; i += batchSize) {
    const batch = subscriptions.slice(i, i + batchSize);
    
    const batchPromises = batch.map(async (subscription) => {
      try {
        const pushSubscription = {
          endpoint: subscription.endpoint,
          keys: {
            auth: subscription.auth,
            p256dh: subscription.p256dh
          }
        };

        await webpush.sendNotification(pushSubscription, payload);
        results.successCount++;
        
      } catch (error) {
        console.error(`Failed to send to ${subscription.endpoint}:`, error);
        results.failedCount++;
        
        // Remove invalid subscriptions
        if (error.statusCode === 410 || error.statusCode === 404) {
          failedSubscriptions.push(subscription.endpoint);
        }
      }
    });

    await Promise.allSettled(batchPromises);
    
    // Small delay between batches
    if (i + batchSize < subscriptions.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // Clean up failed subscriptions
  if (failedSubscriptions.length > 0) {
    await prisma.pushSubscription.deleteMany({
      where: {
        endpoint: { in: failedSubscriptions }
      }
    });
    results.failedEndpoints = failedSubscriptions;
  }

  return results;
}

export const notifyPropertyUpdate = async (property) => {
  try {
    const subscriptions = await prisma.pushSubscription.findMany();
    
    const payload = JSON.stringify({
      title: '📝 Property Updated',
      body: `${property.title} has been updated`,
      icon: '/icon-192x192.png',
      data: {
        url: `/properties/${property.id}`,
        propertyId: property.id,
        type: 'PROPERTY_UPDATE'
      }
    });

    const failedSubscriptions = [];

    for (const subscription of subscriptions) {
      try {
        const pushSubscription = {
          endpoint: subscription.endpoint,
          keys: {
            auth: subscription.auth,
            p256dh: subscription.p256dh
          }
        };

        await webpush.sendNotification(pushSubscription, payload);
        
      } catch (error) {
        if (error.statusCode === 410) {
          failedSubscriptions.push(subscription.endpoint);
        }
      }
    }

    if (failedSubscriptions.length > 0) {
      await prisma.pushSubscription.deleteMany({
        where: {
          endpoint: { in: failedSubscriptions }
        }
      });
    }

    console.log(`Property update notification sent to ${subscriptions.length - failedSubscriptions.length} users`);

  } catch (error) {
    console.error("Property update notification error:", error);
  }
};

export const notifyNewProperty = async (property) => {
  try {
    const subscriptions = await prisma.pushSubscription.findMany();
    
    const payload = JSON.stringify({
      title: '🏠 New Property Available!',
      body: `Check out ${property.title} in ${property.city}`,
      icon: '/icon-192x192.png',
      data: {
        url: `/properties/${property.id}`,
        propertyId: property.id,
        type: 'NEW_PROPERTY'
      }
    });

    const failedSubscriptions = [];

    for (const subscription of subscriptions) {
      try {
        const pushSubscription = {
          endpoint: subscription.endpoint,
          keys: {
            auth: subscription.auth,
            p256dh: subscription.p256dh
          }
        };

        await webpush.sendNotification(pushSubscription, payload);
        
      } catch (error) {
        if (error.statusCode === 410) {
          failedSubscriptions.push(subscription.endpoint);
        }
      }
    }

    // Clean up invalid subscriptions
    if (failedSubscriptions.length > 0) {
      await prisma.pushSubscription.deleteMany({
        where: {
          endpoint: { in: failedSubscriptions }
        }
      });
    }

    console.log(`New property notification sent to ${subscriptions.length - failedSubscriptions.length} users`);

  } catch (error) {
    console.error("New property notification error:", error);
  }
};


export const sendUserNotification = async (req, res) => {
  try {
    const { userId, title, body, icon, data } = req.body;

    if (!userId || !title || !body) {
      return res.status(400).json({
        success: false,
        message: "User ID, title and body are required"
      });
    }

    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId }
    });

    if (subscriptions.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No push subscriptions found for this user"
      });
    }

    const payload = JSON.stringify({
      title,
      body,
      icon: icon || '/icon-192x192.png',
      data: data || {}
    });

    const results = [];
    const failedSubscriptions = [];

    for (const subscription of subscriptions) {
      try {
        const pushSubscription = {
          endpoint: subscription.endpoint,
          keys: {
            auth: subscription.auth,
            p256dh: subscription.p256dh
          }
        };

        await webpush.sendNotification(pushSubscription, payload);
        results.push({ endpoint: subscription.endpoint, status: 'success' });
        
      } catch (error) {
        console.error(`Failed to send to ${subscription.endpoint}:`, error);
        
        if (error.statusCode === 410) {
          failedSubscriptions.push(subscription.endpoint);
        }
        
        results.push({ 
          endpoint: subscription.endpoint, 
          status: 'failed', 
          error: error.message 
        });
      }
    }

    // Clean up failed subscriptions
    if (failedSubscriptions.length > 0) {
      await prisma.pushSubscription.deleteMany({
        where: {
          endpoint: { in: failedSubscriptions }
        }
      });
    }

    res.status(200).json({
      success: true,
      message: `Notification sent to ${results.filter(r => r.status === 'success').length} devices`,
      results
    });

  } catch (error) {
    console.error("User notification error:", error);
    res.status(500).json({
      success: false,
      message: "Server error sending user notification"
    });
  }
};

export const unsubscribeFromPush = async (req, res) => {
  try {
    const { endpoint } = req.body;

    if (!endpoint) {
      return res.status(400).json({
        success: false,
        message: "Endpoint is required"
      });
    }

    await prisma.pushSubscription.delete({
      where: { endpoint }
    });

    res.status(200).json({
      success: true,
      message: "Unsubscribed from push notifications successfully"
    });

  } catch (error) {
    console.error("Push unsubscribe error:", error);
    // If subscription not found, still return success
    if (error.code === 'P2025') {
      return res.status(200).json({
        success: true,
        message: "Already unsubscribed"
      });
    }
    res.status(500).json({
      success: false,
      message: "Server error during push unsubscription"
    });
  }
};