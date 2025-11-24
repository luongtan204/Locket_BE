import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createApp } from './app';
import { env } from './config/env';
import { connectDB } from './config/db';
import { recapJob } from './jobs/recap.job';
import { initializeSocketIO, setSocketIOInstance } from './services/socket.service';
import { loadNSFWModel } from './services/moderation.service';

async function bootstrap() {
  await connectDB();
  
  // Load NSFW model trước khi server bắt đầu listen (nếu được enable)
  // Điều này đảm bảo model sẵn sàng khi có request đầu tiên
  if (env.NSFW_ENABLED) {
    try {
      await loadNSFWModel();
      console.log('[Server] ✅ NSFW moderation enabled');
    } catch (error) {
      console.error('========================================');
      console.error('[Server] ⚠️  Failed to load NSFW model. NSFW checking will be DISABLED.');
      console.error('[Server] Error:', error instanceof Error ? error.message : String(error));
      console.error('');
      console.error('[Server] 🔧 Possible solutions:');
      console.error('  1. Check your internet connection');
      console.error('  2. Check firewall/proxy settings (may block CloudFront CDN)');
      console.error('  3. Try changing DNS (e.g., 8.8.8.8, 1.1.1.1)');
      console.error('  4. Use VPN if your network blocks CDN');
      console.error('  5. Set NSFW_ENABLED=false in .env to disable NSFW checking');
      console.error('');
      console.error('[Server] ℹ️  Server will continue running WITHOUT NSFW filtering');
      console.error('========================================');
      // Server vẫn tiếp tục chạy, chỉ là không có NSFW checking
    }
  } else {
    console.log('[Server] ℹ️  NSFW moderation is DISABLED (NSFW_ENABLED=false)');
  }
  
  const app = createApp();
  const server = createServer(app);

  // Khởi tạo Socket.io server
  const io = new SocketIOServer(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*', // Có thể config trong env
      methods: ['GET', 'POST'],
      credentials: true,
    },
    // Cho phép authentication qua handshake
    allowRequest: (req, callback) => {
      callback(null, true);
    },
  });

  // Khởi tạo Socket.io handlers
  initializeSocketIO(io);
  // Set io instance để có thể sử dụng từ service/controller
  setSocketIOInstance(io);
  console.log('[Server] Socket.io initialized');

  // Khởi động Recap Video Background Job
  // Chạy mỗi 60 phút (có thể config trong env)
  const jobInterval = parseInt(process.env.RECAP_JOB_INTERVAL_MINUTES || '60', 10);
  recapJob.start(jobInterval);
  console.log(`[Server] Recap job started (interval: ${jobInterval} minutes)`);

  server.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Server running on http://localhost:${env.PORT}`);
    console.log(`Socket.io server ready for connections`);
  });

  // Export io để có thể sử dụng ở nơi khác nếu cần
  return { server, io };
}

bootstrap();
