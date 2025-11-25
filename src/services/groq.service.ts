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

  /**
   * Tạo response từ AI Bot (AI Friend)
   * @param userMessage - Tin nhắn mới nhất của user
   * @param history - Lịch sử chat (mảng messages, mới nhất trước)
   * @returns Text response từ AI
   */
  async generateBotResponse(userMessage: string, history: any[] = []): Promise<string> {
    if (!this.apiKey) {
      throw new Error('GROQ_API_KEY is not configured');
    }

    try {
      // Xây dựng messages array cho Groq API
      const messages: any[] = [];

      // System message - đóng vai AI Friend
      messages.push({
        role: 'system',
        content: 'Bạn là một người bạn thân thiết, vui tính trên app Locket. ' +
          'Bạn hay dùng teencode, tiếng lóng Gen Z, và emoji một cách tự nhiên. ' +
          'Phong cách nói chuyện: Thân thiện, hài hước, đôi khi hơi "bựa" nhưng không quá đà. ' +
          'Trả lời ngắn gọn (dưới 50 từ), tự nhiên như đang chat với bạn thân. ' +
          'Dùng emoji phù hợp nhưng không quá nhiều (1-2 emoji mỗi câu). ' +
          'Tuyệt đối không dùng văn mẫu hay triết lý sáo rỗng.',
      });

      // Thêm lịch sử chat (nếu có) - đảo ngược để từ cũ đến mới
      if (history && history.length > 0) {
        // Chỉ lấy 10 messages gần nhất để không quá dài
        const recentHistory = history.slice(0, 10).reverse();
        
        for (const msg of recentHistory) {
          // Bỏ qua message hiện tại (userMessage)
          if (msg.content === userMessage) continue;
          
          // Xác định role: 'user' hoặc 'assistant' (bot)
          const role = msg.senderId?.toString() === env.BOT_ID ? 'assistant' : 'user';
          messages.push({
            role,
            content: msg.content || '',
          });
        }
      }

      // Thêm user message mới nhất
      messages.push({
        role: 'user',
        content: userMessage,
      });

      // Gọi Groq API
      // Sử dụng model mới nhất (llama-3.3-70b-versatile thay thế llama-3.1-70b-versatile đã bị decommissioned)
      // Nếu model này không hoạt động, có thể thử: 'llama-3.1-8b-instant' hoặc 'mixtral-8x7b-32768'
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile', // Model mới nhất của Groq
          messages,
          max_tokens: 200,
          temperature: 0.8, // Tăng temperature để response tự nhiên hơn
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Groq] API Error:', response.status, errorText);
        throw new Error(`Groq API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      // Lấy response từ AI
      const botResponse = data.choices?.[0]?.message?.content?.trim();

      if (!botResponse) {
        throw new Error('No response generated from Groq API');
      }

      return botResponse;
    } catch (error) {
      console.error('[Groq] Error generating bot response:', error);
      throw error instanceof Error
        ? error
        : new Error('Failed to generate bot response');
    }
  }
}

// Export singleton instance
export const groqService = new GroqService();

