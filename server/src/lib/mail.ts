import nodemailer from 'nodemailer';
import { config } from '../config.js';

// D14: SMTP_HOST empty → jsonTransport, and the message is printed to the server log (dev/test only).
const transport = config.SMTP_HOST
  ? nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_PORT === 465,
      ...(config.SMTP_USER && { auth: { user: config.SMTP_USER, pass: config.SMTP_PASS } }),
    })
  : nodemailer.createTransport({ jsonTransport: true });

/** Send one email. Mails carry tokens: the body is logged only in the D14 dev fallback, never in production. */
export const sendMail = async (to: string, subject: string, text: string, html?: string) => {
  if (!config.SMTP_HOST) {
    if (config.NODE_ENV === 'production') throw new Error(`SMTP_HOST is not set; refusing to send "${subject}" in production`);
    console.log(`[mail] to=${to} subject="${subject}"\n${text}`);
  }
  await transport.sendMail({ from: config.SMTP_FROM, to, subject, text, ...(html && { html }) });
};
