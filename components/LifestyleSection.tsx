import React from 'react';
import type { ImageData } from '../types';

interface Props {
  productImages: (ImageData | null)[];
  lifestyleProductSelection: boolean[];
  toggleLifestyleSelection: (index: number) => void;
  lifestylePrompt: string;
  setLifestylePrompt: (prompt: string) => void;
  lifestyleError: string | null;
  handleGenerateLifestyle: () => void;
  isGeneratingLifestyle: boolean;
  generatedLifestyleImage: ImageData | null;
  downloadImage: (data: ImageData, name: string) => void;
}

const LifestyleSection: React.FC<Props> = ({
  productImages,
  lifestyleProductSelection,
  toggleLifestyleSelection,
  lifestylePrompt,
  setLifestylePrompt,
  lifestyleError,
  handleGenerateLifestyle,
  isGeneratingLifestyle,
  generatedLifestyleImage,
  downloadImage
}) => {
  if (!productImages.some(img => img !== null)) return null;

  return (
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
  );
};

export default LifestyleSection;
