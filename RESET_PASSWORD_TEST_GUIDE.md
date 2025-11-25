# Hướng Dẫn Test API Reset Password

## 📋 Tổng Quan

API Reset Password cho phép người dùng đặt lại mật khẩu sau khi đã verify OTP thành công. API này hỗ trợ cả email và số điện thoại.

## 🔄 Flow Hoàn Chỉnh

```
1. User quên mật khẩu
   ↓
2. Gửi OTP (Send OTP)
   ↓
3. Verify OTP (tùy chọn - có thể bỏ qua)
   ↓
4. Reset Password với OTP đã verify
   ↓
5. Đăng nhập với mật khẩu mới
```

## 🧪 Test Cases

### Test Case 1: Reset Password Thành Công (OTP chưa verify)

**Bước 1: Gửi OTP**
```bash
POST http://localhost:4000/api/auth/send-otp
Content-Type: application/json

{
  "identifier": "testuser@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP sent successfully",
  "data": {
    "message": "OTP sent successfully",
    "expiresIn": 300,
    "type": "email"
  }
}
```

**Bước 2: Lấy mã OTP từ console log (development) hoặc email (production)**

**Bước 3: Reset Password (không cần verify OTP trước)**
```bash
POST http://localhost:4000/api/auth/reset-password
Content-Type: application/json

{
  "identifier": "testuser@example.com",
  "code": "123456",
  "newPassword": "newpassword123"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Password reset successfully",
  "data": {
    "message": "Password reset successfully"
  }
}
```

**Bước 4: Verify mật khẩu mới bằng cách đăng nhập**
```bash
POST http://localhost:4000/api/auth/login
Content-Type: application/json

{
  "identifier": "testuser@example.com",
  "password": "newpassword123"
}
```

---

### Test Case 2: Reset Password với OTP đã verify (trong vòng 10 phút)

**Bước 1: Gửi OTP**
```bash
POST http://localhost:4000/api/auth/send-otp
Content-Type: application/json

{
  "identifier": "testuser@example.com"
}
```

**Bước 2: Verify OTP**
```bash
POST http://localhost:4000/api/auth/verify-otp
Content-Type: application/json

{
  "identifier": "testuser@example.com",
  "code": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP verified successfully",
  "data": {
    "user": {...},
    "token": "...",
    "isNewUser": false
  }
}
```

**Bước 3: Reset Password với OTP đã verify (trong vòng 10 phút)**
```bash
POST http://localhost:4000/api/auth/reset-password
Content-Type: application/json

{
  "identifier": "testuser@example.com",
  "code": "123456",
  "newPassword": "newpassword456"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Password reset successfully",
  "data": {
    "message": "Password reset successfully"
  }
}
```

---

### Test Case 3: OTP không hợp lệ

**Request:**
```bash
POST http://localhost:4000/api/auth/reset-password
Content-Type: application/json

{
  "identifier": "testuser@example.com",
  "code": "999999",
  "newPassword": "newpassword123"
}
```

**Response (400):**
```json
{
  "success": false,
  "message": "Invalid or expired OTP code"
}
```

---

### Test Case 4: OTP đã hết hạn

**Request:**
```bash
POST http://localhost:4000/api/auth/reset-password
Content-Type: application/json

{
  "identifier": "testuser@example.com",
  "code": "123456",
  "newPassword": "newpassword123"
}
```

**Response (400):**
```json
{
  "success": false,
  "message": "Invalid or expired OTP code"
}
```

**Lưu ý:** OTP có thời gian hết hạn là 5 phút (300 giây)

---

### Test Case 5: Quá nhiều lần thử sai

**Request (thử sai 5 lần):**
```bash
POST http://localhost:4000/api/auth/reset-password
Content-Type: application/json

{
  "identifier": "testuser@example.com",
  "code": "111111",
  "newPassword": "newpassword123"
}
```

**Lặp lại request trên 5 lần với mã OTP sai**

**Response (400) - Lần thứ 5:**
```json
{
  "success": false,
  "message": "Too many attempts. Please request a new OTP."
}
```

**Sau đó, OTP sẽ bị xóa và bạn cần request OTP mới**

---

### Test Case 6: User không tồn tại

**Request:**
```bash
POST http://localhost:4000/api/auth/reset-password
Content-Type: application/json

{
  "identifier": "nonexistent@example.com",
  "code": "123456",
  "newPassword": "newpassword123"
}
```

**Response (404):**
```json
{
  "success": false,
  "message": "User not found"
}
```

---

### Test Case 7: Mật khẩu quá ngắn

**Request:**
```bash
POST http://localhost:4000/api/auth/reset-password
Content-Type: application/json

{
  "identifier": "testuser@example.com",
  "code": "123456",
  "newPassword": "12345"
}
```

**Response (400):**
```json
{
  "success": false,
  "message": "Validation error",
  "errors": [
    {
      "field": "newPassword",
      "message": "String must contain at least 6 character(s)"
    }
  ]
}
```

---

### Test Case 8: OTP code không đúng format

**Request:**
```bash
POST http://localhost:4000/api/auth/reset-password
Content-Type: application/json

{
  "identifier": "testuser@example.com",
  "code": "12345",
  "newPassword": "newpassword123"
}
```

**Response (400):**
```json
{
  "success": false,
  "message": "Validation error",
  "errors": [
    {
      "field": "code",
      "message": "String must contain exactly 6 character(s)"
    }
  ]
}
```

---

## 📝 Test với cURL

### Script test hoàn chỉnh:

```bash
#!/bin/bash

# Biến
BASE_URL="http://localhost:4000/api/auth"
EMAIL="testuser@example.com"
NEW_PASSWORD="newpassword123"

echo "=== Bước 1: Gửi OTP ==="
SEND_OTP_RESPONSE=$(curl -s -X POST "$BASE_URL/send-otp" \
  -H "Content-Type: application/json" \
  -d "{\"identifier\": \"$EMAIL\"}")

echo "$SEND_OTP_RESPONSE" | jq '.'

# Lấy mã OTP từ console log hoặc email
echo ""
echo "Nhập mã OTP (6 chữ số): "
read OTP_CODE

echo ""
echo "=== Bước 2: Reset Password ==="
RESET_RESPONSE=$(curl -s -X POST "$BASE_URL/reset-password" \
  -H "Content-Type: application/json" \
  -d "{
    \"identifier\": \"$EMAIL\",
    \"code\": \"$OTP_CODE\",
    \"newPassword\": \"$NEW_PASSWORD\"
  }")

echo "$RESET_RESPONSE" | jq '.'

echo ""
echo "=== Bước 3: Test đăng nhập với mật khẩu mới ==="
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"identifier\": \"$EMAIL\",
    \"password\": \"$NEW_PASSWORD\"
  }")

echo "$LOGIN_RESPONSE" | jq '.'
```

---

## 📝 Test với Postman

### Collection JSON:

```json
{
  "name": "Reset Password Flow",
  "item": [
    {
      "name": "1. Send OTP",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"identifier\": \"testuser@example.com\"\n}"
        },
        "url": {
          "raw": "{{base_url}}/api/auth/send-otp",
          "host": ["{{base_url}}"],
          "path": ["api", "auth", "send-otp"]
        }
      }
    },
    {
      "name": "2. Reset Password",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"identifier\": \"testuser@example.com\",\n  \"code\": \"{{otp_code}}\",\n  \"newPassword\": \"newpassword123\"\n}"
        },
        "url": {
          "raw": "{{base_url}}/api/auth/reset-password",
          "host": ["{{base_url}}"],
          "path": ["api", "auth", "reset-password"]
        }
      }
    },
    {
      "name": "3. Login với mật khẩu mới",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"identifier\": \"testuser@example.com\",\n  \"password\": \"newpassword123\"\n}"
        },
        "url": {
          "raw": "{{base_url}}/api/auth/login",
          "host": ["{{base_url}}"],
          "path": ["api", "auth", "login"]
        }
      }
    }
  ]
}
```

---

## 🔍 Debug Tips

### 1. Kiểm tra OTP trong Database

```javascript
// MongoDB
db.otps.find({ identifier: "testuser@example.com" }).sort({ createdAt: -1 }).limit(1)
```

### 2. Kiểm tra OTP trong Console Log

Trong development mode, OTP sẽ được log ra console:
```
[OTP] Email: testuser@example.com, Code: 123456
```

### 3. Kiểm tra User đã được cập nhật mật khẩu

```javascript
// MongoDB
db.users.findOne({ email: "testuser@example.com" })
```

### 4. Test với Phone Number

```bash
POST http://localhost:4000/api/auth/reset-password
Content-Type: application/json

{
  "identifier": "+84123456789",
  "code": "123456",
  "newPassword": "newpassword123"
}
```

---

## ⚠️ Lưu Ý Quan Trọng

1. **OTP Expiry:** OTP có thời gian hết hạn là 5 phút (300 giây)
2. **OTP Reuse:** OTP đã verify có thể được sử dụng để reset password trong vòng 10 phút
3. **Attempts Limit:** Nếu nhập sai OTP quá 5 lần, OTP sẽ bị xóa
4. **Password Requirements:** Mật khẩu mới phải có ít nhất 6 ký tự
5. **OTP Format:** OTP code phải là 6 chữ số (0-9)
6. **Identifier:** Có thể là email hoặc số điện thoại (format: +84xxxxxxxxx)

---

## ✅ Checklist Test

- [ ] Reset password thành công với OTP chưa verify
- [ ] Reset password thành công với OTP đã verify (trong 10 phút)
- [ ] Error khi OTP không hợp lệ
- [ ] Error khi OTP đã hết hạn
- [ ] Error khi quá nhiều lần thử sai
- [ ] Error khi user không tồn tại
- [ ] Error khi mật khẩu quá ngắn
- [ ] Error khi OTP code không đúng format
- [ ] Test với email
- [ ] Test với số điện thoại
- [ ] Verify mật khẩu mới bằng cách đăng nhập

