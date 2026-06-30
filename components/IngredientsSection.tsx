import React from 'react';
import FileInput from './FileInput';
import type { ImageData } from '../types';

const ProductFileInput = React.memo(({ index, onFileChange }: { index: number; onFileChange: (index: number, data: ImageData | null) => void }) => {
    const handleChange = React.useCallback((data: ImageData | null) => onFileChange(index, data), [index, onFileChange]);
    return <FileInput id={`product-image-${index}`} label={`Img ${index + 1}`} onFileChange={handleChange} compact />;
});

interface Props {
  productImages: (ImageData | null)[];
  handleProductImageChange: (index: number, data: ImageData | null) => void;
  setStyleImage: (data: ImageData | null) => void;
  setLogoImage: (data: ImageData | null) => void;
  specialRequest: string;
  setSpecialRequest: (req: string) => void;
}

const IngredientsSection: React.FC<Props> = ({
  productImages,
  handleProductImageChange,
  setStyleImage,
  setLogoImage,
  specialRequest,
  setSpecialRequest
}) => {
  return (
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
    </div>
  );
};

export default IngredientsSection;
