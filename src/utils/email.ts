import nodemailer from 'nodemailer';
import { env } from '../config/env';

/**
 * Tạo transporter để gửi email (dùng Gmail SMTP miễn phí)
 */
const transporter = nodemailer.createTransport({
  host: env.EMAIL_HOST,
  port: env.EMAIL_PORT,
  secure: false, // true cho 465, false cho các port khác
  auth: {
    user: env.EMAIL_USER,
    pass: env.EMAIL_PASS,
  },
});

/**
 * Gửi OTP qua email
 * @param email - Email address
 * @param code - Mã OTP
 */
export async function sendOTPEmail(email: string, code: string): Promise<void> {
  // Nếu không có email config, chỉ log ra console (development)
  if (!env.EMAIL_USER || !env.EMAIL_PASS) {
    console.log(`[Email Mock] Sending OTP to ${email}:`);
    console.log(`  Code: ${code}`);
    console.log(`  Message: "Your verification code is: ${code}. Valid for 5 minutes."`);
    return;
  }

  try {
    const mailOptions = {
      from: env.EMAIL_FROM,
      to: email,
      subject: 'Your Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Verification Code</h2>
          <p>Your verification code is:</p>
          <div style="background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
            ${code}
          </div>
          <p>This code will expire in 5 minutes.</p>
          <p style="color: #666; font-size: 12px;">If you didn't request this code, please ignore this email.</p>
        </div>
      `,
      text: `Your verification code is: ${code}. Valid for 5 minutes.`,
    };

    await transporter.sendMail(mailOptions);
    console.log(`[Email] OTP sent successfully to ${email}`);
  } catch (error) {
    console.error('Error sending email:', error);
    // Fallback: log ra console nếu gửi email thất bại
    console.log(`[Email Fallback] OTP for ${email}: ${code}`);
    throw error;
  }
}

/**
 * Verify email transporter connection
 */
export async function verifyEmailConnection(): Promise<boolean> {
  if (!env.EMAIL_USER || !env.EMAIL_PASS) {
    return false;
  }

  try {
    await transporter.verify();
    return true;
  } catch (error) {
    console.error('Email transporter verification failed:', error);
    return false;
  }
}

