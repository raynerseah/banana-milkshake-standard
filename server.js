import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Modality } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
// Security Headers
app.use((req, res, next) => {
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
});
// Increase limit for base64 images
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static files from dist directory (built React app)
app.use(express.static(path.join(__dirname, 'dist'), {
    maxAge: '1y',
    setHeaders: (res, path) => {
        if (path.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache');
        }
    }
}));

// Initialize Gemini Client
const getAI = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY environment variable is not set.");
    }
    return new GoogleGenAI({ apiKey });
};

// Helper for retries
const delay = (ms) => new Promise(res => setTimeout(res, ms));
const MAX_RETRIES = 3;

const withRetries = async (apiCall, context) => {
    for (let i = 0; i < MAX_RETRIES; i++) {
        try {
            return await apiCall();
        } catch (error) {
            console.error(`Attempt ${i + 1}/${MAX_RETRIES} failed for ${context}:`, error);
            if (i === MAX_RETRIES - 1) {
                let finalMessage = "An unexpected error occurred. Please try again.";
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
                                    finalMessage = `Error: API Quota Exceeded.`;
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
            }
            const jitter = Math.random() * 1000 - 500;
            await delay((2000 * Math.pow(2, i)) + jitter);
        }
    }
    throw new Error(`Operation failed for ${context} after ${MAX_RETRIES} attempts.`);
};

// --- API Routes ---

app.post('/api/getCopySuggestion', async (req, res) => {
    try {
        const { copyType, currentCopy } = req.body;
        const limits = { headline: 35, description: 100, cta: 25 };
        const limit = limits[copyType] || 50;

        const prompt = `
        <instruction>
            <role>Expert Ad Copywriter</role>
            <task>Refine the provided ad ${copyType} to be concise, engaging, and under ${limit} characters.</task>
            <original_text>${currentCopy}</original_text>
            <output_format>Return ONLY the refined text. No quotes, no explanations.</output_format>
        </instruction>`;

        const suggestion = await withRetries(async () => {
            const response = await getAI().models.generateContent({
                model: 'gemini-3.5-flash',
                contents: prompt,
                config: { temperature: 0.8, thinkingConfig: { thinkingBudget: 1024 } }
            });
            return response.text.trim().replace(/"/g, '');
        }, `copy suggestion`);

        res.json({ suggestion });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/editAd', async (req, res) => {
    try {
        const { baseImage, prompt, referenceImage, aspectRatio, imageSize, imageModel } = req.body;
        
        const match = baseImage.match(/^data:(image\/.+);base64,(.+)$/);
        if (!match) throw new Error("Invalid base image format.");

        const parts = [];
        parts.push({ text: "Base Image to Edit:" });
        parts.push({ inlineData: { data: match[2], mimeType: match[1] } });

        if (referenceImage) {
            parts.push({ text: "Reference Image (for swap or style):" });
            parts.push({ inlineData: { data: referenceImage.data, mimeType: referenceImage.mimeType } });
        }

        const editPrompt = `
        <instruction>
            <role>Expert Photo Retoucher and Compositor</role>
            <task>Perform a precise edit on the attached Base Image based on user instructions.</task>
            <user_instruction>${prompt}</user_instruction>
            <strict_rules>
                <rule>Change ONLY what is requested.</rule>
                <rule>Preserve image quality, resolution, and aspect ratio perfectly.</rule>
                <rule>If a Reference Image is provided, use it strictly as the source for any swaps (logo, product) or style references requested.</rule>
                <rule>STRICT: Do not modify the design, shape, form, labels, or color of the product unless explicitly asked to swap it.</rule>
                <rule>IMAGE INTEGRITY: Ensure the final output looks like a high-quality photograph or digital ad, not a cartoon.</rule>
            </strict_rules>
        </instruction>`;
        parts.push({ text: editPrompt });

        const editedUrl = await withRetries(async () => {
            const response = await getAI().models.generateContent({
                model: imageModel || 'gemini-3.1-flash-image',
                contents: { parts },
                config: {
                    responseModalities: [Modality.IMAGE, Modality.TEXT],
                    imageConfig: { imageSize, aspectRatio }
                }
            });
            const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
            if (imagePart && imagePart.inlineData) {
                return `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
            }
            throw new Error("No image generated.");
        }, 'edit ad');

        res.json({ imageUrl: editedUrl });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/generateLifestyleImage', async (req, res) => {
    try {
        const { productImages, prompt, aspectRatio, imageSize, imageModel } = req.body;
        
        const parts = [];
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
                <rule>COMPOSITING: Integrate the product naturally into the generated environment. Apply lighting and shadow to blend it.</rule>
                <rule>PRIORITY FOCUS: The product must be the "Hero". It should be prominent, well-lit, and occupy a significant portion of the frame.</rule>
                <rule>No extra text or labels in the scene.</rule>
            </strict_rules>
        </instruction>`;
        parts.push({ text: fullPrompt });

        const result = await withRetries(async () => {
            const response = await getAI().models.generateContent({
                model: imageModel || 'gemini-3.1-flash-image',
                contents: { parts },
                config: {
                    responseModalities: [Modality.IMAGE, Modality.TEXT],
                    imageConfig: { aspectRatio, imageSize }
                }
            });
            const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
            if (imagePart && imagePart.inlineData) {
                return { data: imagePart.inlineData.data, mimeType: imagePart.inlineData.mimeType };
            }
            throw new Error("No image generated.");
        }, 'generate lifestyle');

        res.json({ image: result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/generateSingleAd', async (req, res) => {
    try {
        const { productAssets, lifestyleAsset, styleImage, logoImage, adCopy, specialRequest, creativeDirection, aspectRatio, imageSize, includeGooglePlay, includeAppStore, imageModel } = req.body;
        
        const parts = [];
        if (productAssets && productAssets.length > 0) {
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

        const badges = [];
        if (includeGooglePlay) badges.push("Google Play Badge");
        if (includeAppStore) badges.push("App Store Badge");

        const prompt = `
<system>
  <role>Expert Digital Compositor</role>
  <objective>Create a professional advertisement by compositing the provided assets.</objective>
</system>

<input_assets>
  <asset id="ASSET_1_PRODUCTS" presence="${productAssets?.length > 0 ? 'required' : 'none'}"><description>Hero product images. GROUND TRUTH.</description></asset>
  <asset id="ASSET_2_STYLE_GUIDE" presence="required"><description>Reference for LAYOUT, COLOR PALETTE, and TYPOGRAPHY STYLE only. NEVER include its photographic elements.</description></asset>
  <asset id="ASSET_3_LOGO" presence="${logoImage ? 'required' : 'none'}"><description>Brand Logo.</description></asset>
  <asset id="ASSET_4_LIFESTYLE" presence="${lifestyleAsset ? 'required' : 'none'}"><description>Treat it as main visual background. You are permitted to extend the background ONLY to fit aspect ratio.</description></asset>
</input_assets>

<special_user_request>${specialRequest || "None"}</special_user_request>

<text_content_requirements>
  <headline>${adCopy?.headline || "None"}</headline>
  <description>${adCopy?.description || "None"}</description>
  <cta>${adCopy?.cta || "None"}</cta>
  <store_badges>${badges.length > 0 ? "Include: " + badges.join(' and ') + "." : 'None.'}</store_badges>
</text_content_requirements>

<creative_direction>${creativeDirection}</creative_direction>

<strict_constraints>
  <rule priority="CRITICAL">STYLE GUIDE ISOLATION: ABSOLUTELY NO photographic elements from ASSET_2_STYLE_GUIDE may be present.</rule>
  <rule priority="HIGHEST">PRODUCT FIDELITY: The product images (ASSET_1) is sacred.</rule>
  <rule priority="HIGHEST">TEXT PLACEMENT SAFETY: Text must be placed in negative space.</rule>
  <rule>TEXT INCLUSION: ONLY include text that is explicitly provided. If "None", MUST NOT include.</rule>
</strict_constraints>`;
        parts.push({ text: prompt });

        const imageUrl = await withRetries(async () => {
            const response = await getAI().models.generateContent({
                model: imageModel || 'gemini-3.1-flash-image',
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
        }, 'generate single ad');

        res.json({ imageUrl });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
