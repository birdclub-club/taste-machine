# NFT Images for Trailing Effect

## 📁 Directory Purpose
This directory contains NFT images that will be used for the trailing cursor effect on the landing page.

## 🖼️ Image Requirements
- **Format**: JPG, PNG, or WebP
- **Size**: Recommended 400x400px or larger (square aspect ratio preferred)
- **File Size**: Keep under 500KB each for optimal performance
- **Naming**: Use descriptive names like `nft1.jpg`, `nft2.png`, etc.

## 📋 Current Setup
The trailing effect is configured to look for these default images:
- `nft1.jpg`
- `nft2.jpg` 
- `nft3.jpg`
- `nft4.jpg`
- `nft5.jpg`

## 🔧 How to Add Your NFT Images

1. **Add your images** to this directory (`/public/nft-images/`)
2. **Name them** following the pattern above, or update the component
3. **Refresh the landing page** to see your NFTs trailing behind the cursor!

## ⚙️ Customization
To use different image names or add more images, edit the `DEFAULT_IMAGES` array in:
`/src/components/TrailingImages.tsx`

## 🎨 Effect Details
- Images appear as you move your mouse around the landing page
- Each image trails behind the cursor with smooth animations
- Images fade in, follow the cursor path, then scale down and fade out
- The effect works on both desktop (mouse) and mobile (touch)
- Images are displayed at 128x128px (32x32 in Tailwind: `h-32 w-32`)

## 🚀 Performance Tips
- Use optimized images (compressed JPEGs work well)
- Limit to 5-10 images for best performance
- Consider using WebP format for smaller file sizes
