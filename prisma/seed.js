import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function seed() {
  const hashedPassword1 = await bcrypt.hash("adminPassword4", 11); // Replace with your desired password
  const hashedPassword2 = await bcrypt.hash("adminPassword3", 11);

  await prisma.user.createMany({
    data: [
      {
        email: "rentAdmin4@gmail.com",
        password: hashedPassword1,
        firstName: "Admin",
        lastName: "User",
        role: "ADMIN",
        isEmailVerified: true,
        verificationStatus: "VERIFIED",
      },
      {
        email: "rentAdmin3@gmail.com",
        password: hashedPassword2,
        firstName: "Admin",
        lastName: "User",
        role: "ADMIN",
        isEmailVerified: true,
        verificationStatus: "VERIFIED",
      },
    ],
  });

  console.log("Seed data inserted successfully.");
}

seed()
  .catch((e) => {
    console.error("Error seeding data:", e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });