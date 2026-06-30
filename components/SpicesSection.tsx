import React from 'react';
import CopyInput from './CopyInput';
import type { AdCopy } from '../types';

interface Props {
  adCopy: AdCopy;
  handleCopyChange: (field: keyof AdCopy, value: string) => void;
  handleCopySuggestion: (field: keyof AdCopy) => void;
  isSuggestingCopy: { headline: boolean; description: boolean; cta: boolean; };
}

const SpicesSection: React.FC<Props> = ({ adCopy, handleCopyChange, handleCopySuggestion, isSuggestingCopy }) => {
  return (
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
  );
};

export default SpicesSection;
