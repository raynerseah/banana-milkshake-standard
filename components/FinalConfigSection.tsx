import React from 'react';
import type { ImageData } from '../types';

interface Props {
  productImages: (ImageData | null)[];
  generatedLifestyleImage: ImageData | null;
  adProductSelection: boolean[];
  toggleAdSelection: (index: number) => void;
  useLifestyleInAd: boolean;
  setUseLifestyleInAd: (v: boolean) => void;
  includeGooglePlay: boolean;
  setIncludeGooglePlay: (v: boolean) => void;
  includeAppStore: boolean;
  setIncludeAppStore: (v: boolean) => void;
  aspectRatioOptions: { category: string; ratios: string[] }[];
  selectedAspectRatios: string[];
  toggleAspectRatio: (ratio: string) => void;
  imageSize: string;
  setImageSize: (size: string) => void;
}

const FinalConfigSection: React.FC<Props> = ({
  productImages,
  generatedLifestyleImage,
  adProductSelection,
  toggleAdSelection,
  useLifestyleInAd,
  setUseLifestyleInAd,
  includeGooglePlay,
  setIncludeGooglePlay,
  includeAppStore,
  setIncludeAppStore,
  aspectRatioOptions,
  selectedAspectRatios,
  toggleAspectRatio,
  imageSize,
  setImageSize
}) => {
  return (
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
  );
};

export default FinalConfigSection;
