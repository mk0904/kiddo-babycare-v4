import { useEffect, useState, useRef } from 'react';
import { Image } from 'react-native';
import { configService } from '@/services/configService';

interface ImageCache {
  [url: string]: boolean;
}

/**
 * Hook to pre-load images for all categories to enable instant tab switching
 * Pre-loads header background images and first promo banner images
 */
export function useImagePreloader() {
  const [preloadedImages, setPreloadedImages] = useState<ImageCache>({});
  const preloadingRef = useRef(false);

  useEffect(() => {
    if (preloadingRef.current) return;
    preloadingRef.current = true;

    const preloadImages = async () => {
      const categories = configService.getCategories();
      const categoryOrder = categories?.order || ['all', 'girls', 'boys', 'babycare', 'toys'];
      const imageUrls: string[] = [];

      // Collect category icon URLs and header background images for all categories
      categoryOrder.forEach((categoryKey) => {
        const categories = configService.getCategories();
        const categoryDef = categories?.items?.[categoryKey];
        const iconUrl = categoryDef?.icon;
        if (iconUrl && typeof iconUrl === 'string') {
          imageUrls.push(iconUrl);
        }
        const categoryHeader = configService.getCategoryHeaderConfig(categoryKey);
        const globalHeader = configService.getConfig().header;
        const backgroundImage = categoryHeader?.backgroundImage || globalHeader?.backgroundImage;
        if (backgroundImage && typeof backgroundImage === 'string') {
          imageUrls.push(backgroundImage);
        }
      });

      // Collect first promo banner image for each category
      categoryOrder.forEach((categoryKey) => {
        const blocks = configService.getScreenBlocks('home', categoryKey);
        // Find first imageBanner block
        const firstBanner = blocks.find(
          (block) => block.type === 'imageBanner' || block.type === 'banner'
        );
        
        if (firstBanner) {
          const imageUrl = 
            (firstBanner as any).imageBannerConfig?.imageUrl || 
            (firstBanner as any).data?.imageUrl;
          
          if (imageUrl && typeof imageUrl === 'string') {
            imageUrls.push(imageUrl);
          }
        }
      });

      // Pre-load all images
      const preloadPromises = imageUrls.map((url) => {
        return Image.prefetch(url)
          .then(() => {
            setPreloadedImages((prev) => ({ ...prev, [url]: true }));
            return true;
          })
          .catch((error) => {
            console.warn(`[useImagePreloader] Failed to preload image: ${url}`, error);
            return false;
          });
      });

      await Promise.all(preloadPromises);
    };

    preloadImages();
  }, []);

  return preloadedImages;
}
