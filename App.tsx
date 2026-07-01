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

import IngredientsSection from './components/IngredientsSection';
import LifestyleSection from './components/LifestyleSection';
import SpicesSection from './components/SpicesSection';
import FinalConfigSection from './components/FinalConfigSection';

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
  const [imageModel, setImageModel] = useState<string>('gemini-3.1-flash-image');
  
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
        const result = await generateLifestyleImage(selectedImages, lifestylePrompt, '1:1', '2K', imageModel);
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
        includeAppStore,
        imageModel
    );
  }, [isFormValid, styleImage, generateAllAds, selectedProductAssets, selectedLifestyleAsset, logoImage, adCopy, specialRequest, selectedAspectRatios, imageSize, includeGooglePlay, includeAppStore, imageModel]);
  
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
        includeAppStore,
        imageModel
    );
  }, [styleImage, generatedAds, regenerateSingle, selectedProductAssets, selectedLifestyleAsset, logoImage, adCopy, specialRequest, imageSize, includeGooglePlay, includeAppStore, imageModel]);

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

      await applyEdit(editingIndex, editPrompt, editReferenceImage, currentAd.aspectRatio, imageSize, imageModel);
      setEditPrompt('');
      setEditReferenceImage(null);
      setEditRefInputKey(prev => prev + 1);
  }, [editingIndex, editPrompt, generatedAds, applyEdit, editReferenceImage, imageSize, imageModel]);

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
                  
                  <IngredientsSection 
                    productImages={productImages}
                    handleProductImageChange={handleProductImageChange}
                    setStyleImage={setStyleImage}
                    setLogoImage={setLogoImage}
                    specialRequest={specialRequest}
                    setSpecialRequest={setSpecialRequest}
                  />

                  <LifestyleSection 
                    productImages={productImages}
                    lifestyleProductSelection={lifestyleProductSelection}
                    toggleLifestyleSelection={toggleLifestyleSelection}
                    lifestylePrompt={lifestylePrompt}
                    setLifestylePrompt={setLifestylePrompt}
                    lifestyleError={lifestyleError}
                    handleGenerateLifestyle={handleGenerateLifestyle}
                    isGeneratingLifestyle={isGeneratingLifestyle}
                    generatedLifestyleImage={generatedLifestyleImage}
                    downloadImage={downloadImage}
                  />

                  <SpicesSection 
                    adCopy={adCopy}
                    handleCopyChange={handleCopyChange}
                    handleCopySuggestion={handleCopySuggestion}
                    isSuggestingCopy={isSuggestingCopy}
                  />

                  <FinalConfigSection 
                    productImages={productImages}
                    generatedLifestyleImage={generatedLifestyleImage}
                    adProductSelection={adProductSelection}
                    toggleAdSelection={toggleAdSelection}
                    useLifestyleInAd={useLifestyleInAd}
                    setUseLifestyleInAd={setUseLifestyleInAd}
                    includeGooglePlay={includeGooglePlay}
                    setIncludeGooglePlay={setIncludeGooglePlay}
                    includeAppStore={includeAppStore}
                    setIncludeAppStore={setIncludeAppStore}
                    aspectRatioOptions={aspectRatioOptions}
                    selectedAspectRatios={selectedAspectRatios}
                    toggleAspectRatio={toggleAspectRatio}
                    imageSize={imageSize}
                    setImageSize={setImageSize}
                    imageModel={imageModel}
                    setImageModel={setImageModel}
                  />
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