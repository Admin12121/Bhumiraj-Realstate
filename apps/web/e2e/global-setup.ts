import type { FullConfig } from "@playwright/test";

async function waitForApi(baseURL: string) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseURL}/api/v1/health`);
      if (response.ok) return;
    } catch {
      // The Compose stack can still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error("The E2E API did not become healthy within 60 seconds.");
}

export default async function setup(config: FullConfig) {
  const baseURL =
    (config.projects[0]?.use.baseURL as string | undefined) ??
    "http://localhost:8080";
  await waitForApi(baseURL);

  const users = [
    {
      name: "E2E Admin",
      email:
        process.env.E2E_ADMIN_EMAIL ?? "admin.e2e@bhumiraj.test",
      password:
        process.env.E2E_ADMIN_PASSWORD ?? "AdminTest!234567",
    },
    {
      name: "E2E Bidder",
      email:
        process.env.E2E_BIDDER_EMAIL ?? "bidder.e2e@bhumiraj.test",
      password:
        process.env.E2E_BIDDER_PASSWORD ?? "BidderTest!234567",
    },
  ];

  for (const user of users) {
    const response = await fetch(`${baseURL}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(user),
    });
    if (!response.ok && response.status !== 422) {
      const body = await response.text();
      if (!body.toLowerCase().includes("already")) {
        throw new Error(
          `Could not create E2E user ${user.email}: ${response.status} ${body}`,
        );
      }
    }
  }

  const fixtures = await fetch(`${baseURL}/api/v1/testing/fixtures`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-e2e-key":
        process.env.E2E_SETUP_KEY ??
        "local-e2e-setup-key-change-me",
    },
    body: JSON.stringify({
      adminEmail: users[0]!.email,
      bidderEmail: users[1]!.email,
    }),
  });

  if (!fixtures.ok) {
    throw new Error(
      `Could not prepare E2E fixtures: ${fixtures.status} ${await fixtures.text()}`,
    );
  }
}
