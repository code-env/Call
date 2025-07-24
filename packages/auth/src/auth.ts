import { extractTokenFromUrl } from "./utils/extract-token";
import { sendMail } from "./utils/send-mail";
import { db } from "@call/db";
import schema from "@call/db/schema";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

if (!process.env.FRONTEND_URL || !process.env.BACKEND_URL) {
  throw new Error(
    "Missing environment variables. FRONTEND_URL or BACKEND_URL is not defined"
  );
}

if (!process.env.BETTER_AUTH_SECRET) {
  throw new Error(
    "Missing BETTER_AUTH_SECRET in environment variables. Please set it in your .env file."
  );
}

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      ...schema,
    },
  }),

  trustedOrigins: [process.env.FRONTEND_URL, process.env.BACKEND_URL],

  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    minPasswordLength: 8,
    maxPasswordLength: 100,
    resetPasswordTokenExpiresIn: 600, // 10 minutes
    sendResetPassword: async ({ user, url }) => {
      const token = extractTokenFromUrl(url);
      const frontendResetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

      await sendMail({
        to: user.email,
        subject: "Reset your password",
        text: `Click the link to reset your password: ${frontendResetUrl}`,
      });
    },
  },

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      scope: [
        // "https://www.googleapis.com/auth/userinfo.profile",
        // "https://www.googleapis.com/auth/userinfo.email",
      ],
      accessType: "offline",
      prompt: "consent",
    },
  },
});

export type Session = typeof auth.$Infer.Session;
