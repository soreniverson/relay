// ============================================================================
// CHAT COMPONENTS - Index
// ============================================================================

export * from "./ConversationList";
export * from "./MessageThread";
export * from "./ChatInput";

// Combined styles for all chat components
import { conversationListStyles } from "./ConversationList";
import { messageThreadStyles } from "./MessageThread";
import { chatInputStyles } from "./ChatInput";

export const chatComponentStyles = `
  ${conversationListStyles}
  ${messageThreadStyles}
  ${chatInputStyles}
`;
