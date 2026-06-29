import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="bg-white/90 backdrop-blur-sm sticky top-0 z-30 border-b border-gray-200">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <div>
            <h1 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-yellow-500 to-orange-500">
            🍌 Banana Milkshake
            </h1>
            <p className="text-sm text-gray-500 mt-1">A <b>Nano Banana 2</b> powered app to help you create image ads in seconds!</p>
        </div>
      </div>
    </header>
  );
};

export default React.memo(Header);