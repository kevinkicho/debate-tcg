import React from 'react';

const typeColors = {
  "Character Trait": "bg-blue-100 border-blue-500",
  "Ultimate Attack": "bg-red-200 border-red-700",
  "Resource Gen": "bg-yellow-100 border-yellow-500",
  "Action": "bg-green-100 border-green-500",
  "Trap Card": "bg-purple-100 border-purple-500",
  "Hazard": "bg-orange-100 border-orange-500"
};

const PoliticalCard = ({ card, stateCode, isShaking }) => {
  const colorClass = typeColors[card.type] || "bg-gray-100 border-gray-400";

  return (
    <div className={`relative w-64 h-96 border-4 rounded-xl shadow-2xl p-4 flex flex-col justify-between transition-transform 
      ${colorClass} ${isShaking ? 'animate-bounce' : 'hover:-translate-y-2'}`}>
      
      {/* Header */}
      <div className="flex justify-between items-start border-b border-black pb-1">
        <h3 className="font-bold text-lg leading-tight uppercase">{card.name}</h3>
        <span className="bg-black text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-xl">
          {card.cost}
        </span>
      </div>

      {/* Subtitle / Translation */}
      <div className="italic text-sm text-gray-700 mb-2">
        "{card.translation}" — {stateCode}
      </div>

      {/* Image Placeholder */}
      <div className="w-full h-32 bg-white border-2 border-gray-300 rounded flex items-center justify-center text-xs text-gray-400">
        [Illustration Area]
      </div>

      {/* Card Type Tag */}
      <div className="text-xs font-bold uppercase py-1 px-2 bg-white/50 inline-block rounded self-start mt-2">
        {card.type}
      </div>

      {/* Effect Text */}
      <div className="text-sm font-semibold bg-white p-2 rounded border border-gray-200 flex-grow mt-2 overflow-y-auto">
        {card.effect}
      </div>

      {/* Flavor Text & ELL Goal */}
      <div className="mt-2">
        <p className="text-[10px] italic leading-tight mb-1">"{card.flavorText}"</p>
        <div className="text-[9px] bg-black text-white p-1 rounded">
          <span className="font-bold uppercase">Learning Goal:</span> {card.learningGoal}
        </div>
      </div>
    </div>
  );
};

export default PoliticalCard;