import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT, 10) || 587,
  secure: process.env.SMTP_SECURE === '1',
  auth: process.env.SMTP_USER
    ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS || process.env.SMTP_PASSWORD,
      }
    : undefined,
});

const FROM = process.env.MAIL_FROM || process.env.SMTP_USER || 'noreply@cineviet.local';
const SITE_NAME = process.env.SITE_NAME || 'CineViet';

/**
 * Gửi email chứa mã PIN 6 số xác thực.
 * @param {string} to - Email người nhận
 * @param {string} code - Mã 6 chữ số
 * @returns {Promise<boolean>} true nếu gửi thành công
 */
export async function sendVerificationEmail(to, code) {
  if (!to || !code || String(code).length !== 6) return false;
  try {
    await transporter.sendMail({
      from: FROM,
      to,
      subject: `[${SITE_NAME}] Mã xác thực email của bạn`,
      text: `Mã xác thực email của bạn là: ${code}. Mã có hiệu lực trong 10 phút.`,
      html: `
        <p>Xin chào,</p>
        <p>Chúng tôi đã nhận được yêu cầu xác thực tài khoản. Mã PIN 6 số của bạn là:</p>
        <p style="font-size:24px;letter-spacing:6px;font-weight:bold;">${code}</p>
        <p>Mã có hiệu lực trong <strong>10 phút</strong>. Không chia sẻ mã này với ai.</p>
        <p>— ${SITE_NAME}</p>
      `,
    });
    return true;
  } catch (err) {
    console.error('Send verification email error:', err?.message);
    return false;
  }
}

export function isEmailConfigured() {
  return !!(process.env.SMTP_HOST || process.env.SMTP_USER);
}
