import React from 'react';
import type { GeneratedAd } from '../types';

interface ResultsDisplayProps {
  ads: GeneratedAd[];
  onRegenerate: (index: number) => void;
  onEdit: (index: number) => void;
}

interface AdCardProps {
    ad: GeneratedAd;
    onRegenerate: (index: number) => void;
    onEdit: (index: number) => void;
    fullWidth?: boolean;
}

const AdCard: React.FC<AdCardProps> = React.memo(({ ad, onRegenerate, onEdit, fullWidth }) => {
  const { status, imageUrl, error, index, aspectRatio } = ad;
  const isLoading = status === 'loading';

  const downloadImage = () => {
    if (!imageUrl) return;
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `nano-banana-ad-option-${index + 1}-${aspectRatio.replace(':','-')}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const containerClasses = `group relative border border-gray-200 rounded-lg overflow-hidden shadow-lg transform transition-all duration-300 ease-in-out bg-white flex flex-col ${
    isLoading || status === 'error' ? (fullWidth ? 'min-h-[50vh]' : 'h-80') : 'h-auto'
  }`;

  return (
    <div className={containerClasses}>
      
      {/* Aspect Ratio Badge */}
      <div className="absolute top-2 left-2 bg-black/50 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded z-20">
        {aspectRatio}
      </div>

      {/* State: Loading */}
      {isLoading && (
        <div className="absolute inset-0 bg-gray-50 flex flex-col items-center justify-center z-10">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500 mb-3"></div>
            <p className="text-sm text-slate-600 font-semibold animate-pulse">Generating Option {index + 1}...</p>
        </div>
      )}

      {/* State: Error */}
      {status === 'error' && (
        <div className="absolute inset-0 bg-red-50 flex flex-col items-center justify-center p-6 text-center z-10">
           <svg className="w-10 h-10 text-red-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
           <p className="text-sm text-red-800 font-bold mb-1">Generation Failed</p>
           <p className="text-xs text-red-600 mb-4 line-clamp-3">{error}</p>
           <button 
             onClick={() => onRegenerate(index)}
             className="bg-white border border-red-200 text-red-600 px-4 py-2 rounded-full text-sm font-medium hover:bg-red-50 hover:border-red-300 transition"
           >
             Try Again
           </button>
        </div>
      )}

      {/* State: Success */}
      {status === 'success' && imageUrl && (
        <>
          <div className="relative w-full bg-gray-100 flex items-center justify-center min-h-[200px]">
             <img src={imageUrl} alt={`Generated Ad ${index + 1}`} className="w-full h-auto block" />
          </div>

          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-60 transition-all flex items-center justify-center space-x-2 px-2 opacity-0 group-hover:opacity-100">
            <button
              onClick={downloadImage}
              className="bg-[#4285F4] text-white font-semibold py-2 px-3 rounded-full flex items-center gap-2 text-xs transform translate-y-4 group-hover:translate-y-0 transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Download
            </button>
            <button
              onClick={() => onEdit(index)}
              className="bg-yellow-400 text-yellow-900 font-semibold py-2 px-3 rounded-full flex items-center gap-2 text-xs transform translate-y-4 group-hover:translate-y-0 transition-all hover:bg-yellow-500"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L15.232 5.232z" /></svg>
                Edit
            </button>
            <button
              onClick={() => onRegenerate(index)}
              className="bg-white text-gray-800 font-semibold py-2 px-3 rounded-full flex items-center gap-2 text-xs transform translate-y-4 group-hover:translate-y-0 transition-all hover:bg-gray-100"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M4 4l1.5 1.5A9 9 0 0120.5 10M20 20l-1.5-1.5A9 9 0 013.5 14" /></svg>
              Regenerate
            </button>
          </div>
        </>
      )}
    </div>
  );
});

const ResultsDisplay: React.FC<ResultsDisplayProps> = ({ ads, onRegenerate, onEdit }) => {
  const isSingle = ads.length === 1;

  return (
    <div className="w-full">
      <h2 className="text-3xl font-bold text-center mb-2 text-transparent bg-clip-text bg-gradient-to-r from-[#34A853] via-[#4285F4] to-[#EA4335]">
        {isSingle ? 'Your Ad is Ready!' : 'Your Ad Options Are Ready!'}
      </h2>
      <p className="text-center text-gray-600 mb-8">
        {isSingle 
            ? 'Here is your generated ad. Hover over the image to download, edit, or regenerate.' 
            : 'Here are distinct, high-resolution ad variations. Hover over an image to download, edit or regenerate.'}
      </p>
      <div className={isSingle ? "w-full flex justify-center" : "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 items-start"}>
        {ads.map((ad) => (
          <div key={ad.id} className={isSingle ? "w-full" : "w-full"}>
             <AdCard 
                ad={ad}
                onRegenerate={onRegenerate}
                onEdit={onEdit}
                fullWidth={isSingle}
             />
          </div>
        ))}
      </div>
    </div>
  );
};

export default React.memo(ResultsDisplay);