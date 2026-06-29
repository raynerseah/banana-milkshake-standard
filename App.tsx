import React, { useState, useCallback, useMemo } from 'react';
import type { AdCopy, ImageData } from './types';
import { generateLifestyleImage, getCopySuggestion } from './services/geminiService';
import { useAdGenerator } from './hooks/useAdGenerator';
import Header from './components/Header';
import FileInput from './components/FileInput';
import CopyInput from './components/CopyInput';
import Loader from './components/Loader';
import ErrorAlert from './components/ErrorAlert';
import ResultsDisplay from './components/ResultsDisplay';
import OutputPlaceholder from './components/OutputPlaceholder';

// Create a stable component wrapper for FileInput to prevent re-renders in arrays
const ProductFileInput = React.memo(({ index, onFileChange }: { index: number; onFileChange: (index: number, data: ImageData | null) => void }) => {
    const handleChange = useCallback((data: ImageData | null) => onFileChange(index, data), [index, onFileChange]);
    return <FileInput id={`product-image-${index}`} label={`Img ${index + 1}`} onFileChange={handleChange} compact />;
});

const App: React.FC = () => {
  // --- Assets State ---
  const [productImages, setProductImages] = useState<(ImageData | null)[]>(Array(4).fill(null));
  const [styleImage, setStyleImage] = useState<ImageData | null>(null);
  const [logoImage, setLogoImage] = useState<ImageData | null>(null);
  
  // --- Configuration State ---
  const [specialRequest, setSpecialRequest] = useState<string>('');
  const [selectedAspectRatios, setSelectedAspectRatios] = useState<string[]>(['1:1']);
  const [imageSize, setImageSize] = useState<string>('1K');
  const [includeGooglePlay, setIncludeGooglePlay] = useState<boolean>(false);
  const [includeAppStore, setIncludeAppStore] = useState<boolean>(false);
  
  // --- Selection Logic State ---
  const [lifestyleProductSelection, setLifestyleProductSelection] = useState<boolean[]>(Array(4).fill(false));
  const [adProductSelection, setAdProductSelection] = useState<boolean[]>(Array(4).fill(true));
  const [useLifestyleInAd, setUseLifestyleInAd] = useState<boolean>(true);

  // --- Lifestyle Generation State ---
  const [lifestylePrompt, setLifestylePrompt] = useState<string>('');
  const [generatedLifestyleImage, setGeneratedLifestyleImage] = useState<ImageData | null>(null);
  const [isGeneratingLifestyle, setIsGeneratingLifestyle] = useState<boolean>(false);
  const [lifestyleError, setLifestyleError] = useState<string | null>(null);
  
  // --- Ad Copy State ---
  const [adCopy, setAdCopy] = useState<AdCopy>({ headline: '', description: '', cta: '' });
  const [isSuggestingCopy, setIsSuggestingCopy] = useState({ headline: false, description: false, cta: false });

  // --- Ad Generation Logic (via Hook) ---
  const { 
      generatedAds, 
      isGenerating: isGeneratingAds, 
      loadingMessage, 
      generalError, 
      setGeneralError, 
      generateAllAds, 
      regenerateSingle,
      applyEdit,
      undoEdit,
      revertToOriginal
  } = useAdGenerator();

  // --- Editing State (UI only) ---
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editPrompt, setEditPrompt] = useState<string>('');
  const [editReferenceImage, setEditReferenceImage] = useState<ImageData | null>(null);
  const [editRefInputKey, setEditRefInputKey] = useState<number>(0);

  const aspectRatioOptions = useMemo(() => [
    { category: 'Landscape', ratios: ['21:9', '16:9', '4:3', '3:2', '5:4'] },
    { category: 'Square', ratios: ['1:1'] },
    { category: 'Portrait', ratios: ['9:16', '3:4', '2:3', '4:5'] },
  ], []);

  // --- Handlers ---

  const handleProductImageChange = useCallback((index: number, data: ImageData | null) => {
    setProductImages(prev => {
        const newImages = [...prev];
        newImages[index] = data;
        return newImages;
    });
    // Auto-select logic
    setLifestyleProductSelection(prev => {
        if (data && !prev.some(Boolean)) {
             const n = [...prev]; n[index] = true; return n;
        }
        return prev;
    });
    setAdProductSelection(prev => { const n = [...prev]; n[index] = !!data; return n; });
  }, []);

  const toggleLifestyleSelection = useCallback((index: number) => {
    setLifestyleProductSelection(prev => { const n = [...prev]; n[index] = !n[index]; return n; });
  }, []);

  const toggleAdSelection = useCallback((index: number) => {
    setAdProductSelection(prev => { const n = [...prev]; n[index] = !n[index]; return n; });
  }, []);

  const toggleAspectRatio = useCallback((ratio: string) => {
      setSelectedAspectRatios(prev => {
          if (prev.includes(ratio)) {
              if (prev.length === 1) return prev; // Must have at least one
              return prev.filter(r => r !== ratio);
          } else {
              if (prev.length >= 3) return prev; // Max 3
              return [...prev, ratio];
          }
      });
  }, []);
  
  // Derived assets
  const selectedProductAssets = useMemo(() => {
      return productImages.filter((img, idx) => img && adProductSelection[idx]) as ImageData[];
  }, [productImages, adProductSelection]);

  const selectedLifestyleAsset = useMemo(() => {
      return (generatedLifestyleImage && useLifestyleInAd) ? generatedLifestyleImage : null;
  }, [generatedLifestyleImage, useLifestyleInAd]);

  const isFormValid = useMemo(() => {
    const hasAssets = selectedProductAssets.length > 0 || selectedLifestyleAsset !== null;
    return hasAssets && styleImage;
  }, [selectedProductAssets, selectedLifestyleAsset, styleImage]);

  const handleCopyChange = useCallback((field: keyof AdCopy, value: string) => {
    setAdCopy(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleCopySuggestion = useCallback(async (field: keyof AdCopy) => {
    if (!adCopy[field] || isSuggestingCopy[field]) return;
    setIsSuggestingCopy(prev => ({ ...prev, [field]: true }));
    try {
      const suggestion = await getCopySuggestion(field, adCopy[field]);
      setAdCopy(prev => ({ ...prev, [field]: suggestion }));
    } catch (e) {
      console.error(e); // Silent fail for copy suggestion
    } finally {
      setIsSuggestingCopy(prev => ({ ...prev, [field]: false }));
    }
  }, [adCopy, isSuggestingCopy]);
  
  const handleGenerateLifestyle = useCallback(async () => {
    const selectedImages = productImages.filter((img, i) => img && lifestyleProductSelection[i]) as ImageData[];
    if (selectedImages.length === 0 || !lifestylePrompt.trim()) {
      setLifestyleError("Please select at least one product and provide a prompt.");
      return;
    }
    setIsGeneratingLifestyle(true);
    setLifestyleError(null);
    setGeneratedLifestyleImage(null);
    try {
        const result = await generateLifestyleImage(selectedImages, lifestylePrompt, '1:1', '2K');
        setGeneratedLifestyleImage(result);
        setUseLifestyleInAd(true); 
    } catch (e) {
        setLifestyleError((e as Error).message);
    } finally {
        setIsGeneratingLifestyle(false);
    }
  }, [productImages, lifestyleProductSelection, lifestylePrompt]);
  
  const downloadImage = useCallback((imageData: ImageData, fileName: string) => {
    const link = document.createElement('a');
    link.href = `data:${imageData.mimeType};base64,${imageData.data}`;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  // --- Main Generation Handlers ---

  const handleSubmit = useCallback(() => {
    if (!isFormValid || !styleImage) return;
    
    // Call Hook
    generateAllAds(
        selectedProductAssets,
        selectedLifestyleAsset,
        styleImage,
        logoImage,
        adCopy,
        specialRequest,
        selectedAspectRatios, // Pass array
        imageSize,
        includeGooglePlay,
        includeAppStore
    );
  }, [isFormValid, styleImage, generateAllAds, selectedProductAssets, selectedLifestyleAsset, logoImage, adCopy, specialRequest, selectedAspectRatios, imageSize, includeGooglePlay, includeAppStore]);
  
  const handleRegenerateAd = useCallback((index: number) => {
    if (!styleImage) return;
    const ad = generatedAds.find(a => a.index === index);
    if (!ad) return;

    regenerateSingle(
        index,
        selectedProductAssets,
        selectedLifestyleAsset,
        styleImage,
        logoImage,
        adCopy,
        specialRequest,
        ad.aspectRatio, // Use the ad's ratio
        imageSize,
        includeGooglePlay,
        includeAppStore
    );
  }, [styleImage, generatedAds, regenerateSingle, selectedProductAssets, selectedLifestyleAsset, logoImage, adCopy, specialRequest, imageSize, includeGooglePlay, includeAppStore]);

  // --- Edit Handlers ---

  const handleSelectAdForEdit = useCallback((index: number) => {
      setEditingIndex(index);
      setEditPrompt('');
      setEditReferenceImage(null);
      setEditRefInputKey(prev => prev + 1);
  }, []);

  const handleCancelEdit = useCallback(() => {
      setEditingIndex(null);
      setEditPrompt('');
      setEditReferenceImage(null);
      setEditRefInputKey(prev => prev + 1);
  }, []);

  const onApplyEdit = useCallback(async () => {
      if (editingIndex === null || !editPrompt.trim()) return;
      const currentAd = generatedAds.find(ad => ad.index === editingIndex);
      if (!currentAd) return;

      await applyEdit(editingIndex, editPrompt, editReferenceImage, currentAd.aspectRatio, imageSize);
      setEditPrompt('');
      setEditReferenceImage(null);
      setEditRefInputKey(prev => prev + 1);
  }, [editingIndex, editPrompt, generatedAds, applyEdit, editReferenceImage, imageSize]);

  // Get currently editing ad data for preview
  const currentEditingAd = editingIndex !== null ? generatedAds.find(ad => ad.index === editingIndex) : null;
  const currentEditingImage = currentEditingAd?.imageUrl;

  return (
    <div className="bg-gray-50 min-h-screen text-slate-800 font-sans flex flex-col">
      <Header />
      <main className="container mx-auto px-4 py-8 sm:py-12 flex-grow">
        
        {/* Top Note */}
        <div className="mb-6 p-3 bg-yellow-50 border-l-4 border-yellow-400 text-yellow-800 text-sm rounded-r-md shadow-sm">
           <strong>Important:</strong> Please read the disclaimer at the bottom before using the tool.
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
          
          {/* Left Panel: Configuration */}
          <div className="lg:col-span-2">
            <div className="p-1 bg-gradient-to-br from-blue-100 via-green-100 to-yellow-100 rounded-3xl shadow-2xl">
              <div className="bg-white p-6 sm:p-8 rounded-[22px]">
                <div className="space-y-8">
                  
                  {/* Section 1: Assets */}
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900 border-b-4 border-[#4285F4] pb-2 flex items-center gap-3">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-[#4285F4]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l-1-1m6-3l-2 2" /></svg>
                        Add ingredients
                      </h2>
                      <p className="text-sm text-gray-500 mt-2">Provide key assets for your image ads</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">1. Product Photos (Max 4) <span className="text-red-500">*</span></label>
                        <div className="grid grid-cols-2 gap-2">
                            {productImages.map((_, index) => (
                                <ProductFileInput 
                                    key={`product-${index}`}
                                    index={index}
                                    onFileChange={handleProductImageChange}
                                />
                            ))}
                        </div>
                    </div>
                    
                    <FileInput id="style-image" label="2. Brand Style Guide / Ad Template" onFileChange={setStyleImage} required />
                    <FileInput id="logo-image" label="3. Brand Logo (Optional)" onFileChange={setLogoImage} note="Transparent PNG recommended." />
                    
                    <div className="mt-4">
                        <label htmlFor="special-request" className="block text-sm font-medium text-gray-700 mb-1">
                            Special Request (Optional)
                        </label>
                        <textarea
                            id="special-request"
                            rows={2}
                            value={specialRequest}
                            onChange={(e) => setSpecialRequest(e.target.value)}
                            placeholder="E.g. Make the background Christmas themed, place CTA on left, use dark mode..."
                            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition bg-white text-gray-900 text-sm placeholder:text-gray-400"
                        />
                    </div>

                    {/* Optional Lifestyle Generation */}
                    {productImages.some(img => img !== null) && (
                      <div className="p-4 bg-green-50 rounded-lg border border-green-200 transition-all duration-300 space-y-4">
                        <h3 className="text-lg font-bold text-gray-800 text-center">🍌 Upsize your order? 🍌</h3>
                        <p className="text-sm text-gray-500 text-center -mt-2 mb-2">Optional: Generate a lifestyle scene using your products.</p>

                        <div className="mb-3">
                            <p className="text-xs font-bold text-gray-600 mb-2">Select products for lifestyle scene:</p>
                            <div className="flex gap-2 flex-wrap">
                                {productImages.map((img, index) => img && (
                                    <button 
                                        key={`ls-sel-${index}`}
                                        onClick={() => toggleLifestyleSelection(index)}
                                        className={`w-10 h-10 rounded-md border-2 overflow-hidden transition-all relative ${lifestyleProductSelection[index] ? 'border-[#34A853] ring-2 ring-green-500/30' : 'border-gray-300 opacity-60'}`}
                                    >
                                        <img src={`data:${img.mimeType};base64,${img.data}`} alt="" className="w-full h-full object-cover" />
                                        {lifestyleProductSelection[index] && (
                                            <div className="absolute inset-0 bg-[#34A853]/20 flex items-center justify-center">
                                                 <svg className="w-6 h-6 text-white drop-shadow-md" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path></svg>
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                        
                        <div>
                          <textarea
                            value={lifestylePrompt}
                            onChange={(e) => setLifestylePrompt(e.target.value)}
                            placeholder="Describe the lifestyle scene. Banana Milkshake will automatically put your selected product/s into context. (E.g. Asian man hiking at sunset, etc)"
                            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#34A853] focus:border-[#34A853] transition bg-gray-100 text-gray-900 text-sm"
                            rows={3}
                          />
                        </div>

                        {lifestyleError && <p className="text-xs text-red-500">{lifestyleError}</p>}

                        <button 
                          onClick={handleGenerateLifestyle} 
                          disabled={isGeneratingLifestyle || !lifestylePrompt.trim()}
                          className="w-full flex items-center justify-center gap-2 bg-[#34A853] text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all"
                        >
                          {isGeneratingLifestyle ? 'Upsizing...' : 'Generate Lifestyle (1K)'}
                        </button>
                        
                        {generatedLifestyleImage && (
                          <div className="mt-4 p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
                             <img src={`data:${generatedLifestyleImage.mimeType};base64,${generatedLifestyleImage.data}`} alt="Generated lifestyle" className="w-full rounded-md" />
                             <div className="mt-2 text-right">
                                 <button onClick={() => downloadImage(generatedLifestyleImage, 'lifestyle-image.png')} className="text-xs text-blue-600 hover:underline font-semibold">Download Image</button>
                             </div>
                          </div>
                        )}
                      </div>
                     )}
                  </div>

                  {/* Section 2: Copy */}
                  <div className="space-y-6">
                    <div>
                       <h2 className="text-2xl font-bold text-gray-900 border-b-4 border-[#FABC05] pb-2 flex items-center gap-3">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-[#FABC05]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L15.232 5.232z" /></svg>
                         Add spices (Optional)
                       </h2>
                    </div>

                    <CopyInput id="headline" label="Headline" value={adCopy.headline} onChange={(e) => handleCopyChange('headline', e.target.value)} onSuggest={() => handleCopySuggestion('headline')} isSuggesting={isSuggestingCopy.headline} maxLength={35} />
                    <CopyInput id="description" label="Description" value={adCopy.description} onChange={(e) => handleCopyChange('description', e.target.value)} onSuggest={() => handleCopySuggestion('description')} isSuggesting={isSuggestingCopy.description} isTextarea maxLength={100} />
                    <CopyInput id="cta" label="Call to Action (CTA)" value={adCopy.cta} onChange={(e) => handleCopyChange('cta', e.target.value)} onSuggest={() => handleCopySuggestion('cta')} isSuggesting={isSuggestingCopy.cta} maxLength={25} />
                  </div>

                  {/* Section 3: Final Config */}
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900 border-b-4 border-[#EA4335] pb-2 flex items-center gap-3">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-[#EA4335]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                         Final takeaway requests
                      </h2>
                    </div>

                    {(productImages.some(Boolean) || generatedLifestyleImage) && (
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                            <h4 className="text-sm font-bold text-gray-800 mb-2">Select assets for Final Ad:</h4>
                            <p className="text-xs text-gray-600 mb-3 leading-relaxed">
                                Choose at least 1. Selecting both Lifestyle + Prod asset will potentially result in the product being placed as a standalone, separate layer on top of the Lifestyle image.
                            </p>
                            <div className="flex gap-4 flex-wrap">
                                {productImages.map((img, index) => img && (
                                    <button 
                                        key={`ad-sel-${index}`}
                                        onClick={() => toggleAdSelection(index)}
                                        className={`group relative w-20 h-20 rounded-xl border-2 overflow-hidden transition-all ${adProductSelection[index] ? 'border-blue-500 ring-2 ring-blue-300 shadow-md' : 'border-gray-300 opacity-50 grayscale'}`}
                                        title={`Include Product ${index + 1}`}
                                    >
                                        <img src={`data:${img.mimeType};base64,${img.data}`} alt="" className="w-full h-full object-cover" />
                                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-[10px] text-white text-center py-1">Prod {index+1}</div>
                                    </button>
                                ))}

                                {generatedLifestyleImage && (
                                    <button 
                                        onClick={() => setUseLifestyleInAd(!useLifestyleInAd)}
                                        className={`group relative w-20 h-20 rounded-xl border-2 overflow-hidden transition-all ${useLifestyleInAd ? 'border-green-500 ring-2 ring-green-300 shadow-md' : 'border-gray-300 opacity-50 grayscale'}`}
                                        title="Include Generated Lifestyle Image"
                                    >
                                        <img src={`data:${generatedLifestyleImage.mimeType};base64,${generatedLifestyleImage.data}`} alt="" className="w-full h-full object-cover" />
                                        <div className="absolute bottom-0 left-0 right-0 bg-green-700/80 text-[10px] text-white text-center py-1">Lifestyle</div>
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                    
                    {/* Store Badges */}
                    <div className="p-3 bg-gray-100 rounded-lg border border-gray-200 space-y-3">
                        <div className="flex items-center gap-3">
                            <input type="checkbox" id="badge-google" checked={includeGooglePlay} onChange={(e) => setIncludeGooglePlay(e.target.checked)} className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                            <label htmlFor="badge-google" className="text-sm text-gray-700">Include <b>Google Play</b> badge</label>
                        </div>
                        <div className="flex items-center gap-3">
                            <input type="checkbox" id="badge-apple" checked={includeAppStore} onChange={(e) => setIncludeAppStore(e.target.checked)} className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                            <label htmlFor="badge-apple" className="text-sm text-gray-700">Include <b>App Store</b> badge</label>
                        </div>
                    </div>

                    {/* Aspect Ratio & Resolution */}
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <h4 className="text-sm font-bold text-gray-800">Aspect Ratio (Max 3)</h4>
                        <span className="text-xs text-gray-500">{selectedAspectRatios.length}/3 selected</span>
                      </div>
                      
                      {aspectRatioOptions.map(({ category, ratios }) => (
                        <div key={category}>
                          <h5 className="text-xs font-bold text-gray-400 uppercase mb-2">{category}</h5>
                          <div className="grid grid-cols-4 gap-2">
                            {ratios.map(ratio => {
                                const isSelected = selectedAspectRatios.includes(ratio);
                                const isDisabled = !isSelected && selectedAspectRatios.length >= 3;
                                return (
                                    <button
                                        key={ratio}
                                        onClick={() => !isDisabled && toggleAspectRatio(ratio)}
                                        disabled={isDisabled}
                                        className={`py-1.5 text-sm rounded border transition-all 
                                          ${isSelected ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold shadow-sm' : 'border-gray-300 text-gray-600'}
                                          ${isDisabled ? 'opacity-40 cursor-not-allowed bg-gray-50' : 'hover:border-gray-400'}
                                        `}
                                    >
                                        {ratio}
                                    </button>
                                );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex bg-gray-100 p-1 rounded-lg">
                        {['1K', '2K', '4K'].map((size) => (
                            <button key={size} onClick={() => setImageSize(size)} className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${imageSize === size ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>{size}</button>
                        ))}
                    </div>
                  </div>
                </div>

                {/* Generate Button */}
                <div className="mt-10 pt-6 border-t">
                  <button
                    onClick={handleSubmit}
                    disabled={!isFormValid || isGeneratingAds}
                    className="w-full flex items-center justify-center bg-gradient-to-r from-[#4285F4] to-[#34A853] text-white font-bold py-4 px-6 rounded-lg hover:from-[#3367D6] hover:to-[#2c9f67] disabled:bg-gray-300 disabled:cursor-not-allowed transition-all shadow-lg transform hover:scale-[1.02]"
                  >
                    {isGeneratingAds ? 'Blending...' : 'Blend me some ads!'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel: Results */}
          <div className="lg:col-span-3 lg:sticky top-28">
            <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-lg min-h-[70vh] flex flex-col justify-center items-center">
              
              {isGeneratingAds && <Loader message={loadingMessage} />}
              
              {!isGeneratingAds && generalError && (
                  <ErrorAlert message={generalError} onClose={() => setGeneralError(null)} />
              )}

              {/* Edit Mode UI */}
              {!isGeneratingAds && currentEditingAd && currentEditingImage && (
                  <div className="w-full">
                       <div className="flex justify-between items-center mb-4">
                          <h2 className="text-2xl font-bold text-gray-800">Edit Ad Option #{currentEditingAd.index + 1} ({currentEditingAd.aspectRatio})</h2>
                          <button onClick={handleCancelEdit} className="bg-gray-200 text-gray-800 font-semibold py-2 px-4 rounded-lg hover:bg-gray-300">&larr; Back</button>
                      </div>
                      <div className="relative mb-4 border rounded-lg overflow-hidden shadow-md bg-gray-50 flex justify-center bg-gray-100">
                          {/* We limit height in edit preview to avoid huge scrolling */}
                          <img src={currentEditingImage} alt="Editing" className="max-h-[60vh] w-auto object-contain" />
                          {currentEditingAd.status === 'loading' && (
                              <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center">
                                  <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
                              </div>
                          )}
                      </div>
                      
                      <div className="mb-3">
                        <FileInput 
                            key={editRefInputKey}
                            id="edit-ref-image" 
                            label="Reference Image (Optional)" 
                            onFileChange={setEditReferenceImage} 
                            note="Upload to swap logo/product or use as reference."
                            compact={false}
                        />
                      </div>

                      <textarea
                          value={editPrompt}
                          onChange={(e) => setEditPrompt(e.target.value)}
                          placeholder="Describe your edit. (E.g. Relayout the ad so the text doesn't cover the product, make the brand logo 20% bigger, etc)"
                          className="w-full p-3 border border-gray-300 rounded-lg mb-3 focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                          rows={2}
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <button onClick={onApplyEdit} disabled={!editPrompt.trim() || currentEditingAd.status === 'loading'} className="bg-yellow-400 text-yellow-900 font-bold py-3 rounded-lg hover:bg-yellow-500 disabled:bg-gray-200">Apply Edit</button>
                          <button onClick={() => undoEdit(currentEditingAd.index)} disabled={currentEditingAd.history.length <= 1} className="bg-gray-200 text-gray-700 font-bold py-3 rounded-lg hover:bg-gray-300 disabled:opacity-50">Undo</button>
                          <button onClick={() => revertToOriginal(currentEditingAd.index)} disabled={currentEditingAd.history.length <= 1} className="bg-gray-200 text-gray-700 font-bold py-3 rounded-lg hover:bg-gray-300 disabled:opacity-50">Revert Original</button>
                      </div>
                  </div>
              )}

              {/* Results Grid */}
              {!isGeneratingAds && editingIndex === null && generatedAds.length > 0 && (
                <ResultsDisplay 
                  ads={generatedAds} 
                  onRegenerate={handleRegenerateAd} 
                  onEdit={handleSelectAdForEdit} 
                />
              )}
              
              {!isGeneratingAds && editingIndex === null && generatedAds.length === 0 && !generalError && <OutputPlaceholder />}
            </div>
          </div>
        </div>
      </main>

      {/* Footer Disclaimer */}
      <footer className="bg-gray-100 border-t border-gray-200 py-6 mt-8">
        <div className="container mx-auto px-4 text-xs text-gray-500 text-justify leading-relaxed">
          Copyright Google LLC. Supported by Google LLC and/or its affiliate(s). This solution, including any related sample code or data, is made available on an “as is,” “as available,” and “with all faults” basis, solely for illustrative purposes, and without warranty or representation of any kind. This solution is experimental, unsupported and provided solely for your convenience. Your use of it is subject to your agreements with Google, as applicable, and may constitute a beta feature as defined under those agreements. To the extent that you make any data available to Google in connection with your use of the solution, you represent and warrant that you have all necessary and appropriate rights, consents and permissions to permit Google to use and process that data. By using any portion of this solution, you acknowledge, assume and accept all risks, known and unknown, associated with its usage and any processing of data by Google, including with respect to your deployment of any portion of this solution in your systems, or usage in connection with your business, if at all. In connection with this solution, you will not provide to Google any personally identifiable information, personal information or personal data.
        </div>
      </footer>
    </div>
  );
};

export default App;