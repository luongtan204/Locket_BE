# Hướng Dẫn Test API - Locket Backend

## 📋 Mục Lục
1. [Setup](#setup)
2. [Authentication](#authentication)
3. [Friendship](#friendship)
4. [Post (Upload Moment)](#post-upload-moment)
5. [Feed](#feed)
6. [Reactions](#reactions)
7. [Comments](#comments)
8. [Recap Video](#recap-video)
9. [Chat](#chat)

---

## Setup

### 1. Cài đặt Dependencies
```bash
npm install
```

### 2. Cấu hình Environment Variables
Tạo file `.env` trong thư mục root:
```env
NODE_ENV=development
PORT=4000
MONGO_URI=mongodb://localhost:27017/locket
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=7d

# Cloudinary (cho upload ảnh)
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Email (cho OTP - miễn phí với Gmail)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=your-email@gmail.com

# Recap Job Interval (phút)
RECAP_JOB_INTERVAL_MINUTES=60
```

### 3. Seed Database
```bash
npm run seed
```

### 4. Chạy Server
```bash
npm run dev
```

Server sẽ chạy tại: `http://localhost:4000`

---

## Authentication

### 1. Register (Tạo tài khoản)
**Endpoint:** `POST /api/auth/register`

**Request:**
```json
{
  "username": "testuser",
  "password": "password123",
  "email": "testuser@example.com"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "registered",
  "data": {
    "user": {
      "id": "652000000000000000000001",
      "username": "testuser",
      "email": "testuser@example.com",
      "roles": ["user"],
      "createdAt": "2025-01-24T10:00:00.000Z",
      "updatedAt": "2025-01-24T10:00:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### 2. Login
**Endpoint:** `POST /api/auth/login`

**Request:**
```json
{
  "identifier": "testuser",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "logged-in",
  "data": {
    "user": {
      "id": "652000000000000000000001",
      "username": "testuser",
      "email": "testuser@example.com",
      "roles": ["user"]
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### 3. Send OTP (Email hoặc Phone)
**Endpoint:** `POST /api/auth/send-otp`

**Request (Email):**
```json
{
  "identifier": "user@example.com"
}
```

**Request (Phone):**
```json
{
  "identifier": "+84123456789"
}
```

**Response (200):**
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

**Lưu ý:** OTP sẽ được log ra console (development) hoặc gửi qua email (production)

### 4. Verify OTP
**Endpoint:** `POST /api/auth/verify-otp`

**Request:**
```json
{
  "identifier": "user@example.com",
  "code": "123456"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "OTP verified successfully",
  "data": {
    "user": {
      "id": "652000000000000000000001",
      "username": "user_example",
      "email": "user@example.com",
      "phone": null,
      "roles": ["user"]
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "isNewUser": true
  }
}
```

### 5. Reset Password (Đổi mật khẩu)
**Endpoint:** `POST /api/auth/reset-password`

**Mô tả:** API này cho phép đặt lại mật khẩu sau khi đã verify OTP thành công. OTP có thể là:
- OTP chưa được verify (verified: false)
- OTP đã được verify trong vòng 10 phút gần đây (verified: true, updatedAt >= 10 phút trước)

**Request:**
```json
{
  "identifier": "user@example.com",
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

**Response (400) - OTP không hợp lệ hoặc đã hết hạn:**
```json
{
  "success": false,
  "message": "Invalid or expired OTP code"
}
```

**Response (400) - Quá nhiều lần thử:**
```json
{
  "success": false,
  "message": "Too many attempts. Please request a new OTP."
}
```

**Response (404) - Không tìm thấy user:**
```json
{
  "success": false,
  "message": "User not found"
}
```

**Flow test hoàn chỉnh:**

**Bước 1: Gửi OTP**
```bash
curl -X POST http://localhost:4000/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "user@example.com"
  }'
```

**Bước 2: Lấy mã OTP từ console log hoặc email**

**Bước 3: Verify OTP (tùy chọn - có thể bỏ qua và dùng trực tiếp ở bước 4)**
```bash
curl -X POST http://localhost:4000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "user@example.com",
    "code": "123456"
  }'
```

**Bước 4: Reset Password với OTP đã verify**
```bash
curl -X POST http://localhost:4000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "user@example.com",
    "code": "123456",
    "newPassword": "newpassword123"
  }'
```

**Bước 5: Test đăng nhập với mật khẩu mới**
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "user@example.com",
    "password": "newpassword123"
  }'
```

**Lưu ý quan trọng:**
- OTP có thời gian hết hạn (mặc định 5 phút)
- OTP đã verify có thể được sử dụng để reset password trong vòng 10 phút
- Nếu nhập sai OTP quá 5 lần, OTP sẽ bị xóa và cần request OTP mới
- Mật khẩu mới phải có ít nhất 6 ký tự
- OTP code phải là 6 chữ số

---

## Friendship

### 1. Send Friend Request
**Endpoint:** `POST /api/friendships/request`

**Headers:**
```
Authorization: Bearer <token>
```

**Request:**
```json
{
  "toUserId": "652000000000000000000002"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Friend request sent successfully",
  "data": {
    "_id": "659000000000000000000001",
    "userA": "652000000000000000000001",
    "userB": "652000000000000000000002",
    "requestedBy": "652000000000000000000001",
    "status": "pending",
    "createdAt": "2025-01-24T10:00:00.000Z",
    "updatedAt": "2025-01-24T10:00:00.000Z"
  }
}
```

### 2. Accept Friend Request
**Endpoint:** `POST /api/friendships/:requestId/accept`

**Headers:**
```
Authorization: Bearer <token>
```

**Request:** (không cần body)

**Response (200):**
```json
{
  "success": true,
  "message": "Friend request accepted successfully",
  "data": {
    "_id": "659000000000000000000001",
    "status": "accepted",
    "acceptedAt": "2025-01-24T10:05:00.000Z"
  }
}
```

### 3. Reject Friend Request
**Endpoint:** `POST /api/friendships/:requestId/reject`

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "success": true,
  "message": "Friend request rejected successfully",
  "data": null
}
```

---

## Post (Upload Moment)

### 1. Create Post
**Endpoint:** `POST /api/posts`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Request (Form Data):**
```
image: <file> (required)
caption: "Sáng nay nắng đẹp!" (optional)
locationName: "Hanoi" (optional)
lat: 21.03 (optional)
lng: 105.85 (optional)
visibility: "friends" (optional, default: "friends")
```

**cURL Example:**
```bash
curl -X POST http://localhost:4000/api/posts \
  -H "Authorization: Bearer <token>" \
  -F "image=@/path/to/image.jpg" \
  -F "caption=Sáng nay nắng đẹp!" \
  -F "locationName=Hanoi" \
  -F "lat=21.03" \
  -F "lng=105.85"
```

**Response (201):**
```json
{
  "success": true,
  "message": "Post created successfully",
  "data": {
    "_id": "656000000000000000000001",
    "author": "652000000000000000000001",
    "imageUrl": "https://res.cloudinary.com/.../image.jpg",
    "caption": "Sáng nay nắng đẹp!",
    "location": {
      "name": "Hanoi",
      "lat": 21.03,
      "lng": 105.85
    },
    "visibility": "friends",
    "reactionCount": 0,
    "commentCount": 0,
    "reactionCounts": {},
    "createdAt": "2025-01-24T10:00:00.000Z",
    "updatedAt": "2025-01-24T10:00:00.000Z"
  }
}
```

**Lưu ý:** 
- File sẽ được upload lên Cloudinary
- Push notification sẽ được gửi đến bạn bè (log ra console)

---

## Feed

### 1. Get Feed
**Endpoint:** `GET /api/feed?page=1&limit=20`

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "success": true,
  "message": "Feed retrieved successfully",
  "data": [
    {
      "type": "post",
      "data": {
        "_id": "656000000000000000000001",
        "author": {
          "_id": "652000000000000000000001",
          "username": "alice",
          "displayName": "Alice",
          "avatarUrl": null
        },
        "imageUrl": "https://res.cloudinary.com/.../image.jpg",
        "caption": "Sáng nay nắng đẹp!",
        "reactionCount": 2,
        "commentCount": 1,
        "createdAt": "2025-01-24T10:00:00.000Z"
      }
    },
    {
      "type": "ad",
      "data": {
        "_id": "65b000000000000000000001",
        "name": "Brand A - Feed Image",
        "imageUrl": "https://example.com/ads/brand-a.jpg",
        "title": "Brand A",
        "description": "Ưu đãi đặc biệt tháng này",
        "ctaText": "Mua ngay",
        "ctaUrl": "https://brand-a.example.com"
      }
    }
  ]
}
```

**Lưu ý:**
- Nếu user không premium, ads sẽ được chèn sau mỗi 20 posts
- Premium users sẽ không thấy ads

---

## Reactions

### 1. Add/Update Reaction
**Endpoint:** `POST /api/posts/:id/react`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request:**
```json
{
  "type": "heart"
}
```

**Valid Types:** `heart`, `smile`, `laugh`, `shock`, `sad`, `thumbsup`

**Response (200):**
```json
{
  "success": true,
  "message": "Reaction added successfully",
  "data": {
    "_id": "658000000000000000000001",
    "post": "656000000000000000000001",
    "user": "652000000000000000000001",
    "type": "heart",
    "createdAt": "2025-01-24T10:00:00.000Z",
    "updatedAt": "2025-01-24T10:00:00.000Z"
  }
}
```

### 2. Remove Reaction
**Endpoint:** `DELETE /api/posts/:id/react`

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "success": true,
  "message": "Reaction removed successfully",
  "data": null
}
```

### 3. Get User Reaction
**Endpoint:** `GET /api/posts/:id/react`

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "success": true,
  "message": "Reaction retrieved successfully",
  "data": {
    "_id": "658000000000000000000001",
    "type": "heart",
    "createdAt": "2025-01-24T10:00:00.000Z"
  }
}
```

---

## Comments

### 1. Create Comment
**Endpoint:** `POST /api/posts/:id/comment`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request:**
```json
{
  "content": "Đẹp quá!",
  "parentCommentId": null,
  "mentions": ["652000000000000000000001"]
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Comment created successfully",
  "data": {
    "_id": "657000000000000000000001",
    "post": "656000000000000000000001",
    "author": "652000000000000000000001",
    "content": "Đẹp quá!",
    "parentComment": null,
    "mentions": ["652000000000000000000001"],
    "isDeleted": false,
    "createdAt": "2025-01-24T10:00:00.000Z",
    "updatedAt": "2025-01-24T10:00:00.000Z"
  }
}
```

### 2. Create Reply (Nested Comment)
**Request:**
```json
{
  "content": "Cảm ơn bạn!",
  "parentCommentId": "657000000000000000000001",
  "mentions": ["652000000000000000000002"]
}
```

### 3. Get Post Comments
**Endpoint:** `GET /api/posts/:id/comments?page=1&limit=20`

**Response (200):**
```json
{
  "success": true,
  "message": "Comments retrieved successfully",
  "data": [
    {
      "_id": "657000000000000000000001",
      "author": {
        "_id": "652000000000000000000002",
        "username": "bob",
        "displayName": "Bob",
        "avatarUrl": null
      },
      "content": "Đẹp quá!",
      "mentions": [
        {
          "_id": "652000000000000000000001",
          "username": "alice",
          "displayName": "Alice"
        }
      ],
      "createdAt": "2025-01-24T10:00:00.000Z"
    }
  ]
}
```

### 4. Get Comment Replies
**Endpoint:** `GET /api/comments/:id/replies?page=1&limit=10`

**Response (200):**
```json
{
  "success": true,
  "message": "Replies retrieved successfully",
  "data": [
    {
      "_id": "657000000000000000000002",
      "author": {
        "_id": "652000000000000000000001",
        "username": "alice",
        "displayName": "Alice"
      },
      "content": "Cảm ơn Bob!",
      "parentComment": "657000000000000000000001",
      "createdAt": "2025-01-24T10:05:00.000Z"
    }
  ]
}
```

### 5. Delete Comment
**Endpoint:** `DELETE /api/comments/:id`

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "success": true,
  "message": "Comment deleted successfully",
  "data": null
}
```

---

## Recap Video

### Background Job
Recap job tự động chạy mỗi 60 phút (config trong `.env`):
- Tạo recap video records cho tháng trước
- Xử lý các videos chưa được processed

**Logs sẽ hiển thị:**
```
[RecapJob] Starting job execution...
[RecapJob] Step 1: Generating recap video records...
[RecapService] Generated 3 recap videos, 0 errors
[RecapJob] Step 2: Processing unprocessed videos...
[RecapService] Processing video for recap 65f000000000000000000001...
[RecapService] Video processed successfully: https://example.com/recaps/65f000000000000000000001.mp4
```

---

## Test Flow (Thứ tự test)

### 1. Setup & Authentication
```bash
# 1. Register user mới
POST /api/auth/register

# 2. Login để lấy token
POST /api/auth/login

# 3. Lưu token để dùng cho các request sau
TOKEN="<token từ response>"
```

### 2. Friendship Flow
```bash
# 1. User A gửi friend request cho User B
POST /api/friendships/request
{
  "toUserId": "<userB_id>"
}

# 2. User B chấp nhận request
POST /api/friendships/<requestId>/accept

# 3. Bây giờ họ đã là bạn bè
```

### 3. Post & Feed Flow
```bash
# 1. User A tạo post
POST /api/posts (multipart/form-data với image)

# 2. User B xem feed (sẽ thấy post của User A)
GET /api/feed

# 3. User B thả reaction
POST /api/posts/<postId>/react
{
  "type": "heart"
}

# 4. User B comment
POST /api/posts/<postId>/comment
{
  "content": "Đẹp quá!"
}

# 5. User A xem comments
GET /api/posts/<postId>/comments
```

### 4. Premium & Ads Flow
```bash
# 1. User không premium xem feed (sẽ thấy ads)
GET /api/feed

# 2. User premium xem feed (không thấy ads)
GET /api/feed
# (cần có subscription active)
```

---

## Postman Collection

### Import vào Postman
Tạo collection với các requests sau:

1. **Auth**
   - Register
   - Login
   - Send OTP
   - Verify OTP

2. **Friendship**
   - Send Request
   - Accept Request
   - Reject Request

3. **Post**
   - Create Post (multipart/form-data)
   - Get Feed

4. **Reaction**
   - Add Reaction
   - Remove Reaction
   - Get User Reaction

5. **Comment**
   - Create Comment
   - Get Comments
   - Delete Comment
   - Get Replies

### Environment Variables trong Postman
```
base_url: http://localhost:4000
token: <token từ login>
user_id: <user id>
post_id: <post id>
```

---

## cURL Examples

### 1. Register
```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "password123",
    "email": "test@example.com"
  }'
```

### 2. Login
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "testuser",
    "password": "password123"
  }'
```

### 3. Create Post
```bash
curl -X POST http://localhost:4000/api/posts \
  -H "Authorization: Bearer <token>" \
  -F "image=@/path/to/image.jpg" \
  -F "caption=Test post"
```

### 4. Get Feed
```bash
curl -X GET "http://localhost:4000/api/feed?page=1&limit=20" \
  -H "Authorization: Bearer <token>"
```

### 5. Add Reaction
```bash
curl -X POST http://localhost:4000/api/posts/<postId>/react \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "heart"
  }'
```

### 6. Create Comment
```bash
curl -X POST http://localhost:4000/api/posts/<postId>/comment \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Nice post!"
  }'
```

---

## Lưu ý Quan Trọng

1. **Authentication**: Hầu hết endpoints cần `Authorization: Bearer <token>`
2. **File Upload**: Sử dụng `multipart/form-data` cho upload ảnh
3. **Cloudinary**: Cần config Cloudinary để upload ảnh thực tế
4. **Email OTP**: Trong development, OTP sẽ log ra console
5. **Recap Job**: Tự động chạy mỗi 60 phút, có thể thay đổi trong `.env`
6. **Premium Status**: Middleware tự động check subscription status
7. **Pagination**: Sử dụng `page` và `limit` query params

---

## Test Data từ Seed

Sau khi chạy `npm run seed`, bạn có thể test với:

**Users:**
- `alice` / password: (từ seed)
- `bob` / password: (từ seed)
- `charlie` / password: (từ seed)
- `admin` / password: (từ seed)

**Posts:** Đã có sẵn 3 posts
**Friendships:** Alice và Bob đã là bạn bè
**Reactions:** Đã có sẵn reactions
**Comments:** Đã có sẵn comments

---

## Troubleshooting

### Lỗi 401 Unauthorized
- Kiểm tra token có đúng không
- Token có thể đã hết hạn, cần login lại

### Lỗi 400 Bad Request
- Kiểm tra format của request body
- Kiểm tra validation rules (min length, required fields)

### Lỗi 404 Not Found
- Kiểm tra ID có đúng không
- Kiểm tra resource có tồn tại không

### Lỗi Upload
- Kiểm tra Cloudinary config
- Kiểm tra file size (max 10MB)
- Kiểm tra file type (chỉ image)

---

## Next Steps

1. Test tất cả endpoints theo thứ tự
2. Kiểm tra logs để xem background jobs
3. Test với nhiều users để test friendship flow
4. Test premium vs non-premium để xem ads logic

