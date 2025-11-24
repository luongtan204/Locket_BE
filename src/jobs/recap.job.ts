import { recapService } from '../services/recap.service';

/**
 * Background Job để xử lý Recap Videos
 * Chạy định kỳ để:
 * 1. Tạo recap video records cho users có posts trong tháng trước
 * 2. Xử lý các recap videos chưa được processed
 */
export class RecapJob {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  /**
   * Khởi động background job
   * @param intervalMinutes - Số phút giữa mỗi lần chạy (default: 60 phút)
   */
  start(intervalMinutes: number = 60): void {
    if (this.intervalId) {
      console.log('[RecapJob] Job is already running');
      return;
    }

    console.log(`[RecapJob] Starting background job (interval: ${intervalMinutes} minutes)`);

    // Chạy ngay lập tức lần đầu
    this.run();

    // Sau đó chạy định kỳ
    this.intervalId = setInterval(() => {
      this.run();
    }, intervalMinutes * 60 * 1000);
  }

  /**
   * Dừng background job
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[RecapJob] Background job stopped');
    }
  }

  /**
   * Chạy job một lần
   */
  private async run(): Promise<void> {
    if (this.isRunning) {
      console.log('[RecapJob] Job is already running, skipping...');
      return;
    }

    this.isRunning = true;
    console.log('[RecapJob] Starting job execution...');

    try {
      // Bước 1: Tạo recap video records cho tất cả users có posts trong tháng trước
      console.log('[RecapJob] Step 1: Generating recap video records...');
      const { processed, errors } = await recapService.generateRecapVideosForAllUsers();
      console.log(`[RecapJob] Generated ${processed} records, ${errors} errors`);

      // Bước 2: Xử lý các recap videos chưa được processed
      console.log('[RecapJob] Step 2: Processing unprocessed videos...');
      const unprocessedVideos = await recapService.getUnprocessedRecapVideos(10);

      for (const video of unprocessedVideos) {
        try {
          await recapService.processRecapVideo(video._id.toString());
          console.log(`[RecapJob] Processed video ${video._id}`);
        } catch (error: any) {
          console.error(`[RecapJob] Error processing video ${video._id}:`, error.message);
        }
      }

      console.log(`[RecapJob] Processed ${unprocessedVideos.length} videos`);
      console.log('[RecapJob] Job execution completed successfully');
    } catch (error: any) {
      console.error('[RecapJob] Job execution failed:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Chạy job một lần (manual trigger)
   */
  async runOnce(): Promise<void> {
    await this.run();
  }
}

// Export singleton instance
export const recapJob = new RecapJob();

