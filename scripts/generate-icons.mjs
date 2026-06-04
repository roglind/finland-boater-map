import sharp from 'sharp';

const SOURCE_URL =
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQjBfT3f-Uzlw3xUGl7OEZcuDUKNUWd2OZK_Q&s';

console.log(`Downloading source image...`);
const res = await fetch(SOURCE_URL, {
  headers: { 'User-Agent': 'Mozilla/5.0' }
});
if (!res.ok) throw new Error(`Failed to fetch source image: ${res.status}`);
const sourceBuffer = Buffer.from(await res.arrayBuffer());
console.log(`Downloaded ${sourceBuffer.length} bytes.`);

const sizes = [
  { size: 512, out: 'public/icon-512.png' },
  { size: 192, out: 'public/icon-192.png' },
  { size: 180, out: 'public/apple-touch-icon.png' },
];

for (const { size, out } of sizes) {
  // White square background
  const bg = await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    }
  }).png().toBuffer();

  // Sign centred at 85% of tile size, transparent background
  const signSize = Math.round(size * 0.85);
  const sign = await sharp(sourceBuffer)
    .resize(signSize, signSize, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .toBuffer();

  await sharp(bg)
    .composite([{ input: sign, gravity: 'centre' }])
    .png()
    .toFile(out);

  console.log(`Generated ${out}`);
}

console.log('Done.');
