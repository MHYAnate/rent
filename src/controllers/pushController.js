// // controllers/pushController.js
// import webpush from 'web-push';
// import { PrismaClient } from '@prisma/client';

// const prisma = new PrismaClient();

// // Configure webpush
// webpush.setVapidDetails(
//   process.env.VAPID_EMAIL,
//   process.env.VAPID_PUBLIC_KEY,
//   process.env.VAPID_PRIVATE_KEY
// );

// // Subscribe user to push notifications
// // export const subscribeToPush = async (req, res) => {
// //   try {
// //     const { subscription, userId } = req.body;
// //     const { endpoint, keys } = subscription;

// //     if (!endpoint || !keys || !keys.auth || !keys.p256dh) {
// //       return res.status(400).json({
// //         success: false,
// //         message: "Invalid subscription data"
// //       });
// //     }

// //     // Check if subscription already exists
// //     const existingSubscription = await prisma.pushSubscription.findUnique({
// //       where: { endpoint }
// //     });

// //     if (existingSubscription) {
// //       return res.status(200).json({
// //         success: true,
// //         message: "Already subscribed to push notifications"
// //       });
// //     }

// //     // Create new subscription
// //     await prisma.pushSubscription.create({
// //       data: {
// //         endpoint,
// //         auth: keys.auth,
// //         p256dh: keys.p256dh,
// //         userId: userId || null
// //       }
// //     });

// //     res.status(201).json({
// //       success: true,
// //       message: "Subscribed to push notifications successfully"
// //     });

// //   } catch (error) {
// //     console.error("Push subscription error:", error);
// //     res.status(500).json({
// //       success: false,
// //       message: "Server error during push subscription"
// //     });
// //   }
// // };

// // controllers/pushController.js
// export const subscribeToPush = async (req, res) => {
//   try {
//     const { subscription, userEmail } = req.body;
//     const { endpoint, keys } = subscription;

//     if (!endpoint || !keys || !keys.auth || !keys.p256dh) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid subscription data",
//       });
//     }

//     // Check if subscription already exists
//     const existingSubscription = await prisma.pushSubscription.findUnique({
//       where: { endpoint },
//     });

//     if (existingSubscription) {
//       return res.status(200).json({
//         success: true,
//         message: "Already subscribed to push notifications",
//       });
//     }

//     // Create new subscription
//     await prisma.pushSubscription.create({
//       data: {
//         endpoint,
//         auth: keys.auth,
//         p256dh: keys.p256dh,
//         userEmail,
//       },
//     });

//     res.status(201).json({
//       success: true,
//       message: "Subscribed to push notifications successfully",
//     });
//   } catch (error) {
//     console.error("Push subscription error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Server error during push subscription",
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

// // controllers/pushController.js
// export const sendPushNotificationToUser = async (userEmail, notificationData) => {
//   try {
//     const subscriptions = await prisma.pushSubscription.findMany({
//       where: { userEmail },
//     });

//     if (subscriptions.length === 0) {
//       console.log(`No subscriptions found for user ${userEmail}`);
//       return;
//     }

//     const payload = JSON.stringify(notificationData);

//     for (const subscription of subscriptions) {
//       try {
//         const pushSubscription = {
//           endpoint: subscription.endpoint,
//           keys: {
//             auth: subscription.auth,
//             p256dh: subscription.p256dh,
//           },
//         };

//         await webpush.sendNotification(pushSubscription, payload);
//         console.log(`Push notification sent to ${userEmail}`);
//       } catch (error) {
//         console.error(`Error sending push notification to ${userEmail}:`, error);
//       }
//     }
//   } catch (error) {
//     console.error(`Error sending push notification to ${userEmail}:`, error);
//   }
// };



// controllers/pushController.js
import webpush from 'web-push';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// More flexible VAPID configuration
const configureVapid = () => {
  const vapidEmail = process.env.VAPID_EMAIL || 'mailto:your-app@domain.com';
  webpush.setVapidDetails(
    vapidEmail,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
};

configureVapid();

// Enhanced subscribe function with better user association
export const subscribeToPush = async (req, res) => {
  try {
    const { subscription, userId, userEmail } = req.body;
    const { endpoint, keys } = subscription;

    if (!endpoint || !keys || !keys.auth || !keys.p256dh) {
      return res.status(400).json({
        success: false,
        message: "Invalid subscription data"
      });
    }

    // Find user by email if userId not provided but email is
    let finalUserId = userId;
    if (!finalUserId && userEmail) {
      const user = await prisma.user.findUnique({
        where: { email: userEmail }
      });
      if (user) {
        finalUserId = user.id;
      }
    }

    // Check if subscription already exists for this endpoint
    const existingSubscription = await prisma.pushSubscription.findUnique({
      where: { endpoint }
    });

    if (existingSubscription) {
      // Update existing subscription with user info if missing
      if (!existingSubscription.userId && finalUserId) {
        await prisma.pushSubscription.update({
          where: { endpoint },
          data: { userId: finalUserId }
        });
      }
      return res.status(200).json({
        success: true,
        message: "Push subscription updated"
      });
    }

    // Create new subscription
    await prisma.pushSubscription.create({
      data: {
        endpoint,
        auth: keys.auth,
        p256dh: keys.p256dh,
        userId: finalUserId || null
      }
    });

    console.log(`New push subscription created for user: ${finalUserId || 'anonymous'}, endpoint: ${endpoint}`);

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

// Send notification to user by email
export const sendNotificationByEmail = async (req, res) => {
  try {
    const { email, title, body, icon, data } = req.body;

    if (!email || !title || !body) {
      return res.status(400).json({
        success: false,
        message: "Email, title and body are required"
      });
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Get all subscriptions for this user
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId: user.id }
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
        results.push({ 
          endpoint: subscription.endpoint, 
          status: 'success',
          userEmail: email 
        });
        
      } catch (error) {
        console.error(`Failed to send to ${subscription.endpoint}:`, error);
        
        if (error.statusCode === 410) {
          failedSubscriptions.push(subscription.endpoint);
        }
        
        results.push({ 
          endpoint: subscription.endpoint, 
          status: 'failed', 
          error: error.message,
          userEmail: email
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
      message: `Notification sent to ${results.filter(r => r.status === 'success').length} devices for user ${email}`,
      results
    });

  } catch (error) {
    console.error("Send notification by email error:", error);
    res.status(500).json({
      success: false,
      message: "Server error sending notification by email"
    });
  }
};

// Broadcast to all users with email tracking
export const broadcastNotification = async (req, res) => {
  try {
    const { title, body, icon, data } = req.body;

    if (!title || !body) {
      return res.status(400).json({
        success: false,
        message: "Title and body are required"
      });
    }

    // Get all subscriptions with user information
    const subscriptions = await prisma.pushSubscription.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });
    
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
        results.push({ 
          endpoint: subscription.endpoint, 
          status: 'success',
          userEmail: subscription.user?.email || 'anonymous',
          userId: subscription.userId 
        });
        
      } catch (error) {
        console.error(`Failed to send to ${subscription.endpoint}:`, error);
        
        if (error.statusCode === 410) {
          failedSubscriptions.push(subscription.endpoint);
        }
        
        results.push({ 
          endpoint: subscription.endpoint, 
          status: 'failed', 
          error: error.message,
          userEmail: subscription.user?.email || 'anonymous',
          userId: subscription.userId
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

    // Analytics
    const successCount = results.filter(r => r.status === 'success').length;
    const uniqueUsers = [...new Set(results.filter(r => r.status === 'success').map(r => r.userId))].length;

    res.status(200).json({
      success: true,
      message: `Notification sent to ${successCount} devices across ${uniqueUsers} users`,
      analytics: {
        totalSubscriptions: subscriptions.length,
        successfulDeliveries: successCount,
        failedDeliveries: results.filter(r => r.status === 'failed').length,
        uniqueUsersReached: uniqueUsers
      },
      results
    });

  } catch (error) {
    console.error("Broadcast notification error:", error);
    res.status(500).json({
      success: false,
      message: "Server error sending notifications"
    });
  }
};



// Send notification to specific user
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

// Property-specific notification helpers
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

// controllers/pushController.js
export const sendPushNotificationToUser = async (userEmail, notificationData) => {
  try {
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userEmail },
    });

    if (subscriptions.length === 0) {
      console.log(`No subscriptions found for user ${userEmail}`);
      return;
    }

    const payload = JSON.stringify(notificationData);

    for (const subscription of subscriptions) {
      try {
        const pushSubscription = {
          endpoint: subscription.endpoint,
          keys: {
            auth: subscription.auth,
            p256dh: subscription.p256dh,
          },
        };

        await webpush.sendNotification(pushSubscription, payload);
        console.log(`Push notification sent to ${userEmail}`);
      } catch (error) {
        console.error(`Error sending push notification to ${userEmail}:`, error);
      }
    }
  } catch (error) {
    console.error(`Error sending push notification to ${userEmail}:`, error);
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
  