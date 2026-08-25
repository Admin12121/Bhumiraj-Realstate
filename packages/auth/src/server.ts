import { betterAuth } from "better-auth/minimal";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin, twoFactor } from "better-auth/plugins";
import { defaultAc, userAc } from "better-auth/plugins/admin/access";
import { passkey } from "@better-auth/passkey";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { prisma } from "@real-estate/database";
import { loadServerEnv, type ServerEnv } from "@real-estate/config";
import { assertionUserVerified, classifyAuthMethod } from "./auth-method";

export * from "./auth-method";

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
  /**
   * Security notices go to the address on the account whether or not it has
   * been verified — that is the point of them.
   */
  const securityEmail = async (input: {
    to: string;
    emailVerified: boolean;
    subject: string;
    text: string;
  }) => {
    const notice = input.emailVerified
      ? ""
      : `

If this was not you, someone may have entered your address by mistake. You can ignore this email — the account cannot post a property or bid until the address is verified. To stop these messages, contact ${env.MAIL_FROM}.`;
    await sendEmail({
      to: input.to,
      subject: input.subject,
      text: `${input.text}${notice}`,
    });
  };

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
      // Verification is asked for at the actions that need it — listing a
      // property, bidding — not at the door. Blocking sign-in meant a new
      // customer could not even browse until they had opened their inbox.
      requireEmailVerification: false,
      autoSignIn: true,
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
      onPasswordReset: async ({ user }) => {
        await securityEmail({
          to: user.email,
          emailVerified: Boolean(user.emailVerified),
          subject: "Your Bhumiraj Estates password was changed",
          text: `Hello ${user.name || "there"},

The password for ${user.email} was just changed. If you made this change, nothing more is needed.`,
        }).catch(() => undefined);
      },
      sendResetPassword: async ({ user, url }) =>
        sendEmail({
          to: user.email,
          subject: "Reset your Bhumiraj Estates password",
          text: `Reset your password: ${url}`,
          url,
        }),
    },
    emailVerification: {
      sendVerificationEmail: async ({ user, url }) => {
        // A verified email without a phone number is half an identity: an agent
        // still cannot reach the person. Requiring the number first means a
        // fully verified account is always contactable.
        const profile = await prisma.userProfile.findUnique({
          where: { userId: user.id },
          select: { phone: true },
        });
        if (!profile?.phone) {
          throw new APIError("BAD_REQUEST", {
            code: "PHONE_REQUIRED",
            message:
              "Add your phone number in Settings before verifying your email.",
          });
        }
        await sendEmail({
          to: user.email,
          subject: "Verify your Bhumiraj Estates email",
          text: `Verify your email: ${url}`,
          url,
        });
      },
      sendOnSignUp: false,
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
    advanced: {
      // Cookies ignore ports, so the default `better-auth.*` names collide with
      // any other Better Auth app served from localhost. A shared name lets a
      // foreign session masquerade as one of ours.
      cookiePrefix: "bhumiraj",
    },
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ["google"],
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
            // A handle is assigned rather than asked for: it only exists so a
            // public profile has a readable URL, and making people invent one
            // at sign-up is friction for no benefit. Collisions retry with a
            // longer suffix; a null handle is acceptable if every attempt loses.
            const base =
              (user.email ?? "user")
                .split("@")[0]
                ?.toLowerCase()
                .replace(/[^a-z0-9_]/g, "")
                .slice(0, 20) || "user";
            let username: string | null = null;
            for (let attempt = 0; attempt < 5; attempt += 1) {
              const suffix = Math.random().toString(36).slice(2, 6 + attempt);
              const candidate = `${base}_${suffix}`.slice(0, 30);
              const taken = await prisma.userProfile.findFirst({
                where: { username: candidate },
                select: { userId: true },
              });
              if (!taken) {
                username = candidate;
                break;
              }
            }

            await prisma.userProfile.upsert({
              where: { userId: user.id },
              create: { userId: user.id, ...(username ? { username } : {}) },
              update: {},
            });
            await dependencies.enqueueUserLifecycle?.({
              type: "created",
              userId: user.id,
            });
            await securityEmail({
              to: user.email,
              emailVerified: Boolean(user.emailVerified),
              subject: "Your Bhumiraj Estates account is ready",
              text: `Hello ${user.name || "there"},

An account was created for ${user.email} at Bhumiraj Estates. You can browse and save properties straight away. Verifying your email is only needed to post a property or place a bid, and you can do it any time from Settings → Security.`,
            }).catch(() => undefined);
          },
        },
      },
    },
    hooks: {
      after: createAuthMiddleware(async (ctx) => {
        const newSession = ctx.context.newSession;
        if (!newSession) return;

        // WebAuthn assertion shape: body.response.response.authenticatorData
        const assertion = (
          ctx.body as { response?: { response?: { authenticatorData?: unknown } } }
        )?.response?.response;
        const authMethod = classifyAuthMethod(ctx.path, {
          userVerified: assertionUserVerified(assertion?.authenticatorData),
        });
        if (authMethod === "passkey-unverified") {
          console.warn(
            "Passkey assertion completed without user verification; the session is single-factor.",
          );
        }
        if (authMethod === "unknown") {
          // Staff step-up reads this column, so an unclassified sign-in route
          // locks every staff member out of administration at once.
          console.warn(
            `Unclassified authentication route "${ctx.path}"; session recorded as unknown.`,
          );
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
