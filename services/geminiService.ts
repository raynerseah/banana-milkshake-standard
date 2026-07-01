import type { AdCopy, ImageData } from '../types';

export const fileToBase64 = (file: File): Promise<ImageData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const MAX_DIMENSION = 1500;
        let width = img.width;
        let height = img.height;

        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          if (width > height) {
            height = Math.round((height * MAX_DIMENSION) / width);
            width = MAX_DIMENSION;
          } else {
            width = Math.round((width * MAX_DIMENSION) / height);
            height = MAX_DIMENSION;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        const quality = mimeType === 'image/jpeg' ? 0.8 : undefined;

        const dataUrl = canvas.toDataURL(mimeType, quality);
        const data = dataUrl.split(',')[1];
        resolve({ data, mimeType });
      };
      img.onerror = (error) => reject(error);
      if (event.target?.result) {
        img.src = event.target.result as string;
      } else {
        reject(new Error("Failed to read file"));
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
};

const apiFetch = async (endpoint: string, payload: any) => {
    const response = await fetch(`/api/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || 'Network error occurred');
    }
    return data;
};

export const getCopySuggestion = async (
  copyType: keyof AdCopy,
  currentCopy: string
): Promise<string> => {
    const data = await apiFetch('getCopySuggestion', { copyType, currentCopy });
    return data.suggestion;
};

export const editAd = async (
  baseImage: string,
  prompt: string,
  referenceImage: ImageData | null,
  aspectRatio: string = '1:1',
  imageSize: string = '1K',
  imageModel: string = 'gemini-3.1-flash-image'
): Promise<string> => {
    const data = await apiFetch('editAd', { baseImage, prompt, referenceImage, aspectRatio, imageSize, imageModel });
    return data.imageUrl;
};

export const generateLifestyleImage = async (
    productImages: ImageData[],
    prompt: string,
    aspectRatio: string = '1:1',
    imageSize: string = '2K',
    imageModel: string = 'gemini-3.1-flash-image'
): Promise<ImageData> => {
    const data = await apiFetch('generateLifestyleImage', { productImages, prompt, aspectRatio, imageSize, imageModel });
    return data.image;
};

export const styleVariations = [
    "TEMPLATE_ADAPTATION: Strictly follow the layout structure and design elements of the provided Style Guide/Template (ASSET_2). Replace the content with the provided Product/Lifestyle assets + new copy + Logo (ASSET_3, if available). Retain the vibe."
];

export const generateSingleAd = async (
  productAssets: ImageData[],
  lifestyleAsset: ImageData | null,
  styleImage: ImageData,
  logoImage: ImageData | null,
  adCopy: AdCopy,
  specialRequest: string,
  creativeDirection: string,
  aspectRatio: string,
  imageSize: string = '1K',
  includeGooglePlay: boolean = false,
  includeAppStore: boolean = false,
  imageModel: string = 'gemini-3.1-flash-image'
): Promise<string> => {
    const payload = {
        productAssets,
        lifestyleAsset,
        styleImage,
        logoImage,
        adCopy,
        specialRequest,
        creativeDirection,
        aspectRatio,
        imageSize,
        includeGooglePlay,
        includeAppStore,
        imageModel
    };
    const data = await apiFetch('generateSingleAd', payload);
    return data.imageUrl;
};

export const generateAds = async (
  productAssets: ImageData[],
  lifestyleAsset: ImageData | null,
  styleImage: ImageData,
  logoImage: ImageData | null,
  adCopy: AdCopy,
  specialRequest: string,
  aspectRatios: string[],
  imageSize: string = '1K',
  includeGooglePlay: boolean = false,
  includeAppStore: boolean = false,
  imageModel: string = 'gemini-3.1-flash-image'
): Promise<PromiseSettledResult<string>[]> => {
    type AdTask = () => Promise<string>;
    const tasks: AdTask[] = [];
    
    // Create task functions for every combination of Aspect Ratio and Style Variation
    // Order: For each Ratio, iterate all styles.
    for (const ratio of aspectRatios) {
        for (const variation of styleVariations) {
            tasks.push(() =>
                generateSingleAd(
                    productAssets,
                    lifestyleAsset,
                    styleImage,
                    logoImage,
                    adCopy,
                    specialRequest,
                    variation,
                    ratio,
                    imageSize,
                    includeGooglePlay,
                    includeAppStore,
                    imageModel
                )
            );
        }
    }

    // Process tasks in chunks to avoid overwhelming the browser and API
    const results: PromiseSettledResult<string>[] = [];
    const CONCURRENCY_LIMIT = 2; // Process 2 ads at a time
    
    for (let i = 0; i < tasks.length; i += CONCURRENCY_LIMIT) {
        const chunk = tasks.slice(i, i + CONCURRENCY_LIMIT);
        const chunkResults = await Promise.allSettled(chunk.map(task => task()));
        results.push(...chunkResults);
    }

    return results;
};