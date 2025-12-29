
import React from 'react';
import { Card } from '../types';

interface CardItemProps {
  card: Card;
  isOpponent?: boolean;
  onClick?: () => void;
  showFront?: boolean;
  selected?: boolean;
  disabled?: boolean;
  label?: string;
  isLastAiReveal?: boolean;
}

const CardItem: React.FC<CardItemProps> = ({ 
  card, 
  isOpponent = false, 
  onClick, 
  showFront = false,
  selected = false,
  disabled = false,
  label,
  isLastAiReveal = false
}) => {
  const finalVal = card.baseValue + card.plusCount - card.minusCount;

  return (
    <div 
      className={`relative w-24 h-36 perspective-1000 transition-transform duration-300 ${disabled ? 'opacity-50 grayscale' : 'cursor-pointer hover:-translate-y-2'} ${selected ? 'ring-4 ring-yellow-400 rounded-xl' : ''}`}
      onClick={!disabled ? onClick : undefined}
    >
      {label && (
        <div className="absolute -top-6 left-0 right-0 text-center text-[10px] font-bold text-blue-400 whitespace-nowrap">
          {label}
        </div>
      )}
      
      {isLastAiReveal && (
        <div className="absolute -top-8 left-0 right-0 flex justify-center animate-bounce z-10">
          <div className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full shadow-lg font-bold border border-white">
            AI 查看了这张!
          </div>
        </div>
      )}

      <div className={`card-inner relative w-full h-full rounded-xl shadow-2xl ${showFront ? 'card-flipped' : ''} ${isLastAiReveal ? 'ring-4 ring-red-500 rounded-xl' : ''}`}>
        {/* Card Back (Default View for Opponent or Hidden Own) */}
        <div className="card-front bg-gradient-to-br from-indigo-800 to-slate-900 border-2 border-indigo-500 rounded-xl flex items-center justify-center">
          <div className="text-3xl font-bold text-indigo-300 opacity-30">?</div>
          {/* Token count visible on back if tokens are added */}
          {(card.plusCount > 0 || card.minusCount > 0) && (
             <div className="absolute bottom-2 left-0 right-0 flex justify-center space-x-1">
                {card.plusCount > 0 && <span className="text-[10px] bg-green-500/80 text-white px-1 rounded">+{card.plusCount}</span>}
                {card.minusCount > 0 && <span className="text-[10px] bg-red-500/80 text-white px-1 rounded">-{card.minusCount}</span>}
             </div>
          )}
        </div>
        
        {/* Card Front (Actual Value) */}
        <div className="card-back bg-slate-100 border-2 border-slate-300 rounded-xl flex flex-col items-center justify-between p-2">
          <div className="w-full flex justify-between items-start">
             <span className="text-xl font-black text-slate-800 leading-none">{card.baseValue}</span>
             <span className="text-xs text-slate-500">Val</span>
          </div>
          
          <div className="flex-1 flex items-center justify-center">
             <div className="text-4xl font-black text-slate-900">{card.baseValue}</div>
          </div>

          <div className="w-full flex flex-col items-center border-t border-slate-200 pt-1">
             <div className="flex space-x-1 mb-1">
                {card.plusCount > 0 && <span className="text-[10px] font-bold text-green-600">+{card.plusCount}</span>}
                {card.minusCount > 0 && <span className="text-[10px] font-bold text-red-600">-{card.minusCount}</span>}
             </div>
             <div className="text-sm font-bold text-indigo-600">Final: {finalVal}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CardItem;
