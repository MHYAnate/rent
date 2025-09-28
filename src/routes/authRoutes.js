// import express from "express";
// import bcrypt from "bcryptjs";
// import jwt from "jsonwebtoken";
// import { PrismaClient } from "@prisma/client";
// import dotenv from "dotenv";

// dotenv.config();

// const router = express.Router();

// const prisma = new PrismaClient();

// router.post("/register", async (req, res) => {
//   const { email, password } = req.body;      
//   const hashedPassword = await bcrypt.hash(password, 11);

//   try { 
//     const userExists = await prisma.user.findUnique({ where: { email } }); 

//     if (userExists) {
//       return res.status(400).json({ message: "email already exists" });
//     }

//     const newUser = await prisma.user.create({
//       data: {
//         email,   
//         password: hashedPassword,
//       },
//     });

//     const token = jwt.sign({ id: newUser.id }, process.env.JWT_SECRET, { expiresIn: '1h' });

//     res.status(201).json({ message: "User registered successfully" });

//   }catch (error) {
//     return res.status(500).json({ message: "Server error" });
//   }
 
// });



// router.post("/login", async (req, res) => {
//   const { email, password } = req.body;

//   try {
//     const user = await prisma.user.findUnique({ where: { email: email } }); 

//     if (!user) {
//       return res.status(400).json({ message: "Invalid email" });
//     } 


//     const isPasswordValid = await bcrypt.compare(password, user.password);


//     if (!isPasswordValid) {
//       return res.status(400).json({ message: " invalid password" });
//     }
 

//     const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });


//     res.status(200).json({ message: "Login successful", token });


//   } catch (error) {
//     return res.status(500).json({ message: "Server error" });
//   }

 
// } );



// export default router;

// src/routes/authRoutes.js

import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import { authMiddleware } from "../middleware/authMiddleware.js";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();
const prisma = new PrismaClient();
const JWT_EXPIRATION = '7d'; // Set a longer expiration for convenience

// --- 1. User Registration ---
// Aligned with the schema: requires firstName and lastName.
router.post("/register", async (req, res) => {
  const { email, password, firstName, lastName, phone } = req.body;

  // Basic validation
  if (!email || !password || !firstName || !lastName) {
    return res.status(400).json({ message: "Please provide email, password, first name, and last name." });
  }

  try {
    const userExists = await prisma.user.findUnique({ where: { email } });
    if (userExists) {
      return res.status(409).json({ message: "Email is already in use." });
    }

    const hashedPassword = await bcrypt.hash(password, 11);
    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        phone, // phone is optional
      },
      select: { id: true, email: true, firstName: true, role: true } // Don't send the password back
    });

    res.status(201).json({ message: "User registered successfully", user: newUser });

  } catch (error) {
    console.error("Registration Error:", error);
    res.status(500).json({ message: "Server error during registration." });
  }
});

// --- 2. User Login ---
// Now creates a session record in the database as per the schema.
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Please provide both email and password." });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Use a generic message to prevent email enumeration
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: JWT_EXPIRATION });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Match JWT expiration

    // Create a session in the DB
    await prisma.session.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });
    
    // Update last login timestamp
    await prisma.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() }
    });

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        role: user.role,
      }
    });

  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ message: "Server error during login." });
  }
});

// --- 3. User Logout ---
// A new, essential route that uses the auth middleware.
router.post("/logout", authMiddleware, async (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    try {
        // Delete the session from the database
        await prisma.session.deleteMany({
            where: { token: token }
        });
        res.status(200).json({ message: "Successfully logged out." });
    } catch (error) {
        console.error("Logout Error:", error);
        res.status(500).json({ message: "Server error during logout." });
    }
});


// --- 4. Get Current User Profile ---
// A protected route to demonstrate the middleware.
router.get("/profile", authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
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
      }
    });

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    res.status(200).json(user);

  } catch (error) {
    console.error("Profile Fetch Error:", error);
    res.status(500).json({ message: "Server error fetching profile." });
  }
});

export default router;