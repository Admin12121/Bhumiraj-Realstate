export type EmailInput = {
  apiKey?: string | undefined;
  from: string;
  to: string | string[];
  subject: string;
  text: string;
  html?: string | undefined;
};

export async function sendResendEmail(input: EmailInput): Promise<void> {
  const apiKey = input.apiKey?.trim();
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is required to send email through Resend");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: input.from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      ...(input.html ? { html: input.html } : {}),
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Resend email delivery failed (${response.status}): ${body.slice(0, 1_000)}`,
    );
  }
}
