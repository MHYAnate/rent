import express from "express";
import auhtRoutes from "./src/routes/authRoutes.js";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const app = express();

app.use(express.json());

app.use('/', async (_, res,) => {
 const users = await prisma.user.findMany();
  res.json(users);
});
app.use("/auth", auhtRoutes);

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});