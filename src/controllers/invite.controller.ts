import { Request, Response } from 'express';
import { getUserByUsername, resolveInvite } from '../services/invite.service';
import { ok } from '../utils/apiResponse';
import { asyncHandler } from '../utils/asyncHandler';

/**
 * Trả về HTML page cho invite link
 * GET /invite/:username
 */
export const getInvitePage = asyncHandler(async (req: Request, res: Response) => {
  const { username } = req.params;

  if (!username) {
    return res.status(404).send('<h1>User not found</h1>');
  }

  try {
    // Lấy thông tin user
    const userInfo = await getUserByUsername(username);

    // Detect platform (iOS/Android/Other)
    const userAgent = req.headers['user-agent'] || '';
    const isIOS = /iPhone|iPad|iPod/i.test(userAgent);
    const isAndroid = /Android/i.test(userAgent);

    // App Store URLs (cần cập nhật với app ID thực tế)
    const iosAppStoreUrl = 'https://apps.apple.com/app/locket/id123456789'; // TODO: Update với App ID thực tế
    const androidPlayStoreUrl = 'https://play.google.com/store/apps/details?id=com.locket.app'; // TODO: Update với Package name thực tế

    // Custom scheme URL
    const deepLinkUrl = `locket://add-friend?username=${encodeURIComponent(userInfo.username)}`;

    // HTML template
    const html = `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kết bạn với ${userInfo.displayName} trên Locket</title>
    <meta name="description" content="Kết bạn với ${userInfo.displayName} trên Locket - Ứng dụng chia sẻ khoảnh khắc với bạn bè">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            max-width: 400px;
            width: 100%;
            padding: 40px 30px;
            text-align: center;
        }
        .avatar {
            width: 120px;
            height: 120px;
            border-radius: 50%;
            margin: 0 auto 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 48px;
            color: white;
            font-weight: bold;
            overflow: hidden;
        }
        .avatar img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        .avatar-text {
            font-size: 48px;
        }
        h1 {
            font-size: 24px;
            color: #333;
            margin-bottom: 10px;
            font-weight: 600;
        }
        .username {
            color: #666;
            font-size: 16px;
            margin-bottom: 30px;
        }
        .button {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 16px 32px;
            border-radius: 12px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            width: 100%;
            transition: transform 0.2s, box-shadow 0.2s;
            margin-top: 10px;
        }
        .button:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(102, 126, 234, 0.4);
        }
        .button:active {
            transform: translateY(0);
        }
        .loading {
            display: none;
            margin-top: 20px;
            color: #666;
            font-size: 14px;
        }
        .logo {
            font-size: 32px;
            font-weight: bold;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            margin-bottom: 30px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">Locket</div>
        <div class="avatar">
            ${userInfo.avatarUrl 
              ? `<img src="${userInfo.avatarUrl}" alt="${userInfo.displayName}" onerror="this.parentElement.innerHTML='<span class=\\'avatar-text\\'>${userInfo.displayName.charAt(0).toUpperCase()}</span>'">`
              : `<span class="avatar-text">${userInfo.displayName.charAt(0).toUpperCase()}</span>`
            }
        </div>
        <h1>${userInfo.displayName}</h1>
        <div class="username">@${userInfo.username}</div>
        <button class="button" onclick="openApp()">Mở trong App</button>
        <div class="loading" id="loading">Đang mở ứng dụng...</div>
    </div>

    <script>
        let appOpened = false;
        const deepLinkUrl = '${deepLinkUrl}';
        const iosAppStoreUrl = '${iosAppStoreUrl}';
        const androidPlayStoreUrl = '${androidPlayStoreUrl}';
        const isIOS = ${isIOS};
        const isAndroid = ${isAndroid};

        function openApp() {
            appOpened = false;
            document.getElementById('loading').style.display = 'block';
            
            // Thử mở app
            window.location.href = deepLinkUrl;
            
            // Nếu sau 1 giây không mở được app, redirect đến store
            setTimeout(function() {
                if (!appOpened) {
                    if (isIOS) {
                        window.location.href = iosAppStoreUrl;
                    } else if (isAndroid) {
                        window.location.href = androidPlayStoreUrl;
                    } else {
                        // Desktop/Other - hiển thị cả 2 options
                        if (confirm('Bạn chưa cài đặt ứng dụng Locket. Bạn muốn tải về?')) {
                            window.location.href = isIOS ? iosAppStoreUrl : androidPlayStoreUrl;
                        }
                    }
                }
                document.getElementById('loading').style.display = 'none';
            }, 1000);
        }

        // Detect khi app được mở (page blur)
        window.addEventListener('blur', function() {
            appOpened = true;
        });

        // Tự động thử mở app khi load page
        window.addEventListener('load', function() {
            setTimeout(openApp, 500);
        });
    </script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  } catch (error: any) {
    // Nếu không tìm thấy user, trả về 404 page
    return res.status(404).send(`
      <!DOCTYPE html>
      <html lang="vi">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>User not found</title>
          <style>
              body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                  min-height: 100vh;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  color: white;
                  text-align: center;
                  padding: 20px;
              }
              h1 { font-size: 24px; margin-bottom: 10px; }
              p { font-size: 16px; opacity: 0.9; }
          </style>
      </head>
      <body>
          <div>
              <h1>Không tìm thấy người dùng</h1>
              <p>Link này có thể không hợp lệ hoặc đã hết hạn.</p>
          </div>
      </body>
      </html>
    `);
  }
});

/**
 * API resolve username thành user info (cho mobile app)
 * POST /api/invites/resolve
 * Body: { username: string }
 */
export const resolveInviteUser = asyncHandler(async (req: Request, res: Response) => {
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({ success: false, message: 'Username is required' });
  }

  const userInfo = await resolveInvite(username);

  return res.status(200).json(ok(userInfo, 'User resolved successfully'));
});

