import type { PluginContext } from '@harness/plugin-contract';
import { graphFetch } from './graph-fetch';

type SendEmailInput = {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  isHtml?: boolean;
};

type SendEmail = (ctx: PluginContext, input: SendEmailInput) => Promise<string>;

const sendEmail: SendEmail = async (ctx, input) => {
  const toRecipients = input.to.map((email) => ({
    emailAddress: { address: email },
  }));

  const ccRecipients = (input.cc ?? []).map((email) => ({
    emailAddress: { address: email },
  }));

  const bccRecipients = (input.bcc ?? []).map((email) => ({
    emailAddress: { address: email },
  }));

  await graphFetch(ctx, '/me/sendMail', {
    method: 'POST',
    body: {
      message: {
        subject: input.subject,
        body: {
          contentType: input.isHtml ? 'HTML' : 'Text',
          content: input.body,
        },
        toRecipients,
        ccRecipients,
        bccRecipients,
      },
    },
  });

  return `Email sent to ${input.to.join(', ')}.`;
};

export { sendEmail };
