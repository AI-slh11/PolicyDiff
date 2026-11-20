import nodemailer from 'nodemailer';
import { Invoice } from '@prisma/client';
import { logAudit } from '@/lib/audit';
import { getBankDetails } from './config';
import { generateInvoicePdf } from './invoice-pdf';

function getMailTransporter() {
  return nodemailer.createTransport({
    host: process.env.EMAIL_SERVER_HOST || 'smtp.example.com',
    port: Number(process.env.EMAIL_SERVER_PORT || 587),
    auth: {
      user: process.env.EMAIL_SERVER_USER || 'apikey',
      pass: process.env.EMAIL_SERVER_PASSWORD || '',
    },
  });
}

const FROM_EMAIL = process.env.EMAIL_FROM || 'noreply@policydiff.com';

export interface SendInvoiceEmailParams {
  invoice: Invoice;
  agencyName: string;
  recipientEmail: string;
}

/**
 * Send branded invoice email with PDF attachment and bank transfer details.
 * Strictly audit logs the email event.
 */
export async function sendInvoiceEmail(params: SendInvoiceEmailParams): Promise<void> {
  const { invoice, agencyName, recipientEmail } = params;
  const bank = getBankDetails();
  const pdfBuffer = generateInvoicePdf({
    invoice,
    agency: { name: agencyName, billingContactEmail: recipientEmail },
  });

  const formattedAmount = `$${(invoice.amountCents / 100).toFixed(2)}`;
  const dueDateStr = new Date(invoice.dueDate).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const subject = `Invoice ${invoice.invoiceNumber} from PolicyDiff for ${agencyName} (${formattedAmount})`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b;">
      <div style="background-color: #0f172a; padding: 24px; border-radius: 8px 8px 0 0; text-align: left;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px;">PolicyDiff</h1>
        <p style="color: #94a3b8; margin: 4px 0 0 0; font-size: 13px;">Commercial P&C Policy Comparison</p>
      </div>

      <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px; background: #ffffff;">
        <h2 style="color: #0f172a; margin-top: 0;">New Invoice Issued</h2>
        <p>Dear ${agencyName} team,</p>
        <p>Please find attached Invoice <strong>${invoice.invoiceNumber}</strong> for your upcoming PolicyDiff <strong>${invoice.plan}</strong> subscription.</p>

        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Invoice Number:</td>
            <td style="padding: 8px 0; font-weight: 600; text-align: right;">${invoice.invoiceNumber}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Amount Due:</td>
            <td style="padding: 8px 0; font-weight: 700; font-size: 18px; color: #0284c7; text-align: right;">${formattedAmount} USD</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Due Date:</td>
            <td style="padding: 8px 0; font-weight: 600; text-align: right;">${dueDateStr} (Net 7)</td>
          </tr>
        </table>

        <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 16px; margin: 24px 0;">
          <h3 style="margin-top: 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: #334155;">Bank Transfer Details</h3>
          <p style="font-size: 13px; color: #475569; margin: 0 0 12px 0;">Please transfer via ACH or Wire directly to our bank account:</p>
          <table style="width: 100%; font-size: 13px;">
            <tr><td style="color: #64748b; padding: 3px 0;">Beneficiary:</td><td><strong>${bank.beneficiaryName}</strong></td></tr>
            <tr><td style="color: #64748b; padding: 3px 0;">Bank:</td><td><strong>${bank.bankName}</strong></td></tr>
            <tr><td style="color: #64748b; padding: 3px 0;">Routing Number (ABA):</td><td><strong>${bank.routingNumber}</strong></td></tr>
            <tr><td style="color: #64748b; padding: 3px 0;">Account Number:</td><td><strong>${bank.accountNumber}</strong></td></tr>
            ${bank.swiftBic ? `<tr><td style="color: #64748b; padding: 3px 0;">SWIFT/BIC:</td><td><strong>${bank.swiftBic}</strong></td></tr>` : ''}
            <tr><td style="color: #b91c1c; padding: 6px 0; font-weight: bold;">Required Wire Memo / Reference:</td><td><strong style="color: #b91c1c; font-size: 15px;">${invoice.invoiceNumber}</strong></td></tr>
          </table>
          <p style="font-size: 12px; color: #64748b; margin: 12px 0 0 0;">Expected processing time: ${bank.processingEstimate}. Access is updated upon payment confirmation.</p>
        </div>

        <p style="font-size: 13px; color: #64748b;">The complete PDF invoice is attached for your accounting records.</p>
        <p style="font-size: 13px; color: #64748b;">Thank you for partnering with PolicyDiff!</p>
      </div>
    </div>
  `;

  try {
    const transporter = getMailTransporter();
    await transporter.sendMail({
      from: FROM_EMAIL,
      to: recipientEmail,
      subject,
      html,
      attachments: [
        {
          filename: `Invoice_${invoice.invoiceNumber}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });
  } catch (err) {
    console.warn(`[email] Failed to send email via SMTP (mocking in dev/test):`, err);
  }

  // Audit log the email
  await logAudit({
    agencyId: invoice.agencyId,
    action: 'billing.invoice_sent',
    details: {
      invoiceNumber: invoice.invoiceNumber,
      amountCents: invoice.amountCents,
      recipientEmail,
      sentAt: new Date().toISOString(),
    },
  });
}

/**
 * Send overdue / reminder email
 */
export async function sendReminderEmail(params: {
  invoice: Invoice;
  agencyName: string;
  recipientEmail: string;
  type: 'DUE_DATE' | 'GRACE_WARNING' | 'SUSPENSION_NOTICE';
}): Promise<void> {
  const { invoice, agencyName, recipientEmail, type } = params;
  const bank = getBankDetails();
  const formattedAmount = `$${(invoice.amountCents / 100).toFixed(2)}`;

  let subject = '';
  let headline = '';
  let bodyMessage = '';

  if (type === 'DUE_DATE') {
    subject = `Reminder: Invoice ${invoice.invoiceNumber} is due today (${formattedAmount})`;
    headline = 'Payment Reminder';
    bodyMessage = `This is a friendly reminder that Invoice ${invoice.invoiceNumber} is due today. Please ensure your wire or ACH transfer has been submitted with memo: ${invoice.invoiceNumber}.`;
  } else if (type === 'GRACE_WARNING') {
    subject = `Action Required: PolicyDiff Invoice ${invoice.invoiceNumber} overdue - Grace period active`;
    headline = 'Grace Period Notice';
    bodyMessage = `Invoice ${invoice.invoiceNumber} is now overdue. Your account has entered a 7-day grace period. Please submit payment immediately to prevent service suspension.`;
  } else {
    subject = `URGENT: PolicyDiff subscription suspended for ${agencyName}`;
    headline = 'Subscription Suspended';
    bodyMessage = `Because payment for Invoice ${invoice.invoiceNumber} was not received, new policy comparisons have been suspended. Your existing checks, data, and exports remain available. Full access will be restored immediately upon recording payment.`;
  }

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b;">
      <div style="background-color: ${type === 'SUSPENSION_NOTICE' ? '#991b1b' : type === 'GRACE_WARNING' ? '#c2410c' : '#0f172a'}; padding: 20px; color: white;">
        <h2 style="margin: 0;">PolicyDiff — ${headline}</h2>
      </div>
      <div style="padding: 24px; border: 1px solid #e2e8f0; background: white;">
        <p>Dear ${agencyName} team,</p>
        <p>${bodyMessage}</p>
        <p><strong>Amount Due:</strong> ${formattedAmount} USD<br/>
           <strong>Invoice Reference:</strong> ${invoice.invoiceNumber}</p>
        <div style="background: #f8fafc; padding: 14px; border: 1px solid #cbd5e1; margin: 16px 0;">
          <strong>Wire Details:</strong><br/>
          Bank: ${bank.bankName}<br/>
          Account: ${bank.accountNumber}<br/>
          Routing: ${bank.routingNumber}<br/>
          Memo / Ref: <strong>${invoice.invoiceNumber}</strong>
        </div>
        <p>Contact: ${bank.supportEmail}</p>
      </div>
    </div>
  `;

  try {
    const transporter = getMailTransporter();
    await transporter.sendMail({
      from: FROM_EMAIL,
      to: recipientEmail,
      subject,
      html,
    });
  } catch (err) {
    console.warn(`[email] Failed to send reminder email (mocking in dev/test):`, err);
  }

  await logAudit({
    agencyId: invoice.agencyId,
    action: 'billing.reminder_sent',
    details: {
      type,
      invoiceNumber: invoice.invoiceNumber,
      recipientEmail,
      sentAt: new Date().toISOString(),
    },
  });
}
