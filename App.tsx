
import React, { useState, useEffect, useCallback } from 'react';
import { GamePhase, Card, Player, HistoryItem } from './types';
import CardItem from './components/CardItem';
import { getAIMove } from './geminiService';

const INITIAL_CARDS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

const App: React.FC = () => {
  const [phase, setPhase] = useState<GamePhase>(GamePhase.SETUP);
  const [round, setRound] = useState(1);
  const [user, setUser] = useState<Player>({ cards: [], score: 0, winRawSum: 0 });
  const [ai, setAi] = useState<Player>({ cards: [], score: 0, winRawSum: 0 });
  const [selectedTokens, setSelectedTokens] = useState<{ plus: string | null; minus: string | null }>({ plus: null, minus: null });
  const [userSelectedCardId, setUserSelectedCardId] = useState<string | null>(null);
  const [aiSelectedCardId, setAiSelectedCardId] = useState<string | null>(null);
  const [lastAiRevealId, setLastAiRevealId] = useState<string | null>(null);
  const [battleResult, setBattleResult] = useState<{ user: number; ai: number; winner: string } | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [log, setLog] = useState<string>("欢迎来到加减之间！请排列你的卡牌。");

  // Initial Setup
  useEffect(() => {
    const shuffle = <T,>(arr: T[]): T[] => [...arr].sort(() => Math.random() - 0.5);
    const aiValues = shuffle(INITIAL_CARDS);
    
    const userCards: Card[] = INITIAL_CARDS.map((v, i) => ({
      id: `user-${v}`,
      baseValue: v,
      tokens: 0,
      plusCount: 0,
      minusCount: 0,
      isUsed: false,
      isRevealedToOpponent: false,
      finalValue: v
    }));

    const aiCards: Card[] = aiValues.map((v, i) => ({
      id: `ai-${v}`,
      baseValue: v,
      tokens: 0,
      plusCount: 0,
      minusCount: 0,
      isUsed: false,
      isRevealedToOpponent: false,
      finalValue: v
    }));

    setUser(prev => ({ ...prev, cards: userCards }));
    setAi(prev => ({ ...prev, cards: aiCards }));
  }, []);

  const handleStartGame = () => {
    setPhase(GamePhase.TOKEN_PLACEMENT);
    setLog("第一轮：请在己方卡牌上放置一个+1和一个-1标志。");
  };

  const handleTokenSelect = (cardId: string, type: 'plus' | 'minus') => {
    const card = user.cards.find(c => c.id === cardId);
    if (!card || card.isUsed) return;

    if (type === 'minus') {
      const currentFinal = card.baseValue + card.plusCount - card.minusCount;
      if (currentFinal <= 0) {
        setLog("警告：标志物放置后数值不能小于0！");
        return;
      }
    }

    setSelectedTokens(prev => ({ ...prev, [type]: cardId }));
  };

  const confirmTokens = async () => {
    if (!selectedTokens.plus || !selectedTokens.minus) {
      setLog("请先放置完一个+1和一个-1。");
      return;
    }

    setIsProcessing(true);
    setLog("AI 正在思考并放置标志...");

    const newUserCards = user.cards.map(c => {
      let pc = c.plusCount;
      let mc = c.minusCount;
      if (c.id === selectedTokens.plus) pc++;
      if (c.id === selectedTokens.minus) mc++;
      return { ...c, plusCount: pc, minusCount: mc, finalValue: c.baseValue + pc - mc };
    });
    setUser(prev => ({ ...prev, cards: newUserCards }));

    const aiMove = await getAIMove('PLACEMENT', ai, user, round);
    const newAiCards = ai.cards.map(c => {
      let pc = c.plusCount;
      let mc = c.minusCount;
      if (c.id === aiMove.plusId) pc++;
      if (c.id === aiMove.minusId) mc++;
      return { ...c, plusCount: pc, minusCount: mc, finalValue: c.baseValue + pc - mc };
    });
    setAi(prev => ({ ...prev, cards: newAiCards }));

    setSelectedTokens({ plus: null, minus: null });
    setLastAiRevealId(null);
    
    // Logic: If all opponent's cards are revealed, skip reveal phase.
    const allAiRevealed = newAiCards.filter(c => !c.isUsed).every(c => c.isRevealedToOpponent);
    const allUserRevealed = newUserCards.filter(c => !c.isUsed).every(c => c.isRevealedToOpponent);

    if (allAiRevealed && allUserRevealed) {
      setPhase(GamePhase.BATTLE);
      setLog("双方卡牌已全部探知，跳过翻看环节。进入比拼阶段！");
    } else {
      setPhase(GamePhase.REVEAL);
      if (allAiRevealed) {
        setLog("对手所有剩余卡牌已探知，跳过你的翻看环节。等待 AI 翻看...");
        // Auto trigger AI reveal after a delay
        setTimeout(() => handleAiOnlyReveal(newUserCards, newAiCards), 1500);
      } else {
        setLog("翻看阶段：点击对手的一张牌查看其点数。");
      }
    }
    setIsProcessing(false);
  };

  const handleAiOnlyReveal = async (currentUserCards: Card[], currentAiCards: Card[]) => {
    setIsProcessing(true);
    const aiMove = await getAIMove('REVEAL', ai, user, round);
    const finalUserCards = currentUserCards.map(c => c.id === aiMove.revealId ? { ...c, isRevealedToOpponent: true } : c);
    setUser(prev => ({ ...prev, cards: finalUserCards }));
    setLastAiRevealId(aiMove.revealId);

    setTimeout(() => {
      setPhase(GamePhase.BATTLE);
      setLog("翻看环节结束。比拼阶段：秘密选择本轮要使用的卡牌。");
      setIsProcessing(false);
    }, 2000);
  };

  const handleReveal = async (cardId: string) => {
    if (phase !== GamePhase.REVEAL || isProcessing) return;
    const targetCard = ai.cards.find(c => c.id === cardId);
    if (!targetCard || targetCard.isRevealedToOpponent || targetCard.isUsed) return;
    
    setIsProcessing(true);
    setLog("你查看了这张卡牌。AI 正在挑选要查看的卡牌...");

    // Reveal for user
    const newAiCards = ai.cards.map(c => c.id === cardId ? { ...c, isRevealedToOpponent: true } : c);
    setAi(prev => ({ ...prev, cards: newAiCards }));

    // Check if AI still needs to reveal (if user has hidden cards)
    const hasHiddenUserCards = user.cards.filter(c => !c.isUsed).some(c => !c.isRevealedToOpponent);
    
    if (hasHiddenUserCards) {
      const aiMove = await getAIMove('REVEAL', ai, user, round);
      const newUserCards = user.cards.map(c => c.id === aiMove.revealId ? { ...c, isRevealedToOpponent: true } : c);
      setUser(prev => ({ ...prev, cards: newUserCards }));
      setLastAiRevealId(aiMove.revealId);
      
      setTimeout(() => {
        setPhase(GamePhase.BATTLE);
        setLog("比拼阶段：秘密选择本轮要使用的卡牌。");
        setIsProcessing(false);
      }, 2000);
    } else {
      setLog("你已全部被探知，AI 跳过本轮翻看。");
      setTimeout(() => {
        setPhase(GamePhase.BATTLE);
        setLog("比拼阶段：秘密选择本轮要使用的卡牌。");
        setIsProcessing(false);
      }, 1500);
    }
  };

  const handleSelectBattleCard = async (cardId: string) => {
    if (phase !== GamePhase.BATTLE || isProcessing) return;
    setUserSelectedCardId(cardId);
    
    setIsProcessing(true);
    setLog("AI 正在选择出牌...");

    const aiMove = await getAIMove('BATTLE', ai, user, round);
    setAiSelectedCardId(aiMove.playId);

    setTimeout(() => {
      processBattle(cardId, aiMove.playId);
    }, 1000);
  };

  const processBattle = (uId: string, aId: string) => {
    const uCard = user.cards.find(c => c.id === uId)!;
    const aCard = ai.cards.find(c => c.id === aId)!;

    const uFinal = uCard.finalValue;
    const aFinal = aCard.finalValue;

    let winner: 'user' | 'ai' | 'tie' = 'tie';
    if (uFinal > aFinal) winner = 'user';
    else if (aFinal > uFinal) winner = 'ai';

    setUser(prev => ({
      ...prev,
      score: winner === 'user' ? prev.score + 1 : prev.score,
      winRawSum: winner === 'user' ? prev.winRawSum + uCard.baseValue : prev.winRawSum,
      cards: prev.cards.map(c => c.id === uId ? { ...c, isUsed: true, isRevealedToOpponent: true } : c)
    }));

    setAi(prev => ({
      ...prev,
      score: winner === 'ai' ? prev.score + 1 : prev.score,
      winRawSum: winner === 'ai' ? prev.winRawSum + aCard.baseValue : prev.winRawSum,
      cards: prev.cards.map(c => c.id === aId ? { ...c, isUsed: true, isRevealedToOpponent: true } : c)
    }));

    setHistory(prev => [...prev, {
      round,
      userCardValue: uCard.baseValue,
      userFinalValue: uFinal,
      aiCardValue: aCard.baseValue,
      aiFinalValue: aFinal,
      winner
    }]);

    setBattleResult({ user: uFinal, ai: aFinal, winner });
    setPhase(GamePhase.ROUND_RESULT);
    setLog(`本轮结果：${winner === 'user' ? '你赢了！' : winner === 'ai' ? 'AI 赢了！' : '平局'}`);
    setIsProcessing(false);
  };

  const nextRound = () => {
    if (round === 9) {
      setPhase(GamePhase.FINAL_RESULT);
      determineWinner();
    } else {
      setRound(prev => prev + 1);
      setBattleResult(null);
      setUserSelectedCardId(null);
      setAiSelectedCardId(null);
      setLastAiRevealId(null);
      setPhase(GamePhase.TOKEN_PLACEMENT);
      setLog(`第 ${round + 1} 轮开始！请放置标志。`);
    }
  };

  const determineWinner = () => {
    let msg = "";
    if (user.score > ai.score) {
      msg = "恭喜！你获得了最终胜利！";
    } else if (ai.score > user.score) {
      msg = "遗憾，AI 获得了最终胜利。";
    } else {
      if (user.winRawSum < ai.winRawSum) {
        msg = "比分持平，根据胜场点数总和（更低者胜），你赢了！";
      } else if (ai.winRawSum < user.winRawSum) {
        msg = "比分持平，根据胜场点数总和（更低者胜），AI 赢了。";
      } else {
        msg = "不可思议，完全平局！";
      }
    }
    setLog(msg);
  };

  const resetGame = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex flex-col items-center p-4 md:p-8 space-y-8 overflow-x-hidden">
      {/* Header & Scoreboard */}
      <header className="w-full max-w-5xl flex flex-col md:flex-row justify-between items-center bg-slate-800/50 backdrop-blur rounded-2xl p-6 border border-slate-700 shadow-xl">
        <div className="flex flex-col mb-4 md:mb-0">
          <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400 tracking-tighter">
            加减之间 <span className="text-slate-500 font-light text-xl">/ Plus & Minus</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">{log}</p>
        </div>
        
        <div className="flex space-x-8 items-center">
          <div className="text-center">
            <div className="text-xs text-slate-400 uppercase tracking-widest mb-1">你</div>
            <div className="text-4xl font-bold text-blue-400">{user.score}</div>
            <div className="text-[10px] text-slate-500">点数和: {user.winRawSum}</div>
          </div>
          <div className="h-10 w-px bg-slate-700"></div>
          <div className="text-center">
            <div className="text-xs text-slate-400 uppercase tracking-widest mb-1">AI</div>
            <div className="text-4xl font-bold text-red-400">{ai.score}</div>
            <div className="text-[10px] text-slate-500">点数和: {ai.winRawSum}</div>
          </div>
          <div className="h-10 w-px bg-slate-700"></div>
          <div className="text-center">
            <div className="text-xs text-slate-400 uppercase tracking-widest mb-1">回合</div>
            <div className="text-4xl font-bold text-slate-200">{round}/9</div>
          </div>
        </div>
      </header>

      {/* Main Game Area */}
      <main className="w-full max-w-6xl flex flex-col space-y-12">
        
        {/* Opponent Area */}
        <section className="flex flex-col space-y-4">
          <div className="flex items-center space-x-2">
            <i className="fas fa-robot text-red-400"></i>
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">对手区域 (AI)</h2>
          </div>
          <div className="flex flex-wrap gap-4 justify-center md:justify-start">
            {ai.cards.map((card) => (
              <CardItem 
                key={card.id} 
                card={card} 
                isOpponent 
                showFront={card.isRevealedToOpponent || card.isUsed}
                disabled={card.isUsed || (phase === GamePhase.REVEAL && card.isRevealedToOpponent)}
                onClick={() => handleReveal(card.id)}
                label={card.isRevealedToOpponent ? "已探知" : undefined}
              />
            ))}
          </div>
        </section>

        {/* Interaction/Battle Overlay */}
        <section className="h-48 flex items-center justify-center relative bg-slate-900/40 rounded-3xl border border-slate-800/60 overflow-hidden">
          {phase === GamePhase.SETUP && (
            <button 
              onClick={handleStartGame}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 px-12 rounded-full transition-all shadow-lg hover:shadow-indigo-500/20 text-xl"
            >
              开始游戏
            </button>
          )}

          {phase === GamePhase.TOKEN_PLACEMENT && (
            <div className="flex flex-col items-center space-y-4 animate-in fade-in zoom-in duration-300">
               <div className="flex space-x-8">
                  <div className={`p-4 rounded-xl border-2 transition-all ${selectedTokens.plus ? 'bg-green-500/20 border-green-500' : 'bg-slate-800 border-slate-700 opacity-50'}`}>
                    <i className="fas fa-plus-circle text-2xl text-green-400 mb-2 block text-center"></i>
                    <span className="text-xs font-bold text-slate-300">已选择 +1</span>
                  </div>
                  <div className={`p-4 rounded-xl border-2 transition-all ${selectedTokens.minus ? 'bg-red-500/20 border-red-500' : 'bg-slate-800 border-slate-700 opacity-50'}`}>
                    <i className="fas fa-minus-circle text-2xl text-red-400 mb-2 block text-center"></i>
                    <span className="text-xs font-bold text-slate-300">已选择 -1</span>
                  </div>
               </div>
               <button 
                onClick={confirmTokens}
                disabled={isProcessing || !selectedTokens.plus || !selectedTokens.minus}
                className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white font-bold py-2 px-8 rounded-lg transition-all"
               >
                 {isProcessing ? <i className="fas fa-spinner fa-spin mr-2"></i> : null}
                 确认放置
               </button>
            </div>
          )}

          {phase === GamePhase.ROUND_RESULT && battleResult && (
            <div className="flex flex-col items-center space-y-4">
              <div className="flex items-center space-x-12 animate-in slide-in-from-bottom duration-500">
                <div className="text-center">
                   <div className="text-sm text-slate-400 mb-2">你的战力</div>
                   <div className="text-5xl font-black text-blue-400">{battleResult.user}</div>
                </div>
                <div className="text-4xl font-black text-slate-600">VS</div>
                <div className="text-center">
                   <div className="text-sm text-slate-400 mb-2">AI 战力</div>
                   <div className="text-5xl font-black text-red-400">{battleResult.ai}</div>
                </div>
              </div>
              <button 
                onClick={nextRound}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-10 rounded-lg transition-all"
              >
                {round === 9 ? "查看结算" : "下一轮"}
              </button>
            </div>
          )}

          {phase === GamePhase.FINAL_RESULT && (
             <div className="flex flex-col items-center space-y-4">
                <div className="text-4xl font-black text-indigo-400">游戏结束</div>
                <button 
                  onClick={resetGame}
                  className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-10 rounded-lg transition-all"
                >
                  重新开始
                </button>
             </div>
          )}

          {isProcessing && phase !== GamePhase.TOKEN_PLACEMENT && phase !== GamePhase.ROUND_RESULT && (
            <div className="flex flex-col items-center space-y-2">
               <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
               <span className="text-slate-400 text-xs animate-pulse">AI 正在思考...</span>
            </div>
          )}
        </section>

        {/* Player Area */}
        <section className="flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <i className="fas fa-user text-blue-400"></i>
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">你的区域</h2>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-4 justify-center md:justify-start">
            {user.cards.map((card) => {
              const isPlusSelected = selectedTokens.plus === card.id;
              const isMinusSelected = selectedTokens.minus === card.id;
              
              return (
                <div key={card.id} className="relative group">
                  <CardItem 
                    card={card} 
                    showFront 
                    disabled={card.isUsed || isProcessing}
                    selected={userSelectedCardId === card.id}
                    isLastAiReveal={lastAiRevealId === card.id}
                    onClick={() => {
                      if (phase === GamePhase.BATTLE) {
                        handleSelectBattleCard(card.id);
                      }
                    }}
                  />
                  {phase === GamePhase.TOKEN_PLACEMENT && !card.isUsed && (
                    <div className="absolute -bottom-10 left-0 right-0 flex justify-center space-x-2">
                       <button 
                        onClick={() => handleTokenSelect(card.id, 'plus')}
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isPlusSelected ? 'bg-green-500 text-white scale-110 shadow-