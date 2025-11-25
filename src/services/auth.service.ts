import { User } from '../models/user.model';
import { OTP, OTPType } from '../models/otp.model';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { ApiError } from '../utils/apiResponse';
import bcrypt from 'bcryptjs';
import { sendOTPEmail } from '../utils/email';

export async function register(username: string, password: string, email?: string) {
	// Kiểm tra username đã tồn tại chưa
	const existingUser = await User.findOne({ username: username.toLowerCase() });
	if (existingUser) {
		throw new ApiError(409, 'Username already exists');
	}

	// Kiểm tra email đã tồn tại chưa (nếu có email)
	if (email) {
		const normalizedEmail = email.toLowerCase().trim();
		const existingEmail = await User.findOne({ email: normalizedEmail });
		if (existingEmail) {
			throw new ApiError(409, 'Email already in use');
		}
	}

	const passwordHash = await bcrypt.hash(password, 10);
	const user = await User.create({ 
		username: username.toLowerCase(), 
		email: email ? email.toLowerCase().trim() : undefined, 
		passwordHash 
	});
	const token = generateToken(user.id);
	return { user: sanitize(user), token };
}

export async function login(identifier: string, password: string) {
	const user = await User.findOne({ $or: [{ username: identifier }, { email: identifier }] }).select('+passwordHash');
	if (!user) throw new ApiError(401, 'Invalid credentials');
	const valid = await bcrypt.compare(password, user.passwordHash);
	if (!valid) throw new ApiError(401, 'Invalid credentials');
	const token = generateToken(user.id);
	return { user: sanitize(user), token };
}

/**
 * Xác định loại identifier (phone hoặc email)
 */
function detectIdentifierType(identifier: string): { type: OTPType; isValid: boolean } {
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/;

	if (emailRegex.test(identifier)) {
		return { type: 'email', isValid: true };
	} else if (phoneRegex.test(identifier)) {
		return { type: 'phone', isValid: true };
	}

	return { type: 'email', isValid: false };
}

/**
 * Gửi OTP đến số điện thoại hoặc email
 * Tự động detect loại (phone hoặc email) và gửi tương ứng
 * @param identifier - Số điện thoại hoặc email
 * @returns Thông báo thành công
 */
export async function sendOTP(identifier: string): Promise<{ message: string; expiresIn: number; type: OTPType }> {
	// Detect loại identifier
	const { type, isValid } = detectIdentifierType(identifier);

	if (!isValid) {
		throw new ApiError(400, 'Invalid phone number or email format');
	}

	// Xóa OTP cũ chưa verify của identifier này
	await OTP.deleteMany({ type, identifier, verified: false });

	// Tạo mã OTP 6 chữ số
	const code = Math.floor(100000 + Math.random() * 900000).toString();

	// OTP hết hạn sau 5 phút
	const expiresAt = new Date();
	expiresAt.setMinutes(expiresAt.getMinutes() + 5);

	// Lưu OTP vào database
	await OTP.create({
		type,
		identifier,
		code,
		expiresAt,
		verified: false,
		attempts: 0,
	});

	// Gửi OTP tùy theo loại
	if (type === 'email') {
		// Gửi qua email (miễn phí)
		await sendOTPEmail(identifier, code);
	} else {
		// Gửi qua SMS (giả lập)
		await mockSendSMS(identifier, code);
	}

	return {
		message: 'OTP sent successfully',
		expiresIn: 300, // 5 phút (seconds)
		type,
	};
}

/**
 * Xác thực OTP
 * @param identifier - Số điện thoại hoặc email
 * @param code - Mã OTP
 * @returns User và JWT token (tạo user mới nếu chưa tồn tại)
 */
export async function verifyOTP(identifier: string, code: string): Promise<{ user: any; token: string; isNewUser: boolean }> {
	// Detect loại identifier
	const { type, isValid } = detectIdentifierType(identifier);

	if (!isValid) {
		throw new ApiError(400, 'Invalid phone number or email format');
	}

	// Tìm OTP chưa verify và chưa hết hạn
	const otpRecord = await OTP.findOne({
		type,
		identifier,
		code,
		verified: false,
		expiresAt: { $gt: new Date() },
	});

	if (!otpRecord) {
		// Tăng số lần thử
		const existingOTP = await OTP.findOne({ type, identifier, verified: false });
		if (existingOTP) {
			existingOTP.attempts += 1;
			await existingOTP.save();

			// Nếu thử quá 5 lần, xóa OTP
			if (existingOTP.attempts >= 5) {
				await OTP.deleteOne({ _id: existingOTP._id });
				throw new ApiError(400, 'Too many attempts. Please request a new OTP.');
			}
		}
		throw new ApiError(400, 'Invalid or expired OTP code');
	}

	// Đánh dấu OTP đã được verify
	otpRecord.verified = true;
	await otpRecord.save();

	// Tìm hoặc tạo user với identifier này
	let user: any = null;
	let isNewUser = false;

	if (type === 'phone') {
		user = await User.findOne({ phone: identifier });
		if (!user) {
			// Tạo user mới với phone
			const username = `user_${identifier.replace(/\D/g, '')}`;
			const passwordHash = await bcrypt.hash(Math.random().toString(36), 10);
			user = await User.create({
				username,
				phone: identifier,
				passwordHash,
			});
			isNewUser = true;
		}
	} else {
		// type === 'email'
		user = await User.findOne({ email: identifier });
		if (!user) {
			// Tạo user mới với email
			const username = `user_${identifier.split('@')[0]}`;
			const passwordHash = await bcrypt.hash(Math.random().toString(36), 10);
			user = await User.create({
				username,
				email: identifier,
				passwordHash,
			});
			isNewUser = true;
		}
	}

	// Tạo JWT token
	const token = generateToken(user.id);

	return {
		user: sanitize(user),
		token,
		isNewUser,
	};
}

/**
 * Giả lập gửi SMS qua Twilio
 * @param phone - Số điện thoại
 * @param code - Mã OTP
 */
async function mockSendSMS(phone: string, code: string): Promise<void> {
	// Mock implementation - chỉ log ra console
	console.log(`[SMS Mock] Sending OTP to ${phone}:`);
	console.log(`  Code: ${code}`);
	console.log(`  Message: "Your verification code is: ${code}. Valid for 5 minutes."`);

	// TODO: Thực tế sẽ gọi Twilio API:
	// const client = require('twilio')(accountSid, authToken);
	// await client.messages.create({
	//   body: `Your verification code is: ${code}. Valid for 5 minutes.`,
	//   from: '+1234567890',
	//   to: phone
	// });
}

function generateToken(userId: string) {
	const options: jwt.SignOptions = { expiresIn: env.JWT_EXPIRES_IN as any };
	return jwt.sign({ sub: userId }, env.JWT_SECRET as jwt.Secret, options);
}

/**
 * Đặt lại mật khẩu sau khi verify OTP
 * @param identifier - Số điện thoại hoặc email
 * @param code - Mã OTP
 * @param newPassword - Mật khẩu mới
 * @returns Thông báo thành công
 */
export async function resetPassword(identifier: string, code: string, newPassword: string): Promise<{ message: string }> {
	// Detect loại identifier
	const { type, isValid } = detectIdentifierType(identifier);

	if (!isValid) {
		throw new ApiError(400, 'Invalid phone number or email format');
	}

	// Tìm OTP (chưa verify hoặc đã verify trong vòng 10 phút) và chưa hết hạn
	// Cho phép dùng OTP đã verified trong vòng 10 phút để reset password
	const tenMinutesAgo = new Date();
	tenMinutesAgo.setMinutes(tenMinutesAgo.getMinutes() - 10);
	
	const otpRecord = await OTP.findOne({
		type,
		identifier,
		code,
		expiresAt: { $gt: new Date() },
		$or: [
			{ verified: false },
			{ verified: true, updatedAt: { $gte: tenMinutesAgo } }
		],
	});

	if (!otpRecord) {
		// Tăng số lần thử
		const existingOTP = await OTP.findOne({ type, identifier, verified: false });
		if (existingOTP) {
			existingOTP.attempts += 1;
			await existingOTP.save();

			// Nếu thử quá 5 lần, xóa OTP
			if (existingOTP.attempts >= 5) {
				await OTP.deleteOne({ _id: existingOTP._id });
				throw new ApiError(400, 'Too many attempts. Please request a new OTP.');
			}
		}
		throw new ApiError(400, 'Invalid or expired OTP code');
	}

	// Đánh dấu OTP đã được verify (nếu chưa verify)
	if (!otpRecord.verified) {
		otpRecord.verified = true;
		await otpRecord.save();
	}

	// Tìm user với identifier này
	let user: any = null;

	if (type === 'phone') {
		user = await User.findOne({ phone: identifier });
	} else {
		// type === 'email'
		user = await User.findOne({ email: identifier });
	}

	if (!user) {
		throw new ApiError(404, 'User not found');
	}

	// Cập nhật mật khẩu mới
	const passwordHash = await bcrypt.hash(newPassword, 10);
	user.passwordHash = passwordHash;
	await user.save();

	return {
		message: 'Password reset successfully',
	};
}

/**
 * Kiểm tra email đã tồn tại chưa
 * @param email - Email cần kiểm tra
 * @returns { available: boolean } - true nếu email có thể sử dụng, false nếu đã tồn tại
 */
export async function checkEmailAvailability(email: string): Promise<{ available: boolean }> {
	const normalizedEmail = email.toLowerCase().trim();
	const existingEmail = await User.findOne({ email: normalizedEmail });
	return { available: !existingEmail };
}

/**
 * Kiểm tra username đã tồn tại chưa
 * @param username - Username cần kiểm tra
 * @returns { available: boolean } - true nếu username có thể sử dụng, false nếu đã tồn tại
 */
export async function checkUsernameAvailability(username: string): Promise<{ available: boolean }> {
	const normalizedUsername = username.toLowerCase().trim();
	const existingUser = await User.findOne({ username: normalizedUsername });
	return { available: !existingUser };
}

function sanitize(user: any) {
	const { _id, username, displayName, email, phone, avatarUrl, roles, createdAt, updatedAt } = user.toObject();
	return { id: _id, username, displayName, email, phone, avatarUrl, roles, createdAt, updatedAt };
}
