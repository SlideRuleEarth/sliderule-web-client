// ES Module compatible version
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

// Required to get __dirname in ES module scope
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputDir = path.resolve(__dirname, '../web-client/src/assets/maki-svg');
const outputDir = path.resolve(__dirname, '../web-client/public/icons');
const size = 32;

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

const svgFiles = fs.readdirSync(inputDir).filter(f => f.endsWith('.svg'));

for (const file of svgFiles) {
    const iconName = path.basename(file, '.svg');
    const inputPath = path.join(inputDir, file);
    const outputPath = path.join(outputDir, `${iconName}.png`);

    sharp(inputPath)
        .resize(size, size)
        .png()
        .toFile(outputPath)
        .then(() => console.log(`✅ ${iconName}.svg → ${iconName}.png`))
        .catch(err => console.error(`❌ Failed for ${file}:`, err));
}
