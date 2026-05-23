/**
 * PWA Icon Generator Script
 * 
 * This script generates PWA icons from a base SVG.
 * Run with: bun run scripts/generate-icons.ts
 * 
 * Prerequisites: bun add sharp
 */

import sharp from 'sharp';
import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

async function generateIcons() {
  const iconsDir = join(process.cwd(), 'public', 'icons');
  
  if (!existsSync(iconsDir)) {
    mkdirSync(iconsDir, { recursive: true });
  }

  const svgPath = join(iconsDir, 'icon.svg');
  
  for (const size of sizes) {
    const outputPath = join(iconsDir, `icon-${size}x${size}.png`);
    
    try {
      await sharp(svgPath)
        .resize(size, size)
        .png()
        .toFile(outputPath);
      
      console.log(`✓ Generated ${size}x${size} icon`);
    } catch (error) {
      console.error(`✗ Failed to generate ${size}x${size} icon:`, error);
    }
  }

  // Generate favicon.ico
  try {
    await sharp(svgPath)
      .resize(32, 32)
      .toFile(join(process.cwd(), 'public', 'favicon.ico'));
    console.log('✓ Generated favicon.ico');
  } catch (error) {
    console.error('✗ Failed to generate favicon.ico:', error);
  }

  // Generate apple-touch-icon.png
  try {
    await sharp(svgPath)
      .resize(180, 180)
      .toFile(join(iconsDir, 'apple-touch-icon.png'));
    console.log('✓ Generated apple-touch-icon.png');
  } catch (error) {
    console.error('✗ Failed to generate apple-touch-icon.png:', error);
  }
}

generateIcons().then(() => {
  console.log('\n🎉 Icon generation complete!');
}).catch((error) => {
  console.error('Error generating icons:', error);
  process.exit(1);
});