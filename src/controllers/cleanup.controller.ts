import { Request, Response } from 'express';
import multer from 'multer';
import FormData from 'form-data';
import axios from 'axios';
import fs from 'fs';
import sharp from 'sharp';
import path from 'path';
import { ok } from '../utils/apiResponse';

const CLIPDROP_API_KEY = process.env.CLIPDROP_API_KEY ? process.env.CLIPDROP_API_KEY.trim() : "";

// Hàm phụ trợ: Xử lý Mask cực mạnh
async function processMask(maskPath: string, targetWidth: number, targetHeight: number) {
    const outputPath = path.join('uploads', `processed_mask_${Date.now()}.png`);

    // Ensure uploads directory exists
    if (!fs.existsSync('uploads')) {
        fs.mkdirSync('uploads');
    }

    await sharp(maskPath)
        // 1. Ép kích thước Mask bằng đúng kích thước ảnh gốc (kể cả bị méo cũng ép)
        // Điều này đảm bảo tọa độ vẽ trên điện thoại khớp với ảnh
        .resize(targetWidth, targetHeight, { fit: 'fill' })

        // 2. Quan trọng: Biến nền trong suốt thành màu ĐEN (#000000)
        .flatten({ background: { r: 0, g: 0, b: 0 } })

        // 3. Tăng tương phản: Biến các nét mờ thành trắng hẳn
        .threshold(128)

        // 4. Chuyển thành thang độ xám (1 kênh màu) để ClipDrop dễ hiểu nhất
        .toColourspace('b-w')

        .png()
        .toFile(outputPath);

    return outputPath;
}

export const cleanupImage = async (req: Request, res: Response) => {
    try {
        console.log("=== NHẬN REQUEST MỚI ===");
        console.log("req.files:", req.files);
        console.log("req.body:", req.body);

        const files = req.files as { [fieldname: string]: Express.Multer.File[] };

        if (!files || !files['image'] || !files['mask']) {
            console.error("Missing files. Received:", {
                hasFiles: !!files,
                hasImage: !!(files && files['image']),
                hasMask: !!(files && files['mask'])
            });
            res.status(400).json({ error: 'Thiếu file' });
            return;
        }

        const imagePath = files['image'][0].path;
        const maskPath = files['mask'][0].path;

        console.log("Image path:", imagePath);
        console.log("Mask path:", maskPath);

        // 1. Lấy thông tin kích thước ảnh gốc
        const imageMetadata = await sharp(imagePath).metadata();
        console.log(`Kích thước ảnh gốc: ${imageMetadata.width} x ${imageMetadata.height}`);

        if (!imageMetadata.width || !imageMetadata.height) {
            throw new Error("Không thể đọc kích thước ảnh");
        }

        // 2. Xử lý Mask (Resize + Flatten Black + Threshold)
        console.log("Đang xử lý lại Mask...");
        const finalMaskPath = await processMask(maskPath, imageMetadata.width, imageMetadata.height);
        console.log("Đã tạo Mask chuẩn tại:", finalMaskPath);

        // 3. Gửi sang ClipDrop
        const formData = new FormData();
        formData.append('image_file', fs.createReadStream(imagePath), {
            filename: 'original.jpg', contentType: 'image/jpeg'
        });
        formData.append('mask_file', fs.createReadStream(finalMaskPath), {
            filename: 'mask.png', contentType: 'image/png'
        });

        console.log("Đang gọi ClipDrop API...");
        const response = await axios.post('https://clipdrop-api.co/cleanup/v1', formData, {
            headers: {
                'x-api-key': CLIPDROP_API_KEY,
                ...formData.getHeaders(),
            },
            responseType: 'arraybuffer',
        });

        console.log("ClipDrop trả về thành công!");

        // 4. Trả kết quả về App
        const base64Image = Buffer.from(response.data, 'binary').toString('base64');
        const resultDataUri = `data:image/png;base64,${base64Image}`;

        // Dọn dẹp file rác
        try {
            if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
            if (fs.existsSync(maskPath)) fs.unlinkSync(maskPath);
            if (fs.existsSync(finalMaskPath)) fs.unlinkSync(finalMaskPath);
        } catch (e) { }

        res.json(ok({ result: resultDataUri }, 'Cleanup successful'));

    } catch (error: any) {
        if (error.response) {
            // Đọc lỗi từ ClipDrop gửi về
            const msg = error.response.data.toString('utf8');
            console.error("LỖI CLIPDROP:", msg);
            res.status(500).json({ error: msg });
        } else {
            console.error("LỖI SERVER:", error.message);
            res.status(500).json({ error: error.message });
        }
    }
};
