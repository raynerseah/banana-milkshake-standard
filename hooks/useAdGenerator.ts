import { useState, useCallback } from 'react';
import { generateAds, generateSingleAd, editAd, styleVariations } from '../services/geminiService';
import type { GeneratedAd, ImageData, AdCopy } from '../types';

export const useAdGenerator = () => {
  const [generatedAds, setGeneratedAds] = useState<GeneratedAd[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string>('');

  // Initial Generation of all variations
  const generateAllAds = useCallback(async (
    productAssets: ImageData[],
    lifestyleAsset: ImageData | null,
    styleImage: ImageData,
    logoImage: ImageData | null,
    adCopy: AdCopy,
    specialRequest: string,
    aspectRatios: string[],
    imageSize: string,
    includeGooglePlay: boolean,
    includeAppStore: boolean,
    imageModel: string
  ) => {
    setIsGenerating(true);
    setGeneralError(null);
    setLoadingMessage(`Blending your ad milkshake (${imageSize})... this may take a minute.`);

    // specific ID for this batch to avoid race conditions
    const batchId = Date.now();

    // Initialize placeholders with loading state
    // We create a placeholder for every combination of (Aspect Ratio x Style Variation)
    const placeholders: GeneratedAd[] = [];
    let flatIndex = 0;

    for (const ratio of aspectRatios) {
        for (let sIdx = 0; sIdx < styleVariations.length; sIdx++) {
            placeholders.push({
                id: `${batchId}-${flatIndex}`,
                index: flatIndex,
                status: 'loading',
                imageUrl: null,
                history: [],
                aspectRatio: ratio
            });
            flatIndex++;
        }
    }

    setGeneratedAds(placeholders);

    try {
      // Use the service which now returns PromiseSettledResult[] for the flat list
      const results = await generateAds(
        productAssets,
        lifestyleAsset,
        styleImage,
        logoImage,
        adCopy,
        specialRequest,
        aspectRatios,
        imageSize,
        includeGooglePlay,
        includeAppStore,
        imageModel
      );

      setGeneratedAds(prev => prev.map((ad, idx) => {
        const result = results[idx];
        if (!result) return ad;

        if (result.status === 'fulfilled') {
          return { 
            ...ad, 
            status: 'success', 
            imageUrl: result.value, 
            history: [result.value] 
          };
        } else {
          return { 
            ...ad, 
            status: 'error', 
            error: result.reason instanceof Error ? result.reason.message : 'Generation failed' 
          };
        }
      }));
    } catch (e) {
      setGeneralError(e instanceof Error ? e.message : "An unexpected error occurred.");
      setGeneratedAds(prev => prev.map(ad => ({ ...ad, status: 'error', error: 'Batch failed' })));
    } finally {
      setIsGenerating(false);
      setLoadingMessage('');
    }
  }, []);

  // Regenerate a single ad slot
  const regenerateSingle = useCallback(async (
    index: number,
    productAssets: ImageData[],
    lifestyleAsset: ImageData | null,
    styleImage: ImageData,
    logoImage: ImageData | null,
    adCopy: AdCopy,
    specialRequest: string,
    passedAspectRatio: string | undefined,
    imageSize: string,
    includeGooglePlay: boolean,
    includeAppStore: boolean,
    imageModel: string
  ) => {
    // 1. Optimistically set the specific ad to loading state
    setGeneratedAds(prev => prev.map(ad => 
        ad.index === index ? { ...ad, status: 'loading', error: undefined } : ad
    ));

    // 2. Determine configuration
    // Fallback to 1:1 if for some reason passedAspectRatio is missing, but it should be passed from App.tsx
    const effectiveAspectRatio = passedAspectRatio || '1:1';
    
    // Determine style variation based on modulo
    const styleIndex = index % styleVariations.length;
    const creativeDirection = styleVariations[styleIndex];

    try {
      const newImageUrl = await generateSingleAd(
        productAssets,
        lifestyleAsset,
        styleImage,
        logoImage,
        adCopy,
        specialRequest,
        creativeDirection,
        effectiveAspectRatio,
        imageSize,
        includeGooglePlay,
        includeAppStore,
        imageModel
      );

      setGeneratedAds(prev => prev.map(ad => 
        ad.index === index ? { 
          ...ad, 
          status: 'success', 
          imageUrl: newImageUrl,
          history: [...ad.history, newImageUrl]
        } : ad
      ));

    } catch (e) {
      setGeneratedAds(prev => prev.map(ad => 
        ad.index === index ? { 
          ...ad, 
          status: 'error', 
          error: e instanceof Error ? e.message : 'Regeneration failed' 
        } : ad
      ));
    }
  }, []);

  const applyEdit = useCallback(async (index: number, prompt: string, referenceImage: ImageData | null, aspectRatio: string, imageSize: string, imageModel: string) => {
     // Find the current ad from the current state
     const currentAd = generatedAds.find(ad => ad.index === index);
     const currentImageUrl = currentAd?.imageUrl;

     if (!currentImageUrl) return;
     
     // Optimistic update
     setGeneratedAds(prev => prev.map(ad => {
        if (ad.index === index) {
            return { ...ad, status: 'loading' };
        }
        return ad;
     }));

     try {
        const editedUrl = await editAd(currentImageUrl, prompt, referenceImage, aspectRatio, imageSize, imageModel);
        setGeneratedAds(prev => prev.map(ad => 
            ad.index === index ? { 
                ...ad, 
                status: 'success', 
                imageUrl: editedUrl, 
                history: [...ad.history, editedUrl] 
            } : ad
        ));
     } catch (e) {
        setGeneratedAds(prev => prev.map(ad => 
            ad.index === index ? { ...ad, status: 'success', error: e instanceof Error ? e.message : 'Edit failed' } : ad
        ));
        setGeneralError(e instanceof Error ? e.message : "Edit failed");
     }
  }, [generatedAds]);

  const undoEdit = useCallback((index: number) => {
      setGeneratedAds(prev => prev.map(ad => {
          if (ad.index !== index || ad.history.length <= 1) return ad;
          const newHistory = ad.history.slice(0, -1);
          return {
              ...ad,
              imageUrl: newHistory[newHistory.length - 1],
              history: newHistory,
              status: 'success'
          };
      }));
  }, []);

  const revertToOriginal = useCallback((index: number) => {
    setGeneratedAds(prev => prev.map(ad => {
        if (ad.index !== index || ad.history.length <= 1) return ad;
        const original = ad.history[0];
        return {
            ...ad,
            imageUrl: original,
            history: [original],
            status: 'success'
        };
    }));
  }, []);

  return {
    generatedAds,
    isGenerating,
    loadingMessage,
    generalError,
    setGeneralError,
    generateAllAds,
    regenerateSingle,
    applyEdit,
    undoEdit,
    revertToOriginal
  };
};