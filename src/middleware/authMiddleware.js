import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

export const authMiddleware = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; 
  if (!token) return res.sendStatus(401).json({ message: "No token provided" });

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {  
    if (err) return res.sendStatus(403).json({ message: "Invalid token" });
    req.userId = decoded.id;
    next();
  });
  // Fetch user from your database and compare passwords here
  // If valid, generate JWT token and send it back
  res.status(200).json({ message: "Login successful" });
}


export default authMiddleware;