export interface ConversationState {
  type: 'reception' | 'wastage' | 'production' | 'report' | null;
  step: string;
  data: Record<string, any>;
}

// In-memory conversation state storage
const conversationStates = new Map<number, ConversationState>();

export function getState(chatId: number): ConversationState | undefined {
  return conversationStates.get(chatId);
}

export function setState(chatId: number, state: ConversationState): void {
  conversationStates.set(chatId, state);
}

export function clearState(chatId: number): void {
  conversationStates.delete(chatId);
}

