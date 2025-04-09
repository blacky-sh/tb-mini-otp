import { Application } from "../../declarations";
import { BadRequest } from "@feathersjs/errors";
import { Users } from "../users/users.class";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { Paginated } from "@feathersjs/feathers";
import { sendTelegramOtp } from "../telegram/telegram.service"; // Import the Telegram service

export default function (app: Application): void {
  const usersService = app.service("users") as Users;

  app.use("/auth", {
    async create(data: { phone: string; pin?: string; otp?: string }) {
      const { phone, pin, otp } = data;

      // Check if the phone exists in the database
      const user = await usersService.find({
        query: { phone },
        paginate: false,
      });

      const userList = Array.isArray(user)
        ? user
        : (user as Paginated<any>).data;

      if (userList.length > 0) {
        const existingUser = userList[0];

        // If OTP is provided, verify it
        if (otp) {
          const isOtpValid = await bcrypt.compare(otp, existingUser.otp);
          if (isOtpValid && existingUser.otpExpires > new Date()) {
            // Mark user as verified
            await usersService.patch(existingUser._id, {
              isVerified: true,
              otp: null,
              otpExpires: null,
            });

            // Check if the user has a PIN set
            if (!existingUser.pin) {
              return {
                message: "OTP verified. Please set your PIN.",
                user: existingUser,
              };
            }

            return { message: "OTP verified successfully" };
          } else {
            throw new BadRequest("Invalid or expired OTP");
          }
        }

        // If PIN is provided, verify it
        if (pin) {
          try {
            // Call the authentication service programmatically
            const authResult = await app.service("authentication").create(
              {
                strategy: "local",
                phone,
                pin,
              },
              {}
            );

            return {
              message: "Authenticated successfully",
              accessToken: authResult.accessToken, // Return the JWT token
              user: authResult.user, // Return the authenticated user
            };
          } catch (error) {
            console.error("Authentication error:", error);
            throw new BadRequest("Invalid PIN");
          }
        }

        // If neither OTP nor PIN is provided, prompt for PIN
        return { message: "Phone exists. Please provide your PIN." };
      } else {
        // If phone does not exist, generate and send OTP
        const generatedOtp = crypto.randomInt(100000, 999999).toString();
        const hashedOtp = await bcrypt.hash(generatedOtp, 10); // Hash the OTP
        const otpExpires = new Date(Date.now() + 5 * 60 * 1000); // OTP valid for 5 minutes

        await usersService.create({
          phone,
          otp: hashedOtp, // Store the hashed OTP
          otpExpires,
        });

        // Send OTP via Telegram
        try {
          await sendTelegramOtp(phone, generatedOtp);
        } catch {
          throw new BadRequest("Failed to send OTP via Telegram.");
        }

        return { message: "OTP sent for verification" };
      }
    },

    async patch(id: string, data: { pin: string }) {
      const { pin } = data;

      // Fetch the user by ID
      const user = await usersService.get(id);

      // Check if the user already has a PIN set
      if (user.pin) {
        throw new BadRequest("PIN is already set and cannot be changed.");
      }

      // Check if the OTP has expired
      if (!user.isVerified) {
        throw new BadRequest("OTP has expired. Please verify again.");
      }

      // Update the user's PIN
      await usersService.patch(id, { pin: pin });

      return { message: "PIN set successfully" };
    },
  });
}
