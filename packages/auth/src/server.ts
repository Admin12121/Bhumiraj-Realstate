import { betterAuth } from "better-auth/minimal";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin, twoFactor } from "better-auth/plugins";
import { defaultAc, userAc } from "better-auth/plugins/admin/access";
import { passkey } from "@better-auth/passkey";
import { createAuthMiddleware } from "better-auth/api";
import { prisma } from "@real-estate/database";
import { loadServerEnv, type ServerEnv } from "@real-estate/config";

export type AuthEmail = {
  to: string;
  subject: string;
  text: string;
  url?: string;
};
export type AuthDependencies = {
  env?: ServerEnv;
  sendEmail?: (email: AuthEmail) => Promise<void>;
  enqueueUserLifecycle?: (event: {
    type: "created" | "deleted";
    userId: string;
  }) => Promise<void>;
};

export function createAuth(dependencies: AuthDependencies = {}) {
  const env = dependencies.env ?? loadServerEnv();
  const appUrl = env.APP_URL;
  const sendEmail =
    dependencies.sendEmail ??
    (async () => {
      throw new Error("Authentication email delivery is not configured.");
    });
  const hostname = new URL(appUrl).hostname;
  const socialProviders = {
    ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {}),
    ...(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
      ? {
          github: {
            clientId: env.GITHUB_CLIENT_ID,
            clientSecret: env.GITHUB_CLIENT_SECRET,
          },
        }
      : {}),
  };
  // Better Auth owns identity and session enforcement only. Platform
  // administration is authorized and audited by the Nest staff RBAC layer.
  const ownerAc = defaultAc.newRole({ user: [], session: [] });

  return betterAuth({
    appName: env.APP_NAME,
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [appUrl],
    database: prismaAdapter(prisma, { provider: "postgresql" }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: 10,
      maxPasswordLength: 128,
      resetPasswordTokenExpiresIn: 60 * 60,
      revokeSessionsOnPasswordReset: true,
      customSyntheticUser: ({ coreFields, additionalFields, id }) => ({
        ...coreFields,
        role: "USER",
        banned: false,
        banReason: null,
        banExpires: null,
        ...additionalFields,
        id,
      }),
      sendResetPassword: async ({ user, url }) =>
        sendEmail({
          to: user.email,
          subject: "Reset your Bhumiraj Estates password",
          text: `Reset your password: ${url}`,
          url,
        }),
    },
    emailVerification: {
      sendVerificationEmail: async ({ user, url }) =>
        sendEmail({
          to: user.email,
          subject: "Verify your Bhumiraj Estates email",
          text: `Verify your email: ${url}`,
          url,
        }),
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
    },
    socialProviders,
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      freshAge: 60 * 30,
      cookieCache: { enabled: true, maxAge: 60 * 5 },
      additionalFields: {
        authMethod: { type: "string", required: false, input: false },
      },
    },
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ["google", "github"],
        disableImplicitLinking: true,
      },
    },
    user: {
      changeEmail: {
        enabled: true,
        sendChangeEmailConfirmation: async ({ user, newEmail, url }) =>
          sendEmail({
            to: user.email,
            subject: `Approve email change to ${newEmail}`,
            text: url,
            url,
          }),
      },
      deleteUser: { enabled: false },
    },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            await prisma.userProfile.upsert({
              where: { userId: user.id },
              create: { userId: user.id },
              update: {},
            });
            await dependencies.enqueueUserLifecycle?.({
              type: "created",
              userId: user.id,
            });
          },
        },
      },
    },
    hooks: {
      after: createAuthMiddleware(async (ctx) => {
        const newSession = ctx.context.newSession;
        if (!newSession) return;

        let authMethod = "unknown";
        if (
          ctx.path.includes("two-factor/verify-totp") ||
          ctx.path.includes("two-factor/verify-backup-code")
        ) {
          authMethod = "credential+2fa";
        } else if (ctx.path === "/sign-in/email") {
          authMethod = "credential";
        } else if (ctx.path.includes("passkey")) {
          authMethod = "passkey";
        } else if (
          ctx.path.startsWith("/callback/") ||
          ctx.path.includes("oauth")
        ) {
          authMethod = "social";
        }

        await prisma.session.updateMany({
          where: { id: newSession.session.id },
          data: { authMethod },
        });
      }),
    },
    rateLimit: { enabled: true, window: 60, max: 100 },
    plugins: [
      admin({
        defaultRole: "USER",
        adminRoles: ["OWNER"],
        roles: {
          USER: userAc,
          AGENT: userAc,
          STAFF: userAc,
          OWNER: ownerAc,
        },
      }),
      twoFactor({
        issuer: env.APP_NAME,
        totpOptions: { period: 30, digits: 6 },
        backupCodeOptions: { amount: 10, length: 10 },
        allowPasswordless: true,
      }),
      passkey({
        rpID: env.PASSKEY_RP_ID ?? hostname,
        rpName: env.APP_NAME,
        origin: appUrl,
        authenticatorSelection: {
          residentKey: "preferred",
          userVerification: "required",
        },
      }),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
