import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/lib/db";

const hasMicrosoftOAuth =
  Boolean(process.env.MICROSOFT_CLIENT_ID) &&
  Boolean(process.env.MICROSOFT_CLIENT_SECRET);

export const auth = betterAuth({
  database: prismaAdapter(db, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  socialProviders: hasMicrosoftOAuth
    ? {
        microsoft: {
          clientId: process.env.MICROSOFT_CLIENT_ID as string,
          clientSecret: process.env.MICROSOFT_CLIENT_SECRET as string,
          tenantId: process.env.MICROSOFT_TENANT_ID ?? "common",
          authority:
            process.env.MICROSOFT_AUTHORITY ??
            "https://login.microsoftonline.com",
          prompt: "select_account",
        },
      }
    : {},
  trustedOrigins: [process.env.BETTER_AUTH_URL].filter(
    (origin): origin is string => Boolean(origin),
  ),
  plugins: [nextCookies()],
});

export const microsoftOAuthEnabled = hasMicrosoftOAuth;
