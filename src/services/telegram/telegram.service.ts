import axios from "axios";

const BASE_URL = "https://gatewayapi.telegram.org/";
const TOKEN = "AAFZFQAAakxiCO0vhTXqIpHa4nhrQhghfkFVYKzb8NOj1Q";

export async function sendTelegramOtp(
  phoneNumber: string,
  otp: string
): Promise<void> {
  const endpoint = "sendVerificationMessage";
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    Authorization: `Bearer ${TOKEN}`,
    "Content-Type": "application/json",
  };

  const body = {
    phone_number: phoneNumber,
    code: otp,
  };

  try {
    const response = await axios.post(url, body, { headers });
    if (response.status === 200 && response.data.ok) {
      console.log(`OTP sent to ${phoneNumber} via Telegram.`);
    } else {
      throw new Error(
        `Failed to send OTP via Telegram: ${
          response.data.error || "Unknown error"
        }`
      );
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error sending OTP via Telegram: ${error.message}`);
    } else {
      console.error("Error sending OTP via Telegram: Unknown error");
    }
    throw new Error("Failed to send OTP via Telegram.");
  }
}
