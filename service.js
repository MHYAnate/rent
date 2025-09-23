import express from "express";
import auhtRoutes from "./src/routes/authRoutes.js";

const app = express();

app.use(express.json());


app.use("/auth", auhtRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});