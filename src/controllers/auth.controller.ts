import { Request, Response, NextFunction } from 'express';
import * as AuthService from '../services/auth.service';
import { ok, ApiError } from '../utils/apiResponse';
import { asyncHandler } from '../utils/asyncHandler';

export const register = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const { username, password, email } = req.body as { username: string; password: string; email?: string };
		const result = await AuthService.register(username, password, email);
		return res.status(201).json(ok(result, 'registered'));
	} catch (error) {
		// Xử lý lỗi email trùng với message tiếng Việt
		if (error instanceof ApiError && error.message === 'Email already in use') {
			return res.status(409).json({ success: false, message: 'Email này đã được sử dụng.' });
		}
		// Pass các lỗi khác cho error middleware
		return next(error);
	}
};

export const login = asyncHandler(async (req: Request, res: Response) => {
	const { identifier, password } = req.body as { identifier: string; password: string };
	const result = await AuthService.login(identifier, password);
	return res.json(ok(result, 'logged-in'));
});

/**
 * Gửi OTP đến số điện thoại hoặc email
 * POST /api/auth/send-otp
 * Body: { identifier: string } - phone hoặc email
 */
export const sendOTP = asyncHandler(async (req: Request, res: Response) => {
	const { identifier } = req.body as { identifier: string };

	if (!identifier) {
		return res.status(400).json({ success: false, message: 'Phone number or email is required' });
	}

	const result = await AuthService.sendOTP(identifier);
	return res.status(200).json(ok(result, 'OTP sent successfully'));
});

/**
 * Xác thực OTP
 * POST /api/auth/verify-otp
 * Body: { identifier: string, code: string } - identifier là phone hoặc email
 */
export const verifyOTP = asyncHandler(async (req: Request, res: Response) => {
	const { identifier, code } = req.body as { identifier: string; code: string };

	if (!identifier || !code) {
		return res.status(400).json({ success: false, message: 'Phone/email and OTP code are required' });
	}

	const result = await AuthService.verifyOTP(identifier, code);
	return res.status(200).json(ok(result, 'OTP verified successfully'));
});

/**
 * Kiểm tra email đã tồn tại chưa
 * GET /api/auth/check-email/:email
 */
export const checkEmail = asyncHandler(async (req: Request, res: Response) => {
	const email = req.params.email;

	if (!email) {
		return res.status(400).json({ success: false, message: 'Email is required' });
	}

	// Validate email format
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	if (!emailRegex.test(email)) {
		return res.status(400).json({ success: false, message: 'Invalid email format' });
	}

	const result = await AuthService.checkEmailAvailability(email);
	return res.status(200).json(ok(result, result.available ? 'Email is available' : 'Email already in use'));
});

/**
 * Kiểm tra username đã tồn tại chưa
 * GET /api/auth/check-username/:username
 */
export const checkUsername = asyncHandler(async (req: Request, res: Response) => {
	const username = req.params.username;

	if (!username) {
		return res.status(400).json({ success: false, message: 'Username is required' });
	}

	// Validate username length
	if (username.length < 3) {
		return res.status(400).json({ success: false, message: 'Username must be at least 3 characters' });
	}

	const result = await AuthService.checkUsernameAvailability(username);
	return res.status(200).json(ok(result, result.available ? 'Username is available' : 'Username already exists'));
});

/**
 * Đặt lại mật khẩu sau khi verify OTP
 * POST /api/auth/reset-password
 * Body: { identifier: string, code: string, newPassword: string }
 */
export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
	const { identifier, code, newPassword } = req.body as { identifier: string; code: string; newPassword: string };

	if (!identifier || !code || !newPassword) {
		return res.status(400).json({ success: false, message: 'Phone/email, OTP code, and new password are required' });
	}

	if (newPassword.length < 6) {
		return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
	}

	const result = await AuthService.resetPassword(identifier, code, newPassword);
	return res.status(200).json(ok(result, 'Password reset successfully'));
});