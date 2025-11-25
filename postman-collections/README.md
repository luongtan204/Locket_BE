# Postman Collections

Postman collections đã được tách thành các file riêng theo module để dễ quản lý.

## Cấu trúc

```
postman-collections/
├── README.md                    # File này
├── shared-variables.json        # Biến dùng chung (tham khảo)
├── health.collection.json       # Health check
├── auth.collection.json         # Authentication & Authorization
├── post.collection.json         # Post management
├── feed.collection.json         # Feed endpoints
├── reaction.collection.json     # Reaction endpoints
├── comment.collection.json      # Comment endpoints
├── chat.collection.json         # Chat & messaging
├── friendship.collection.json   # Friend management
├── invite.collection.json       # Invite link & deep linking
├── admin.collection.json        # Admin operations
├── plan.collection.json         # Public Plan endpoints
├── subscription.collection.json # Subscription endpoints
└── refund.collection.json       # Refund endpoints
```

## Cách sử dụng

### Import vào Postman

1. Mở Postman
2. Click **Import** (góc trên bên trái)
3. Chọn file collection bạn muốn import (ví dụ: `auth.collection.json`)
4. Lặp lại cho các collection khác

### Hoặc import tất cả cùng lúc

1. Mở Postman
2. Click **Import**
3. Chọn folder `postman-collections`
4. Postman sẽ import tất cả các file `.json` trong folder

## Biến môi trường

Sau khi import, bạn cần cấu hình các biến collection:

- `base_url`: URL của API server (mặc định: `http://localhost:4000`)
- `token`: JWT token (sẽ được tự động set sau khi login)
- `user_id`: ID của user hiện tại (sẽ được tự động set sau khi login)
- `post_id`: ID của post để test
- `conversation_id`: ID của conversation để test
- `other_user_id`: ID của user khác để test
- `audit_log_id`: ID của audit log để test
- `plan_id`: ID của plan để test
- `invoice_id`: ID của invoice để test
- `subscription_id`: ID của subscription để test
- `refund_id`: ID của refund để test

## Collections

### 1. Health Check (`health.collection.json`)
- Health check endpoint

### 2. Auth (`auth.collection.json`)
- Register
- Login (auto-save token và user_id)
- Send OTP
- Verify OTP
- Check Email Availability
- Check Username Availability

### 3. Post (`post.collection.json`)
- Create Post
- Suggest Caption (File Upload)
- Suggest Caption (Base64)
- Get Post by ID
- Update Post
- Delete Post

### 4. Feed (`feed.collection.json`)
- Get Feed

### 5. Reaction (`reaction.collection.json`)
- Add Reaction
- Remove Reaction
- Get User Reaction

### 6. Comment (`comment.collection.json`)
- Create Comment
- Get Post Comments
- Delete Comment

### 7. Chat (`chat.collection.json`)
- Get Conversations
- Create or Get Conversation (auto-save conversation_id)
- Get Messages
- Send Message (Text)
- Send Message (Image)
- Mark Messages as Read

### 8. Friendship (`friendship.collection.json`)
- Send Friend Request
- Accept Friend Request

### 9. Invite (`invite.collection.json`)
- Resolve Invite (POST /api/invites/resolve)
- Get Invite Page (GET /invite/:username) - HTML page với deep linking

### 10. User Settings (`user.collection.json`)
- Change Password (POST /api/users/change-password)
- Change Email (POST /api/users/change-email)
- Update Profile (PUT /api/users/profile)
- Update Avatar (PATCH /api/users/avatar)

### 11. Admin (`admin.collection.json`)
- Ban User
- Unban User
- Delete Post
- Create Plan (auto-save plan_id)
- Process Refund
- Get Audit Logs (auto-save audit_log_id)
- Get Audit Log by ID
- Test Unauthorized Access (403)

### 11. Plan (`plan.collection.json`)
- Get Public Plans (không cần authentication)

### 12. Subscription (`subscription.collection.json`)
- Purchase Subscription (auto-save subscription_id và invoice_id)

### 13. Refund (`refund.collection.json`)
- Submit Refund Request (auto-save refund_id)

## Lưu ý

- Mỗi collection có các biến riêng, nhưng khuyến nghị sử dụng **Collection Variables** chung
- Sau khi login thành công, token và user_id sẽ được tự động lưu vào collection variables
- Một số request có test scripts để tự động lưu các biến cần thiết

## Cập nhật

Khi có API mới, chỉ cần cập nhật file collection tương ứng, không cần sửa toàn bộ file lớn.

## Tái tạo collections từ file gốc

Nếu bạn đã cập nhật file `POSTMAN_COLLECTION.json` gốc và muốn tái tạo các file collection riêng:

```bash
cd postman-collections
python split-collections.py
```

Script sẽ tự động tách file gốc thành các collection riêng theo module.

## Lưu ý

- File `POSTMAN_COLLECTION.json` gốc vẫn được giữ lại ở thư mục root để tham khảo
- Các file collection riêng được khuyến nghị sử dụng cho development và testing
- Mỗi collection có thể được import độc lập vào Postman

