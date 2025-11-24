// Import TensorFlow (sử dụng @tensorflow/tfjs thay vì tfjs-node để tránh lỗi build trên Windows)
import * as tf from '@tensorflow/tfjs';
import * as nsfwjs from 'nsfwjs';
import sharp from 'sharp';
import * as path from 'path';
import * as fs from 'fs';

// Model được load một lần khi server khởi động
let model: nsfwjs.NSFWJS | null = null;
let isModelLoading = false;
let modelLoadPromise: Promise<void> | null = null;

/**
 * Load NSFW model một lần khi server khởi động
 * Model sẽ được cache để tránh load lại mỗi lần check
 */
export async function loadNSFWModel(): Promise<void> {
  // Nếu model đã được load, không load lại
  if (model) {
    return;
  }

  // Nếu đang load, đợi promise hiện tại
  if (isModelLoading && modelLoadPromise) {
    return modelLoadPromise;
  }

  // Bắt đầu load model
  isModelLoading = true;
  modelLoadPromise = (async () => {
    try {
      console.log('[Moderation] Loading NSFW model...');
      
      const options = { size: 299 };
      let lastError: Error | null = null;
      
      // Strategy 1: Thử load từ local path trước (nếu đã download)
      const localModelPath = path.join(process.cwd(), 'models', 'nsfw', 'model.json');
      if (fs.existsSync(localModelPath)) {
        try {
          // Convert local path thành file:// URL
          const localModelUrl = `file://${localModelPath.replace(/\\/g, '/')}`;
          const modelDir = path.dirname(localModelPath).replace(/\\/g, '/');
          const fileUrl = `file://${modelDir}/`;
          
          console.log('[Moderation] Found local model, loading from:', fileUrl);
          model = await nsfwjs.load(fileUrl, options);
          console.log('[Moderation] ✅ NSFW model loaded successfully from local storage');
          return;
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          console.warn('[Moderation] Failed to load from local path:', err.message);
          lastError = err;
        }
      } else {
        console.log('[Moderation] Local model not found, will try to download from CDN');
      }
      
      // Strategy 2: Thử load từ GitHub (chính thức, đáng tin cậy hơn)
      const githubUrls = [
        'https://raw.githubusercontent.com/infinitered/nsfwjs/master/models/inception_v3/',
        'https://raw.githubusercontent.com/infinitered/nsfwjs/master/models/mobilenet_v2/',
      ];
      
      for (const githubUrl of githubUrls) {
        try {
          console.log(`[Moderation] Trying to load from GitHub: ${githubUrl}`);
          model = await nsfwjs.load(githubUrl, options);
          console.log('[Moderation] ✅ NSFW model loaded successfully from GitHub');
          return;
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          console.warn(`[Moderation] Failed to load from GitHub (${githubUrl}):`, err.message);
          lastError = err;
        }
      }
      
      // Strategy 3: Thử load từ CDN (default - CloudFront)
      try {
        console.log('[Moderation] Trying to load model from CDN (CloudFront)...');
        model = await nsfwjs.load(undefined, options);
        console.log('[Moderation] ✅ NSFW model loaded successfully from CDN');
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn('[Moderation] Failed to load from CDN:', lastError.message);
      }
      
      // Strategy 4: Thử các URL alternative
      const alternativeUrls = [
        'https://s3.amazonaws.com/ir_public/nsfwjs/model/',
      ];
      
      for (const modelUrl of alternativeUrls) {
        try {
          console.log(`[Moderation] Trying alternative URL: ${modelUrl}`);
          model = await nsfwjs.load(modelUrl, options);
          console.log('[Moderation] ✅ NSFW model loaded successfully');
          return;
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          console.warn(`[Moderation] Failed to load from ${modelUrl}:`, err.message);
          lastError = err;
        }
      }
      
      // Nếu tất cả đều thất bại
      throw lastError || new Error(
        'Failed to load model from all sources.\n' +
        'Please run: npm run download-nsfw-model\n' +
        'This will download model from GitHub to local storage.\n' +
        'Or check your internet connection and firewall settings.'
      );
    } catch (error) {
      console.error('[Moderation] Failed to load NSFW model from all sources:', error);
      throw error;
    } finally {
      isModelLoading = false;
    }
  })();

  return modelLoadPromise;
}

/**
 * Kiểm tra ảnh có chứa nội dung nhạy cảm (NSFW) hay không
 * @param imageBuffer Buffer của ảnh cần kiểm tra
 * @returns Promise<boolean> - true nếu ảnh an toàn, false nếu chứa nội dung nhạy cảm
 */
export async function checkImage(imageBuffer: Buffer): Promise<boolean> {
  if (!model) {
    throw new Error('NSFW model is not loaded. Please call loadNSFWModel() first.');
  }

  try {
    // Resize ảnh xuống 299x299px (đúng kích thước model yêu cầu) để tối ưu tốc độ và RAM
    // Model size 299 yêu cầu ảnh 299x299x3 (RGB)
    const imageData = await sharp(imageBuffer)
      .resize(299, 299, {
        fit: 'cover', // Cover để đảm bảo đúng 299x299, có thể crop
        withoutEnlargement: true, // Không phóng to nếu ảnh nhỏ hơn
      })
      .removeAlpha() // Đảm bảo chỉ có RGB (3 channels)
      .raw() // Lấy raw pixel data
      .toBuffer({ resolveWithObject: true });

    // Convert buffer thành tensor [height, width, channels]
    // Model cần tensor với shape [299, 299, 3] và giá trị từ 0-255
    const imageTensor = tf.tensor3d(
      new Uint8Array(imageData.data),
      [imageData.info.height, imageData.info.width, imageData.info.channels]
    ) as tf.Tensor3D;

    // Predict với model
    const predictions = await model.classify(imageTensor);

    // Dispose tensor để giải phóng memory
    imageTensor.dispose();

    // Kiểm tra tỉ lệ Porn hoặc Hentai
    // Tìm prediction có className là 'Porn' hoặc 'Hentai'
    const pornPrediction = predictions.find((p: { className: string; probability: number }) => p.className === 'Porn');
    const hentaiPrediction = predictions.find((p: { className: string; probability: number }) => p.className === 'Hentai');

    const pornScore = pornPrediction?.probability || 0;
    const hentaiScore = hentaiPrediction?.probability || 0;

    // Nếu tỉ lệ Porn hoặc Hentai > 50% thì không an toàn
    const isSafe = pornScore <= 0.5 && hentaiScore <= 0.5;

    // Log để debug (có thể bỏ sau khi test xong)
    if (!isSafe) {
      console.log('[Moderation] NSFW detected:', {
        porn: `${(pornScore * 100).toFixed(2)}%`,
        hentai: `${(hentaiScore * 100).toFixed(2)}%`,
      });
    }

    return isSafe;
  } catch (error) {
    console.error('[Moderation] Error checking image:', error);
    // Nếu có lỗi, mặc định cho phép (fail-safe) hoặc có thể throw error tùy policy
    // Ở đây tôi sẽ throw để caller xử lý
    throw new Error(`Failed to check image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Kiểm tra xem model đã được load chưa
 */
export function isModelLoaded(): boolean {
  return model !== null;
}

