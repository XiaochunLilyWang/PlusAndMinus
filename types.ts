
export enum GamePhase {
  SETUP = 'SETUP',
  TOKEN_PLACEMENT = 'TOKEN_PLACEMENT',
  REVEAL = 'REVEAL',
  BATTLE = 'BATTLE',
  ROUND_RESULT = 'ROUND_RESULT',
  FINAL_RESULT = 'FINAL_RESULT'
}

export interface Card {
  id: string;
  baseValue: number;
  tokens: number; // Sum of +1 and -1
  plusCount: number;
  minusCount: number;
  isUsed: boolean;
  isRevealedToOpponent: boolean;
  finalValue: number;
}

export interface Player {
  cards: Card[];
  score: number;
  winRawSum: number; // Sum of raw card points in winning rounds
}

export interface HistoryItem {
  round: number;
  userCardValue: number;
  userFinalValue: number;
  aiCardValue: number;
  aiFinalValue: number;
  winner: 'user' | 'ai' | 'tie';
}
