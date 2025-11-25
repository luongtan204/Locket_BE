# AI Bot Debug Guide

## Vấn đề: Bot không trả lời

### Bước 1: Kiểm tra Environment Variables

Đảm bảo các biến sau được set trong `.env` file:

```env
BOT_ID=692570398a0f1e0dd9fc6396  # ID của Bot user trong database
GROQ_API_KEY=your_groq_api_key_here
```

**Lưu ý:** 
- `BOT_ID` phải là ID của một user thật trong database (Bot user)
- `GROQ_API_KEY` phải là API key hợp lệ từ Groq

### Bước 2: Kiểm tra Console Logs

Khi gửi message, kiểm tra console logs để xem:

1. **Khi server khởi động:**
   ```
   [Bot] BOT_ID configured: 692570398a0f1e0dd9fc6396
   [Bot] GROQ_API_KEY configured
   ```

2. **Khi gửi message:**
   ```
   [AI Bot] Checking bot conversation: {
     conversationId: '...',
     participants: ['691ffc3445033d1f0ce992ef', '692570398a0f1e0dd9fc6396'],
     botId: '692570398a0f1e0dd9fc6396',
     isBotConversation: true,
     messageType: 'text',
     groqAvailable: true
   }
   [AI Bot] Processing bot response in background...
   [AI Bot] Starting bot response generation...
   [AI Bot] Chat history loaded: X messages
   [AI Bot] Calling Groq API...
   [AI Bot] Bot response generated: ...
   [AI Bot] Bot message created: ...
   [AI Bot] Socket event emitted to room: conversation:...
   ```

### Bước 3: Các vấn đề thường gặp

#### Vấn đề 1: `isBotConversation: false`
- **Nguyên nhân:** BOT_ID không khớp với participant ID
- **Giải pháp:** 
  - Kiểm tra BOT_ID trong .env có đúng không
  - Kiểm tra participant IDs trong conversation có đúng không
  - Đảm bảo không có khoảng trắng thừa trong BOT_ID

#### Vấn đề 2: `groqAvailable: false`
- **Nguyên nhân:** GROQ_API_KEY chưa được set hoặc không hợp lệ
- **Giải pháp:** 
  - Kiểm tra .env file có GROQ_API_KEY không
  - Restart server sau khi thêm GROQ_API_KEY

#### Vấn đề 3: Không thấy log `[AI Bot] Processing bot response...`
- **Nguyên nhân:** Một trong các điều kiện không đúng:
  - `isBotConversation` = false
  - `messageType` != 'text'
  - `groqService.isAvailable()` = false
- **Giải pháp:** Kiểm tra từng điều kiện trong log

#### Vấn đề 4: Có log nhưng không thấy message từ Bot
- **Nguyên nhân:** 
  - Lỗi khi gọi Groq API
  - Lỗi khi tạo message
  - Socket.io không emit được
- **Giải pháp:** 
  - Kiểm tra error logs: `[AI Bot] Error generating response:`
  - Kiểm tra Socket.io connection
  - Kiểm tra client có lắng nghe event `new_message` không

### Bước 4: Test thủ công

1. **Kiểm tra Bot user tồn tại:**
   ```bash
   # Trong MongoDB
   db.users.findOne({ _id: ObjectId("692570398a0f1e0dd9fc6396") })
   ```

2. **Kiểm tra conversation có Bot:**
   ```bash
   # Trong MongoDB
   db.conversations.findOne({ 
     participants: ObjectId("692570398a0f1e0dd9fc6396") 
   })
   ```

3. **Test Groq API trực tiếp:**
   - Sử dụng Postman hoặc curl để test Groq API
   - Đảm bảo API key hợp lệ

### Bước 5: Kiểm tra Socket.io

Bot response được gửi qua Socket.io event `new_message`. Đảm bảo:

1. Client đã kết nối Socket.io
2. Client đã join conversation room
3. Client đang lắng nghe event `new_message`

### Debug Commands

```bash
# Xem logs real-time
npm run dev | grep "AI Bot"

# Hoặc nếu dùng PM2
pm2 logs | grep "AI Bot"
```

