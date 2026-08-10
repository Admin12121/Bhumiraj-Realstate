import { createAuth } from "@real-estate/auth";
import { sendResendEmail } from "@real-estate/email";
import { apiEnv } from "./bootstrap-env";

export const auth = createAuth({
  env: apiEnv,
  sendEmail: async ({ to, subject, text }) => {
    await sendResendEmail({
      apiKey: apiEnv.RESEND_API_KEY,
      from: apiEnv.MAIL_FROM,
      to,
      subject,
      text,
    });
  },
});
