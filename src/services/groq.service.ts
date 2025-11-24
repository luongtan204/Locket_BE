import { env } from '../config/env';
import sharp from 'sharp';

/**
 * Service để gọi Groq API cho tính năng gợi ý caption
 */
export class GroqService {
  private readonly apiKey: string;
  private readonly apiUrl = 'https://api.groq.com/openai/v1/chat/completions';

  constructor() {
    this.apiKey = env.GROQ_API_KEY;
    if (!this.apiKey) {
      console.warn('[Groq] GROQ_API_KEY not set. Caption suggestion will be disabled.');
    }
  }

  /**
   * Nén và convert ảnh sang base64
   * @param imageBuffer Buffer của ảnh
   * @returns Base64 string của ảnh đã nén
   */
  private async compressAndEncodeImage(imageBuffer: Buffer): Promise<string> {
    try {
      // Resize ảnh xuống max 1024px để giảm kích thước (Groq có giới hạn)
      // Convert về JPEG với quality 85 để giảm dung lượng
      const compressedBuffer = await sharp(imageBuffer)
        .resize(1024, 1024, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: 85 })
        .toBuffer();

      // Convert sang base64
      const base64 = compressedBuffer.toString('base64');
      return base64;
    } catch (error) {
      console.error('[Groq] Error compressing image:', error);
      throw new Error('Failed to compress image');
    }
  }

  /**
   * Gợi ý caption cho ảnh sử dụng Groq Vision API
   * @param imageBuffer Buffer của ảnh
   * @returns Caption được gợi ý
   */
  async suggestCaption(imageBuffer: Buffer): Promise<string> {
    if (!this.apiKey) {
      throw new Error('GROQ_API_KEY is not configured');
    }

    try {
      // Nén và encode ảnh
      const base64Image = await this.compressAndEncodeImage(imageBuffer);
      const imageDataUrl = `data:image/jpeg;base64,${base64Image}`;

      // Gọi Groq API
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-4-scout-17b-16e-instruct', // Groq Vision model
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: "Hãy đóng vai một người bạn thân Gen Z vui tính. " +
"Nhìn bức ảnh này và viết một caption tiếng Việt cực ngắn (dưới 15 từ). " +
"Phong cách: Hài hước, hơi 'bựa' hoặc dễ thương, dùng teencode hoặc tiếng lóng tự nhiên nếu cần. " +
"Tuyệt đối không dùng văn mẫu hay triết lý sáo rỗng. " +
"Kèm theo 1-2 emoji phù hợp. Chỉ trả về nội dung caption.",
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: imageDataUrl,
                  },
                },
              ],
            },
          ],
          max_tokens: 150,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Groq] API Error:', response.status, errorText);
        throw new Error(`Groq API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      // Lấy caption từ response
      const caption = data.choices?.[0]?.message?.content?.trim();

      if (!caption) {
        throw new Error('No caption generated from Groq API');
      }

      return caption;
    } catch (error) {
      console.error('[Groq] Error suggesting caption:', error);
      throw error instanceof Error
        ? error
        : new Error('Failed to generate caption suggestion');
    }
  }

  /**
   * Kiểm tra xem Groq service có sẵn sàng không
   */
  isAvailable(): boolean {
    return !!this.apiKey;
  }
}

// Export singleton instance
export const groqService = new GroqService();

