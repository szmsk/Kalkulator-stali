import fs from 'fs';
import sharp from 'sharp';

async function generateIcons() {
  const svgPath = 'public/icon.svg';
  
  if (!fs.existsSync(svgPath)) {
    console.error('Error: public/icon.svg does not exist!');
    process.exit(1);
  }

  console.log('Generating PNG icons from SVG...');

  // 1. Generate 192x192 PNG
  await sharp(svgPath)
    .resize(192, 192)
    .png()
    .toFile('public/icon-192.png');
  console.log('Generated public/icon-192.png');

  // 2. Generate 512x512 PNG
  await sharp(svgPath)
    .resize(512, 512)
    .png()
    .toFile('public/icon-512.png');
  console.log('Generated public/icon-512.png');

  // 3. Generate 256x256 PNG to convert to ICO
  const png256Buffer = await sharp(svgPath)
    .resize(256, 256)
    .png()
    .toBuffer();

  // 4. Create a valid ICO file containing the 256x256 PNG
  const icoHeader = Buffer.alloc(6);
  icoHeader.writeUInt16LE(0, 0);     // Reserved
  icoHeader.writeUInt16LE(1, 2);     // Type (1 = ICO)
  icoHeader.writeUInt16LE(1, 4);     // Number of images

  const icoDirEntry = Buffer.alloc(16);
  icoDirEntry.writeUInt8(0, 0);       // Width (0 means 256)
  icoDirEntry.writeUInt8(0, 1);       // Height (0 means 256)
  icoDirEntry.writeUInt8(0, 2);       // Color count (0 for >= 256)
  icoDirEntry.writeUInt8(0, 3);       // Reserved
  icoDirEntry.writeUInt16LE(1, 4);    // Color planes
  icoDirEntry.writeUInt16LE(32, 6);   // Bits per pixel
  icoDirEntry.writeUInt32LE(png256Buffer.length, 8); // Image size
  icoDirEntry.writeUInt32LE(22, 12);  // Image offset (6 + 16 = 22)

  const icoBuffer = Buffer.concat([icoHeader, icoDirEntry, png256Buffer]);
  
  fs.writeFileSync('public/favicon.ico', icoBuffer);
  console.log('Generated public/favicon.ico (256x256 ICO format)');
}

generateIcons().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
