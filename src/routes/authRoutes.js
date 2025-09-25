import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();

const prisma = new PrismaClient();

router.post("/register", async (req, res) => {
  const { email, password } = req.body;      
  const hashedPassword = await bcrypt.hash(password, 11);

  try { 
    const userExists = await prisma.user.findUnique({ where: { email } }); 

    if (userExists) {
      return res.status(400).json({ message: "email already exists" });
    }

    const newUser = await prisma.user.create({
      data: {
        email,   
        password: hashedPassword,
      },
    });

    const token = jwt.sign({ id: newUser.id }, process.env.JWT_SECRET, { expiresIn: '1h' });

    res.status(201).json({ message: "User registered successfully" });

  }catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
 
});



router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { email: email } }); 

    if (!user) {
      return res.status(400).json({ message: "Invalid email" });
    } 


    const isPasswordValid = await bcrypt.compare(password, user.password);


    if (!isPasswordValid) {
      return res.status(400).json({ message: " invalid password" });
    }
 

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });


    res.status(200).json({ message: "Login successful", token });


  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }

 
} );



export default router;