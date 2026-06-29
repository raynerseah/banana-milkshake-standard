import { GoogleGenAI, Modality } from "@google/genai";
import type { AdCopy, ImageData } from '../types';

let aiInstance: GoogleGenAI | null = null;

const getAI = () => {
  if (!aiInstance) {
    const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not set. Please provide it in the Settings menu.");
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
};

const MAX_RETRIES = 3;

/**
 * Parses a raw error from the Gemini API and throws a user-friendly error.
 */
const handleGeminiError = (error: unknown, context: string): never => {
  let finalMessage = "We have encountered problems in generating your assets. An unexpected error occurred. Please try again.";

  if (error instanceof Error) {
    const rawMessage = error.message;
    const jsonMatch = rawMessage.match(/{.*}/s);

    if (jsonMatch) {
      try {
        const parsedError = JSON.parse(jsonMatch[0]).error;
        if (parsedError && parsedError.message) {
          const errorCode = parsedError.status || 'N/A';
          const keyMessage = parsedError.message;
          
          if (errorCode === 'RESOURCE_EXHAUSTED') {
             finalMessage = `Error: API Quota Exceeded (out of tokens).`;
          } else if (keyMessage.toLowerCase().includes('safety')) {
            finalMessage = `Error: Request blocked due to content safety policy.`;
          } else {
            finalMessage = `Error (${errorCode}): ${keyMessage}`;
          }
        }
      } catch (e) {
        console.warn('Could not parse JSON from error message.', e);
      }
    } else {
        finalMessage = `Error: ${rawMessage}`;
    }
  }
  throw new Error(finalMessage);
};

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

/**
 * Wraps an async function with retry logic including exponential backoff.
 */
const withRetries = async <T>(apiCall: () => Promise<T>, context: string): Promise<T> => {
    for (let i = 0; i < MAX_RETRIES; i++) {
        try {
            return await apiCall();
        } catch (error) {
            console.error(`Attempt ${i + 1}/${MAX_RETRIES} failed for ${context}:`, error);
            if (i === MAX_RETRIES - 1) {
                handleGeminiError(error, context);
            }
            // Exponential backoff with jitter: 2s, 4s, etc. +/- 500ms
            const jitter = Math.random() * 1000 - 500;
            await delay((2000 * Math.pow(2, i)) + jitter);
        }
    }
    throw new Error(`Operation failed for ${context} after ${MAX_RETRIES} attempts.`);
};


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

        // Preserve PNG for transparency, otherwise compress as JPEG
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

export const getCopySuggestion = (
  copyType: keyof AdCopy,
  currentCopy: string
): Promise<string> => {
  const limits = { headline: 35, description: 100, cta: 25 };
  const limit = limits[copyType];

  const prompt = `
  <instruction>
    <role>Expert Ad Copywriter</role>
    <task>Refine the provided ad ${copyType} to be concise, engaging, and under ${limit} characters.</task>
    <original_text>${currentCopy}</original_text>
    <output_format>Return ONLY the refined text. No quotes, no explanations.</output_format>
  </instruction>
  `;
  
  const model = 'gemini-3-flash-preview';

  return withRetries(async () => {
    const response = await getAI().models.generateContent({ 
        model, 
        contents: prompt,
        config: {
            temperature: 0.8,
            thinkingConfig: { thinkingBudget: 1024 }
        }
    });
    return response.text.trim().replace(/"/g, '');
  }, `copy suggestion for ${copyType}`);
};

export const editAd = (
  baseImage: string,
  prompt: string,
  referenceImage: ImageData | null,
  aspectRatio: string = '1:1',
  imageSize: string = '1K'
): Promise<string> => {
  const model = 'gemini-3.1-flash-image-preview';
  
  const editPrompt = `
  <instruction>
    <role>Expert Photo Retoucher and Compositor</role>
    <task>Perform a precise edit on the attached Base Image based on user instructions.</task>
    <user_instruction>${prompt}</user_instruction>
    <strict_rules>
        <rule>Change ONLY what is requested.</rule>
        <rule>Preserve image quality, resolution, and aspect ratio perfectly.</rule>
        <rule>Do not add your own creative interpretations beyond the instruction.</rule>
        <rule>If a Reference Image is provided, use it strictly as the source for any swaps (logo, product) or style references requested.</rule>
        <rule>If replacing a product with the Reference Image, the new product's design/integrity must be preserved strictly. DO NOT redraw text or logos.</rule>
        <rule>STRICT: Do not modify the design, shape, form, labels, or color of the product unless explicitly asked to swap it. The product brand identity must remain inviolate.</rule>
        <rule>IMAGE INTEGRITY: Ensure the final output looks like a high-quality photograph or digital ad, not a cartoon or illustration (unless the style guide dictates otherwise).</rule>
    </strict_rules>
  </instruction>
  `;

  const match = baseImage.match(/^data:(image\/.+);base64,(.+)$/);
  if (!match) return Promise.reject(new Error("Invalid base image data URL format."));
  
  const parts: any[] = [];
  
  // Base Image
  parts.push({ text: "Base Image to Edit:" });
  parts.push({ inlineData: { data: match[2], mimeType: match[1] } });
  
  // Reference Image (Optional)
  if (referenceImage) {
      parts.push({ text: "Reference Image (for swap or style):" });
      parts.push({ inlineData: { data: referenceImage.data, mimeType: referenceImage.mimeType } });
  }

  // Prompt
  parts.push({ text: editPrompt });

  return withRetries(async () => {
    const response = await getAI().models.generateContent({
        model,
        contents: { parts },
        config: { 
            responseModalities: [Modality.IMAGE, Modality.TEXT],
            imageConfig: { imageSize, aspectRatio }
        }
    });

    const generatedImagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    if (generatedImagePart && generatedImagePart.inlineData) {
        return `data:${generatedImagePart.inlineData.mimeType};base64,${generatedImagePart.inlineData.data}`;
    }
    throw new Error("Model response did not contain a valid image part for the edit.");
  }, `ad editing`);
};

export const generateLifestyleImage = (
    productImages: ImageData[],
    prompt: string,
    aspectRatio: string = '1:1',
    imageSize: string = '2K'
): Promise<ImageData> => {
    const model = 'gemini-3.1-flash-image-preview';
    const parts: any[] = [];

    parts.push({ text: '<input_assets>' });
    productImages.forEach((img, index) => {
        parts.push({ text: `<product_asset id="${index + 1}">` });
        parts.push({ inlineData: { data: img.data, mimeType: img.mimeType } });
        parts.push({ text: `</product_asset>` });
    });
    parts.push({ text: '</input_assets>' });

    const fullPrompt = `
    <instruction>
        <role>Expert Commercial Compositor and Retoucher</role>
        <task>Composite the input products into a photorealistic lifestyle scene. The product must be the absolute KEY ELEMENT with priority focus.</task>
        <scene_description>${prompt}</scene_description>
        <strict_rules>
            <rule>PRODUCT PRESERVATION: VERY IMPORTANT. The input images <input_assets> are the ground truth. Do not modify the product design, logo, text, or shape.</rule>
            <rule>COMPOSITING: Integrate the product naturally into the generated environment. Apply lighting and shadow to blend it, but do not alter the pixels of the product branding.</rule>
            <rule>PRIORITY FOCUS: The product must be the "Hero". It should be prominent, well-lit, and occupy a significant portion of the frame. Do not place it far away or make it small. The product should be featured in full without any cropping.</rule>
            <rule>No extra text or labels in the scene.</rule>
        </strict_rules>
    </instruction>
    `;

    parts.push({ text: fullPrompt });

    return withRetries(async () => {
        const response = await getAI().models.generateContent({
            model,
            contents: { parts },
            config: { 
                responseModalities: [Modality.IMAGE, Modality.TEXT],
                imageConfig: { aspectRatio: aspectRatio, imageSize }
            }
        });
        
        const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
        if (imagePart && imagePart.inlineData) {
            return {
                data: imagePart.inlineData.data,
                mimeType: imagePart.inlineData.mimeType,
            };
        }
        throw new Error("No image was generated in the lifestyle creation step.");

    }, "lifestyle image generation");
};

export const styleVariations = [
    "TEMPLATE_ADAPTATION: Strictly follow the layout structure and design elements of the provided Style Guide/Template (ASSET_2). Replace the content with the provided Product/Lifestyle assets + new copy + Logo (ASSET_3, if available). Retain the vibe."
];

export const generateSingleAd = (
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
  includeAppStore: boolean = false
): Promise<string> => {
  const model = 'gemini-3.1-flash-image-preview';
  
  const badges = [];
  if (includeGooglePlay) badges.push("Google Play Badge");
  if (includeAppStore) badges.push("App Store Badge");
  
  const prompt = `
<system>
  <role>Expert Digital Compositor</role>
  <objective>Create a professional advertisement by compositing the provided assets.</objective>
</system>

<input_assets>
  <asset id="ASSET_1_PRODUCTS" presence="${productAssets.length > 0 ? 'required' : 'none'}">
     <description>Hero product images. GROUND TRUTH. Treat as a rigid layer. Isolate the product but do not redraw, morph, or add filter to the product itself. Maintain exact packaging details. All products must be present.</description>
  </asset>
  
  <asset id="ASSET_2_STYLE_GUIDE" presence="required">
     <description>Reference for LAYOUT, COLOR PALETTE, and TYPOGRAPHY STYLE only. CRITICAL: NEVER include or bleed any of its photographic elements, background images, subjects, or visual content into the final output.</description>
  </asset>

  <asset id="ASSET_3_LOGO" presence="${logoImage ? 'required' : 'none'}">
     <description>Brand Logo. Must be included exactly as is (immutable). Place in a standard corner.</description>
  </asset>

  <asset id="ASSET_4_LIFESTYLE" presence="${lifestyleAsset ? 'required' : 'none'}">
     <description>Treat it as main visual background. CORE CONTENT IS IMMUTABLE. You are permitted to extend the background (outpaint) ONLY to fit the aspect ratio or create negative space for text. Do not modify existing subjects.</description>
  </asset>
</input_assets>

<special_user_request>
  ${specialRequest || "None"}
</special_user_request>

<text_content_requirements>
  <instruction>
    The following text must be placed on the ad. 
    CRITICAL: The meaning of this text must NOT influence the visual generation of the scene or product. 
    CRITICAL: DO NOT add any placeholder text (e.g., "Lorem Ipsum"). If a field is "None", DO NOT generate that text element.
  </instruction>
  <headline>${adCopy.headline || "None"}</headline>
  <description>${adCopy.description || "None"}</description>
  <cta>${adCopy.cta || "None"}</cta>
  <store_badges>
    ${badges.length > 0 ? `Include: ${badges.join(' and ')}. Place in corners where they do not distract from the main elements, legible.` : 'None.'}
  </store_badges>
</text_content_requirements>

<creative_direction>
  ${creativeDirection}
</creative_direction>

<strict_constraints>
  <rule priority="CRITICAL">SPECIAL REQUEST PRIORITY: If <special_user_request> is provided and not "None", strictly follow it. It overrides conflicting standard style guidelines or default composition rules.</rule>
  <rule priority="CRITICAL">STYLE GUIDE ISOLATION: ABSOLUTELY NO photographic elements, background images, architecture, people, or product photos from ASSET_2_STYLE_GUIDE may be present or "bleed" into the final generated ad. Use ASSET_2 exclusively for layout positioning, design inspiration, fonts, and colors.</rule>
  <rule priority="HIGHEST">PRODUCT FIDELITY: The product images (ASSET_1) is sacred. Do not modify the design or color of the product in any way. If perspective requires a change that distorts the logo/text, prefer the original angle.</rule>
  <rule priority="HIGHEST">TEXT PLACEMENT SAFETY: Text (Headline, Description, CTA) must be placed in negative space. DO NOT OVERLAY TEXT ON TOP OF THE PRODUCT OR ON TOP OF PEOPLE/FACES.</rule>
  <rule priority="HIGH">LIFESTYLE INTEGRITY: If ASSET_4 is used, use it as it is. You are PERMITTED to extend/outpaint the background edges to accommodate the target aspect ratio or create negative space for text. Do not remove or replace existing people or objects.</rule>
  <rule>TEXT INDEPENDENCE: Do not use the Ad Copy words to generate visual elements. For example, if the copy says "Splash", do not generate a splash unless the Style Guide or Lifestyle asset already has it. Only use provided visual assets.</rule>
  <rule>TEXT INCLUSION: ONLY include text that is explicitly provided in <text_content_requirements>. If a field is "None", you MUST NOT include that type of text (e.g. no body copy, no CTA button). Do not make up text.</rule>
  <rule>LOGO INTEGRITY: If ASSET_3_LOGO is provided, use it exactly as is (immutable). If ASSET_3_LOGO presence is "none", DO NOT generate or add any logo or watermark.</rule>
  <rule>NO ARTIFACTS: Do not write "ASSET 1", "ASSET 2" or placeholder text like "Headline Here" on the image.</rule>
</strict_constraints>
`;

  const parts: any[] = [];
  
  // Attach images to prompt in order
  if (productAssets.length > 0) {
      parts.push({ text: '<asset_data id="ASSET_1_PRODUCTS">' });
      productAssets.forEach(asset => {
          parts.push({ inlineData: { data: asset.data, mimeType: asset.mimeType } });
      });
      parts.push({ text: '</asset_data>' });
  }

  parts.push({ text: '<asset_data id="ASSET_2_STYLE_GUIDE">' });
  parts.push({ inlineData: { data: styleImage.data, mimeType: styleImage.mimeType } });
  parts.push({ text: '</asset_data>' });
  
  if (logoImage) {
      parts.push({ text: '<asset_data id="ASSET_3_LOGO">' });
      parts.push({ inlineData: { data: logoImage.data, mimeType: logoImage.mimeType } });
      parts.push({ text: '</asset_data>' });
  }
  
  if (lifestyleAsset) {
      parts.push({ text: '<asset_data id="ASSET_4_LIFESTYLE">' });
      parts.push({ inlineData: { data: lifestyleAsset.data, mimeType: lifestyleAsset.mimeType } });
      parts.push({ text: '</asset_data>' });
  }
  
  parts.push({ text: prompt });

  return withRetries(async () => {
    const response = await getAI().models.generateContent({
        model,
        contents: { parts },
        config: { 
            responseModalities: [Modality.IMAGE, Modality.TEXT],
            imageConfig: { aspectRatio, imageSize }
        }
    });

    const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    if (imagePart && imagePart.inlineData) {
        return `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
    }
    throw new Error("No image generated.");
  }, `ad generation`);
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
  includeAppStore: boolean = false
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
                    includeAppStore
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