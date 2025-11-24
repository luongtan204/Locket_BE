/**
 * Script để download NSFW model về local
 * Chạy: node scripts/download-nsfw-model.js
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const MODEL_DIR = path.join(__dirname, '..', 'models', 'nsfw');
const MODEL_SIZE = 299; // Size của model (299 hoặc 224)

// URLs từ GitHub chính thức (raw.githubusercontent.com)
// Model 299 = InceptionV3, Model 224 = MobileNetV2
const MODEL_URLS = {
  299: {
    base: 'https://raw.githubusercontent.com/infinitered/nsfwjs/master/models/inception_v3/model.json',
    baseDir: 'https://raw.githubusercontent.com/infinitered/nsfwjs/master/models/inception_v3/'
  },
  224: {
    base: 'https://raw.githubusercontent.com/infinitered/nsfwjs/master/models/mobilenet_v2/model.json',
    baseDir: 'https://raw.githubusercontent.com/infinitered/nsfwjs/master/models/mobilenet_v2/'
  }
};

// Helper function để download file
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    console.log(`Downloading: ${url}`);
    const file = fs.createWriteStream(dest);
    
    protocol.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        // Follow redirect
        return downloadFile(response.headers.location, dest).then(resolve).catch(reject);
      }
      
      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(dest);
        return reject(new Error(`Failed to download: ${response.statusCode}`));
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log(`✓ Downloaded: ${path.basename(dest)}`);
        resolve();
      });
    }).on('error', (err) => {
      file.close();
      if (fs.existsSync(dest)) {
        fs.unlinkSync(dest);
      }
      reject(err);
    });
  });
}

// Helper function để parse JSON và download weights
async function downloadModelWeights(modelJsonPath) {
  const modelJson = JSON.parse(fs.readFileSync(modelJsonPath, 'utf8'));
  const weightsManifest = modelJson.weightsManifest || [];
  
  if (!weightsManifest || weightsManifest.length === 0) {
    console.log('No weights manifest found in model.json');
    return [];
  }
  
  const weightsDir = path.dirname(modelJsonPath);
  const downloadedFiles = [];
  
  // Lấy base URL từ GitHub
  const baseUrl = MODEL_URLS[MODEL_SIZE].baseDir;
  
  for (const manifest of weightsManifest) {
    if (!manifest.paths || manifest.paths.length === 0) {
      continue;
    }
    
    for (const pathItem of manifest.paths) {
      // Xử lý relative path - GitHub raw URLs
      let weightUrl;
      if (pathItem.startsWith('http')) {
        weightUrl = pathItem;
      } else {
        // GitHub raw URL format
        weightUrl = `${baseUrl}${pathItem}`;
      }
      
      const weightPath = path.join(weightsDir, pathItem);
      
      // Tạo thư mục nếu cần
      const weightDirPath = path.dirname(weightPath);
      if (!fs.existsSync(weightDirPath)) {
        fs.mkdirSync(weightDirPath, { recursive: true });
      }
      
      try {
        await downloadFile(weightUrl, weightPath);
        downloadedFiles.push(weightPath);
      } catch (error) {
        console.error(`Failed to download weight: ${pathItem}`, error.message);
        throw error;
      }
    }
  }
  
  return downloadedFiles;
}

async function main() {
  console.log('========================================');
  console.log('NSFW Model Downloader');
  console.log('========================================\n');
  
  // Tạo thư mục model nếu chưa có
  if (!fs.existsSync(MODEL_DIR)) {
    fs.mkdirSync(MODEL_DIR, { recursive: true });
    console.log(`Created directory: ${MODEL_DIR}\n`);
  }
  
  const modelJsonPath = path.join(MODEL_DIR, 'model.json');
  const modelUrl = MODEL_URLS[MODEL_SIZE].base;
  
  try {
    // Download model.json
    console.log(`Downloading model (size: ${MODEL_SIZE})...\n`);
    await downloadFile(modelUrl, modelJsonPath);
    
    // Download weights
    console.log('\nDownloading model weights...\n');
    await downloadModelWeights(modelJsonPath);
    
    console.log('\n========================================');
    console.log('✅ Model downloaded successfully!');
    console.log(`Model location: ${MODEL_DIR}`);
    console.log('========================================\n');
    
  } catch (error) {
    console.error('\n========================================');
    console.error('❌ Failed to download model');
    console.error('Error:', error.message);
    console.error('\nPossible solutions:');
    console.error('1. Check your internet connection');
    console.error('2. Check firewall/proxy settings');
    console.error('3. GitHub may be blocked in your region, try using VPN');
    console.error('4. Try changing DNS (8.8.8.8, 1.1.1.1)');
    console.error('========================================\n');
    process.exit(1);
  }
}

main();

