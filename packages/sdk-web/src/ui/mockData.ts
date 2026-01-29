// ============================================================================
// MOCK DATA FOR TESTING
// Toggle USE_MOCK_DATA to switch between mock and real API
// ============================================================================

export const USE_MOCK_DATA = true;

// ============================================================================
// CHAT / MESSAGES
// ============================================================================

export interface MockConversation {
  id: string;
  subject: string;
  lastMessage: {
    body: string;
    direction: 'inbound' | 'outbound';
    createdAt: string;
  };
  unreadCount: number;
  createdAt: string;
}

export interface MockMessage {
  id: string;
  conversationId: string;
  body: string;
  direction: 'inbound' | 'outbound';
  createdAt: string;
}

export const MOCK_CONVERSATIONS: MockConversation[] = [
  {
    id: 'conv-1',
    subject: 'Login issue',
    lastMessage: {
      body: 'Thanks for reaching out! We\'re looking into this.',
      direction: 'outbound',
      createdAt: '2024-01-15T10:30:00Z',
    },
    unreadCount: 0,
    createdAt: '2024-01-15T10:00:00Z',
  },
  {
    id: 'conv-2',
    subject: 'How do I export data?',
    lastMessage: {
      body: 'How do I export my data to CSV?',
      direction: 'inbound',
      createdAt: '2024-01-14T15:20:00Z',
    },
    unreadCount: 1,
    createdAt: '2024-01-14T15:00:00Z',
  },
  {
    id: 'conv-3',
    subject: 'Feature suggestion',
    lastMessage: {
      body: 'That\'s a great idea! We\'ll add it to our roadmap.',
      direction: 'outbound',
      createdAt: '2024-01-10T09:00:00Z',
    },
    unreadCount: 0,
    createdAt: '2024-01-10T08:30:00Z',
  },
];

export const MOCK_MESSAGES: Record<string, MockMessage[]> = {
  'conv-1': [
    {
      id: 'msg-1',
      conversationId: 'conv-1',
      body: 'Hi, I\'m having trouble logging in. It keeps saying my password is incorrect.',
      direction: 'inbound',
      createdAt: '2024-01-15T10:00:00Z',
    },
    {
      id: 'msg-2',
      conversationId: 'conv-1',
      body: 'Hi! Sorry to hear you\'re having trouble. Can you try resetting your password using the "Forgot Password" link?',
      direction: 'outbound',
      createdAt: '2024-01-15T10:05:00Z',
    },
    {
      id: 'msg-3',
      conversationId: 'conv-1',
      body: 'I tried that but I\'m not receiving the reset email.',
      direction: 'inbound',
      createdAt: '2024-01-15T10:15:00Z',
    },
    {
      id: 'msg-4',
      conversationId: 'conv-1',
      body: 'Thanks for reaching out! We\'re looking into this.',
      direction: 'outbound',
      createdAt: '2024-01-15T10:30:00Z',
    },
  ],
  'conv-2': [
    {
      id: 'msg-5',
      conversationId: 'conv-2',
      body: 'How do I export my data to CSV?',
      direction: 'inbound',
      createdAt: '2024-01-14T15:00:00Z',
    },
  ],
  'conv-3': [
    {
      id: 'msg-6',
      conversationId: 'conv-3',
      body: 'It would be great if you could add dark mode to the dashboard.',
      direction: 'inbound',
      createdAt: '2024-01-10T08:30:00Z',
    },
    {
      id: 'msg-7',
      conversationId: 'conv-3',
      body: 'That\'s a great idea! We\'ll add it to our roadmap.',
      direction: 'outbound',
      createdAt: '2024-01-10T09:00:00Z',
    },
  ],
};

// ============================================================================
// ROADMAP
// ============================================================================

export type RoadmapStatus = 'planned' | 'in_progress' | 'shipped';

export interface MockRoadmapItem {
  id: string;
  title: string;
  description: string;
  status: RoadmapStatus;
  voteCount: number;
  hasVoted: boolean;
}

export const MOCK_ROADMAP: MockRoadmapItem[] = [
  {
    id: 'rm-1',
    title: 'Mobile SDK',
    description: 'Native iOS and Android SDK support for mobile applications',
    status: 'in_progress',
    voteCount: 23,
    hasVoted: false,
  },
  {
    id: 'rm-2',
    title: 'GitHub Integration',
    description: 'Automatically create GitHub issues from bug reports',
    status: 'planned',
    voteCount: 45,
    hasVoted: true,
  },
  {
    id: 'rm-3',
    title: 'Session Replay',
    description: 'Watch user sessions to understand context behind issues',
    status: 'shipped',
    voteCount: 67,
    hasVoted: false,
  },
  {
    id: 'rm-4',
    title: 'Slack Integration',
    description: 'Get notified about new feedback directly in Slack',
    status: 'shipped',
    voteCount: 34,
    hasVoted: true,
  },
  {
    id: 'rm-5',
    title: 'Custom Fields',
    description: 'Add custom fields to bug reports and feedback forms',
    status: 'planned',
    voteCount: 28,
    hasVoted: false,
  },
  {
    id: 'rm-6',
    title: 'AI-Powered Triage',
    description: 'Automatically categorize and prioritize incoming feedback',
    status: 'in_progress',
    voteCount: 52,
    hasVoted: false,
  },
  {
    id: 'rm-7',
    title: 'Dark Mode',
    description: 'Support for dark mode in the widget and dashboard',
    status: 'shipped',
    voteCount: 89,
    hasVoted: true,
  },
  {
    id: 'rm-8',
    title: 'API Webhooks',
    description: 'Trigger webhooks when feedback is submitted',
    status: 'planned',
    voteCount: 19,
    hasVoted: false,
  },
];

// ============================================================================
// HELPERS
// ============================================================================

export function getMockConversations(): MockConversation[] {
  return [...MOCK_CONVERSATIONS];
}

export function getMockMessages(conversationId: string): MockMessage[] {
  return MOCK_MESSAGES[conversationId] || [];
}

export function getMockRoadmap(): MockRoadmapItem[] {
  return [...MOCK_ROADMAP];
}

export function getMockRoadmapByStatus(status: RoadmapStatus): MockRoadmapItem[] {
  return MOCK_ROADMAP.filter(item => item.status === status);
}

// Simulated vote toggle (for local testing)
export function toggleMockVote(itemId: string): MockRoadmapItem | null {
  const item = MOCK_ROADMAP.find(i => i.id === itemId);
  if (item) {
    item.hasVoted = !item.hasVoted;
    item.voteCount += item.hasVoted ? 1 : -1;
    return { ...item };
  }
  return null;
}

// Simulated message send (for local testing)
let mockMessageCounter = 100;
export function addMockMessage(conversationId: string, body: string): MockMessage {
  const message: MockMessage = {
    id: `msg-${++mockMessageCounter}`,
    conversationId,
    body,
    direction: 'inbound',
    createdAt: new Date().toISOString(),
  };

  if (!MOCK_MESSAGES[conversationId]) {
    MOCK_MESSAGES[conversationId] = [];
  }
  MOCK_MESSAGES[conversationId].push(message);

  // Update conversation last message
  const conv = MOCK_CONVERSATIONS.find(c => c.id === conversationId);
  if (conv) {
    conv.lastMessage = {
      body,
      direction: 'inbound',
      createdAt: message.createdAt,
    };
  }

  return message;
}

// Simulated new conversation (for local testing)
let mockConvCounter = 10;
export function createMockConversation(subject: string, initialMessage: string): MockConversation {
  const now = new Date().toISOString();
  const convId = `conv-${++mockConvCounter}`;

  const conversation: MockConversation = {
    id: convId,
    subject,
    lastMessage: {
      body: initialMessage,
      direction: 'inbound',
      createdAt: now,
    },
    unreadCount: 0,
    createdAt: now,
  };

  MOCK_CONVERSATIONS.unshift(conversation);
  MOCK_MESSAGES[convId] = [{
    id: `msg-${++mockMessageCounter}`,
    conversationId: convId,
    body: initialMessage,
    direction: 'inbound',
    createdAt: now,
  }];

  return conversation;
}
