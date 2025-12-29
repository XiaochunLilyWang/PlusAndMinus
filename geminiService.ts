
import { GoogleGenAI, Type } from "@google/genai";
import { Card, Player } from "./types";

const aiClient = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function getAIMove(
  phase: 'PLACEMENT' | 'REVEAL' | 'BATTLE',
  aiPlayer: Player,
  userPlayer: Player,
  round: number
) {
  const model = 'gemini-3-flash-preview';
  
  const systemInstruction = `You are a strategic player in the card game 'Between Plus and Minus'.
  Rules: 1-9 cards, +1/-1 tokens. High final value wins. Tie-breaker: lower raw sum of winning cards wins.
  Current Round: ${round}.
  You must return a valid JSON move.`;

  const availableAICards = aiPlayer.cards.filter(c => !c.isUsed);
  const availableUserCards = userPlayer.cards.filter(c => !c.isUsed);

  let prompt = "";
  let responseSchema: any = {};

  if (phase === 'PLACEMENT') {
    prompt = `Decide where to put one +1 and one -1 token on your cards. 
    Constraint: Final value (base + tokens) must be >= 0.
    AI Cards: ${JSON.stringify(availableAICards.map(c => ({ id: c.id, val: c.baseValue, plus: c.plusCount, minus: c.minusCount })))}
    Output card IDs for the plus and minus tokens.`;
    
    responseSchema = {
      type: Type.OBJECT,
      properties: {
        plusId: { type: Type.STRING },
        minusId: { type: Type.STRING }
      },
      required: ["plusId", "minusId"]
    };
  } else if (phase === 'REVEAL') {
    prompt = `Decide which of the opponent's cards to reveal.
    Available Opponent Cards (Indices or IDs): ${JSON.stringify(availableUserCards.map(c => ({ id: c.id, revealed: c.isRevealedToOpponent })))}
    Choose an unrevealed card ID.`;
    
    responseSchema = {
      type: Type.OBJECT,
      properties: {
        revealId: { type: Type.STRING }
      },
      required: ["revealId"]
    };
  } else if (phase === 'BATTLE') {
    prompt = `Decide which card to play this round.
    AI Cards: ${JSON.stringify(availableAICards.map(c => ({ id: c.id, base: c.baseValue, final: c.baseValue + c.plusCount - c.minusCount })))}
    Opponent Cards (Some known): ${JSON.stringify(availableUserCards.map(c => ({ 
        id: c.id, 
        base: c.isRevealedToOpponent ? c.baseValue : 'unknown',
        tokens: c.plusCount - c.minusCount 
    })))}
    Choose the best card ID to win or bait.`;
    
    responseSchema = {
      type: Type.OBJECT,
      properties: {
        playId: { type: Type.STRING }
      },
      required: ["playId"]
    };
  }

  try {
    const response = await aiClient.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Gemini AI error:", error);
    // Fallback simple AI logic
    if (phase === 'PLACEMENT') return { plusId: availableAICards[0].id, minusId: availableAICards[0].id };
    if (phase === 'REVEAL') return { revealId: availableUserCards.find(c => !c.isRevealedToOpponent)?.id || availableUserCards[0].id };
    return { playId: availableAICards[0].id };
  }
}
