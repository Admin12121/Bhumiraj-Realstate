import { expect, type APIRequestContext } from "@playwright/test";

type EmailSummary = {
  ID?: string;
  Id?: string;
  Subject?: string;
  subject?: string;
  Created?: string;
  created?: string;
};

function getEmailCaptureUrl() {
  const url = process.env.E2E_EMAIL_CAPTURE_URL?.trim();
  if (!url) {
    throw new Error(
      "E2E_EMAIL_CAPTURE_URL is required for tests that verify email links. The local Compose stack sends through Resend and does not run an email-capture container.",
    );
  }
  return url.replace(/\/$/, "");
}

export async function latestEmailMatching(
  request: APIRequestContext,
  email: string,
  pattern: RegExp,
) {
  const captureUrl = getEmailCaptureUrl();
  let messageId = "";

  await expect
    .poll(
      async () => {
        const response = await request.get(
          `${captureUrl}/api/v1/search?query=to:${encodeURIComponent(email)}`,
        );
        if (!response.ok()) return false;
        const body = (await response.json()) as { messages?: EmailSummary[] };
        const summaries = [...(body.messages ?? [])].sort((left, right) =>
          String(right.Created ?? right.created ?? "").localeCompare(
            String(left.Created ?? left.created ?? ""),
          ),
        );
        for (const summary of summaries) {
          const id = summary.ID ?? summary.Id;
          if (!id) continue;
          const message = await request.get(`${captureUrl}/api/v1/message/${id}`);
          if (!message.ok()) continue;
          const text = await message.text();
          if (pattern.test(text)) {
            messageId = id;
            return true;
          }
        }
        return false;
      },
      { timeout: 20_000 },
    )
    .toBe(true);

  return request.get(`${captureUrl}/api/v1/message/${messageId}`);
}
