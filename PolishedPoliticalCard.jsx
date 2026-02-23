import React from 'react';
import { CardTypeIcon } from './CardIcons';

const PolishedPoliticalCard = ({ card, stateCode, isPlayerTurn }) => {
  const isAffordable = true; // Logic to gray out card if cost > current capital

  return (
    <div className={`
      relative w-56 h-80 rounded-xl shadow-lg flex flex-col overflow-hidden border-2
      bg-white transition-all duration-300 transform
      ${isPlayerTurn ? 'hover:-translate-y-4 hover:shadow-2xl cursor-pointer' : 'opacity-90'}
      ${card.type === 'Ultimate Attack' ? 'border-red-600 bg-red-50' : 'border-slate-300'}
    `}>
      {/* Top Banner (Cost & Name) */}
      <div className="bg-slate-800 p-2 flex justify-between items-center text-white">
        <span className="text-xs font-bold truncate max-w-[140px]">{card.name}</span>
        <div className="flex items-center justify-center bg-yellow-500 text-slate-900 rounded-full w-7 h-7 font-black text-sm border-2 border-white shadow-sm">
          {card.cost}
        </div>
      </div>

      {/* Art / Icon Area */}
      <div className="h-28 bg-slate-100 flex items-center justify-center relative">
        <div className="text-slate-300">
           <CardTypeIcon type={card.type} className="w-16 h-16 opacity-20" />
        </div>
        <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-white/80 rounded text-[10px] font-bold text-slate-600 uppercase tracking-tighter border border-slate-200">
          {card.type}
        </div>
        <div className="absolute top-2 right-2 text-xs font-black text-slate-400">
          {stateCode}
        </div>
      </div>

      {/* Main Content */}
      <div className="p-3 flex-grow flex flex-col gap-2">
        <div className="text-[10px] italic font-medium text-blue-600 leading-tight">
          "{card.translation}"
        </div>
        
        <div className="text-xs font-bold text-slate-800 leading-snug border-l-2 border-slate-300 pl-2">
          {card.effect}
        </div>

        <div className="text-[9px] text-slate-500 italic mt-auto">
          {card.flavorText}
        </div>
      </div>

      {/* ELL Footer */}
      <div className="bg-slate-50 p-1.5 border-t border-slate-200">
         <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest text-center">
           Learning Goal
         </div>
         <div className="text-[9px] text-slate-700 text-center leading-tight">
           {card.learningGoal}
         </div>
      </div>
    </div>
  );
};

export default PolishedPoliticalCard;