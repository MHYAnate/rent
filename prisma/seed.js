import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function seed() {
  const hashedPassword1 = await bcrypt.hash("07012345678", 11); // Replace with your desired password
  const hashedPassword2 = await bcrypt.hash("21314151617", 11);

  await prisma.user.createMany({
    data: [
      {
        email: "adminppoint1@gmail.com.com",
        phone: "07012345678",
        password: hashedPassword1,
        firstName: "SuperAdmin",
        lastName: "User",
        role: "SUPER_ADMIN",
        isEmailVerified: true,
        verificationStatus: "VERIFIED",
      },
      // {
      //   email: "admin@gmail.com",
      //   phone: "21314151617",
      //   password: hashedPassword2,
      //   firstName: "Admin2",
      //   lastName: "User",
      //   role: "ADMIN",
      //   isEmailVerified: true,
      //   verificationStatus: "VERIFIED",
      // },
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