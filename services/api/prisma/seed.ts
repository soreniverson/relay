import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Clean up existing demo data first (for re-running seed)
  const demoProjectIds = [
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002',
  ];

  console.log('🧹 Cleaning up existing demo data...');

  // Delete in order of dependencies
  await prisma.message.deleteMany({
    where: { conversation: { projectId: { in: demoProjectIds } } },
  });
  await prisma.conversation.deleteMany({
    where: { projectId: { in: demoProjectIds } },
  });
  await prisma.surveyResponse.deleteMany({
    where: { survey: { projectId: { in: demoProjectIds } } },
  });
  await prisma.survey.deleteMany({
    where: { projectId: { in: demoProjectIds } },
  });
  await prisma.feedbackVote.deleteMany({
    where: { projectId: { in: demoProjectIds } },
  });
  await prisma.feedbackItem.deleteMany({
    where: { projectId: { in: demoProjectIds } },
  });
  await prisma.roadmapItem.deleteMany({
    where: { projectId: { in: demoProjectIds } },
  });
  await prisma.featureFlag.deleteMany({
    where: { projectId: { in: demoProjectIds } },
  });
  await prisma.privacyRule.deleteMany({
    where: { projectId: { in: demoProjectIds } },
  });
  await prisma.interactionLog.deleteMany({
    where: { interaction: { projectId: { in: demoProjectIds } } },
  });
  await prisma.interaction.deleteMany({
    where: { projectId: { in: demoProjectIds } },
  });
  await prisma.session.deleteMany({
    where: { projectId: { in: demoProjectIds } },
  });
  await prisma.endUser.deleteMany({
    where: { projectId: { in: demoProjectIds } },
  });
  await prisma.apiKey.deleteMany({
    where: { projectId: { in: demoProjectIds } },
  });
  await prisma.projectMembership.deleteMany({
    where: { projectId: { in: demoProjectIds } },
  });
  await prisma.project.deleteMany({
    where: { id: { in: demoProjectIds } },
  });
  await prisma.adminUser.deleteMany({
    where: { email: 'admin@relay.dev' },
  });

  console.log('✅ Cleanup complete');

  // Create admin user
  const adminUser = await prisma.adminUser.upsert({
    where: { email: 'admin@relay.dev' },
    update: {},
    create: {
      email: 'admin@relay.dev',
      name: 'Admin User',
      passwordHash: await bcrypt.hash('password123', 12),
    },
  });
  console.log('✅ Created admin user:', adminUser.email);

  // Create US-West project
  const usWestProject = await prisma.project.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Demo App (US)',
      region: 'us_west',
      settings: {
        privacyDefaults: {
          maskInputs: true,
          maskEmails: true,
          maskNumbers: false,
          customMaskSelectors: [],
          blockSelectors: [],
        },
        captureDefaults: {
          console: true,
          network: true,
          dom: true,
          replay: true,
        },
        widgetConfig: {
          position: 'bottom-right',
          showBugReport: true,
          showFeedback: true,
          showChat: true,
          showSurveys: true,
        },
      },
    },
  });
  console.log('✅ Created US-West project:', usWestProject.name);

  // Create EU-West project
  const euWestProject = await prisma.project.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      name: 'Demo App (EU)',
      region: 'eu_west',
      settings: {
        privacyDefaults: {
          maskInputs: true,
          maskEmails: true,
          maskNumbers: true,
          customMaskSelectors: ['.pii', '[data-sensitive]'],
          blockSelectors: [],
        },
        captureDefaults: {
          console: true,
          network: false,
          dom: true,
          replay: true,
        },
      },
    },
  });
  console.log('✅ Created EU-West project:', euWestProject.name);

  // Add admin to both projects
  await prisma.projectMembership.upsert({
    where: {
      userId_projectId: {
        userId: adminUser.id,
        projectId: usWestProject.id,
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      projectId: usWestProject.id,
      role: 'owner',
    },
  });

  await prisma.projectMembership.upsert({
    where: {
      userId_projectId: {
        userId: adminUser.id,
        projectId: euWestProject.id,
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      projectId: euWestProject.id,
      role: 'owner',
    },
  });
  console.log('✅ Added admin to both projects');

  // Create API keys with predictable values for testing
  // In production, these would be randomly generated
  const usApiKey = `rly_test_us_west_demo_key_12345678`;
  const euApiKey = `rly_test_eu_west_demo_key_12345678`;

  await prisma.apiKey.upsert({
    where: { id: '00000000-0000-0000-0000-000000000011' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000011',
      projectId: usWestProject.id,
      keyHash: await bcrypt.hash(usApiKey, 10),
      keyPrefix: usApiKey.substring(0, 12),
      name: 'Development',
      scopes: ['ingest', 'read', 'write'],
    },
  });

  await prisma.apiKey.upsert({
    where: { id: '00000000-0000-0000-0000-000000000012' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000012',
      projectId: euWestProject.id,
      keyHash: await bcrypt.hash(euApiKey, 10),
      keyPrefix: euApiKey.substring(0, 12),
      name: 'Development',
      scopes: ['ingest', 'read', 'write'],
    },
  });
  console.log('✅ Created API keys');
  console.log(`   US-West: ${usApiKey}`);
  console.log(`   EU-West: ${euApiKey}`);

  // Create demo end user
  const demoUser = await prisma.endUser.upsert({
    where: {
      projectId_externalUserId: {
        projectId: usWestProject.id,
        externalUserId: 'user_demo_123',
      },
    },
    update: {},
    create: {
      projectId: usWestProject.id,
      externalUserId: 'user_demo_123',
      email: 'jane@example.com',
      name: 'Jane Doe',
      traits: {
        plan: 'pro',
        company: 'Acme Inc',
      },
    },
  });

  // Create demo session
  const demoSession = await prisma.session.upsert({
    where: { id: '00000000-0000-0000-0000-000000000021' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000021',
      projectId: usWestProject.id,
      userId: demoUser.id,
      device: {
        type: 'desktop',
        os: 'macOS',
        osVersion: '14.2',
        browser: 'Chrome',
        browserVersion: '120',
        screenWidth: 1920,
        screenHeight: 1080,
        devicePixelRatio: 2,
        language: 'en-US',
        timezone: 'America/Los_Angeles',
      },
      appVersion: '1.0.0',
      environment: 'production',
      pageViews: 15,
      interactionCount: 3,
    },
  });
  console.log('✅ Created demo user and session');

  // Create demo bug report
  const bugInteraction = await prisma.interaction.create({
    data: {
      projectId: usWestProject.id,
      type: 'bug',
      source: 'widget',
      userId: demoUser.id,
      sessionId: demoSession.id,
      contentText: "Payment form crashes when I enter my card number. I've tried multiple cards but it keeps happening.",
      contentJson: {
        title: 'Payment form crash',
        description: "Payment form crashes when I enter my card number. I've tried multiple cards but it keeps happening.",
        steps: [
          'Go to checkout page',
          'Enter shipping details',
          'Click on payment form',
          'Start typing card number',
          'App freezes',
        ],
      },
      severity: 'high',
      tags: ['payment', 'checkout', 'critical-path'],
      technicalContext: {
        url: 'https://app.example.com/checkout',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        viewport: { width: 1920, height: 1080 },
        devicePixelRatio: 2,
        timestamp: Date.now(),
        timezone: 'America/Los_Angeles',
        locale: 'en-US',
      },
    },
  });

  // Create logs for the bug
  await prisma.interactionLog.create({
    data: {
      projectId: usWestProject.id,
      interactionId: bugInteraction.id,
      console: [
        { level: 'info', message: 'Checkout page loaded', timestamp: Date.now() - 5000 },
        { level: 'error', message: 'Uncaught TypeError: Cannot read property "validate" of undefined', timestamp: Date.now() - 1000, stack: 'at CardForm.validate (card-form.js:42)\n  at HTMLInputElement.<anonymous> (card-form.js:15)' },
      ],
      network: [
        { method: 'GET', url: 'https://api.example.com/checkout/config', status: 200, duration: 150, timestamp: Date.now() - 4000 },
        { method: 'POST', url: 'https://api.stripe.com/v1/payment_intents', status: 500, duration: 2500, timestamp: Date.now() - 1500, error: 'Internal Server Error' },
      ],
      errors: [
        { message: 'Cannot read property "validate" of undefined', type: 'TypeError', filename: 'card-form.js', lineno: 42, colno: 8, timestamp: Date.now() - 1000, count: 1 },
      ],
    },
  });
  console.log('✅ Created demo bug report with logs');

  // Create demo feedback
  await prisma.interaction.create({
    data: {
      projectId: usWestProject.id,
      type: 'feedback',
      source: 'widget',
      userId: demoUser.id,
      sessionId: demoSession.id,
      contentText: 'It would be great if you could add dark mode to the dashboard. My eyes hurt when working late at night.',
      contentJson: {
        title: 'Request: Dark mode for dashboard',
        category: 'feature-request',
      },
      tags: ['feature-request', 'ui', 'accessibility'],
    },
  });

  // Create more sample interactions for a populated inbox
  await prisma.interaction.createMany({
    data: [
      {
        projectId: usWestProject.id,
        sessionId: demoSession.id,
        type: 'bug',
        source: 'widget',
        status: 'triaging',
        severity: 'critical',
        contentText: 'All user data showing as blank after latest update',
        contentJson: {
          title: 'Data not loading after update',
          description: 'After the latest update, none of our team data is showing up. All dashboards are blank.',
        },
        tags: ['data', 'critical', 'regression'],
        createdAt: new Date(Date.now() - 900000),
      },
      {
        projectId: usWestProject.id,
        sessionId: demoSession.id,
        type: 'bug',
        source: 'widget',
        status: 'in_progress',
        severity: 'med',
        contentText: 'Login button sometimes unresponsive on mobile',
        contentJson: {
          title: 'Login button issue',
          description: 'On iPhone, the login button sometimes does not respond to taps. Have to tap multiple times.',
        },
        tags: ['mobile', 'auth'],
        createdAt: new Date(Date.now() - 86400000),
      },
      {
        projectId: usWestProject.id,
        sessionId: demoSession.id,
        type: 'chat',
        source: 'widget',
        status: 'new',
        contentText: 'How do I export my data?',
        contentJson: {
          title: 'Data export question',
          description: 'Hi, I need to export all my project data for a compliance audit. Where can I find the export feature?',
        },
        tags: ['support', 'export'],
        createdAt: new Date(Date.now() - 1800000),
      },
      {
        projectId: usWestProject.id,
        sessionId: demoSession.id,
        type: 'survey',
        source: 'widget',
        status: 'closed',
        contentText: 'NPS Response: 9',
        contentJson: {
          title: 'NPS Survey Response',
          score: 9,
          feedback: 'Great product overall. Would be perfect with better mobile support.',
        },
        tags: ['nps', 'promoter'],
        createdAt: new Date(Date.now() - 172800000),
      },
      {
        projectId: usWestProject.id,
        sessionId: demoSession.id,
        type: 'feedback',
        source: 'widget',
        status: 'resolved',
        contentText: 'The new dashboard design is much better!',
        contentJson: {
          title: 'Positive feedback on redesign',
          description: 'Just wanted to say the new dashboard looks amazing. Much cleaner and easier to navigate.',
        },
        tags: ['positive', 'ui', 'dashboard'],
        createdAt: new Date(Date.now() - 259200000),
      },
      {
        projectId: usWestProject.id,
        sessionId: demoSession.id,
        type: 'chat',
        source: 'widget',
        status: 'in_progress',
        contentText: 'Need help setting up SSO for our team',
        contentJson: {
          title: 'SSO Setup Assistance',
          description: 'We are trying to configure SAML SSO with Okta but getting an error. Can someone help?',
        },
        tags: ['sso', 'enterprise', 'okta'],
        createdAt: new Date(Date.now() - 5400000),
      },
    ],
  });
  console.log('✅ Created demo interactions (8 total)');

  // Create feedback items
  const feedbackItem1 = await prisma.feedbackItem.create({
    data: {
      projectId: usWestProject.id,
      title: 'Dark mode support',
      description: 'Add a dark mode theme option for users who prefer working in low-light environments.',
      status: 'planned',
      category: 'ui',
      voteCount: 47,
    },
  });

  const feedbackItem2 = await prisma.feedbackItem.create({
    data: {
      projectId: usWestProject.id,
      title: 'Export to PDF',
      description: 'Allow users to export reports and dashboards to PDF format.',
      status: 'under_review',
      category: 'feature',
      voteCount: 23,
    },
  });

  await prisma.feedbackItem.create({
    data: {
      projectId: usWestProject.id,
      title: 'Mobile app improvements',
      description: 'Better performance and offline support for the mobile app.',
      status: 'in_progress',
      category: 'mobile',
      voteCount: 89,
    },
  });
  console.log('✅ Created feedback items');

  // Create roadmap items
  await prisma.roadmapItem.create({
    data: {
      projectId: usWestProject.id,
      title: 'Dark Mode',
      description: 'Complete dark mode support across all dashboard views.',
      visibility: 'public',
      status: 'in_progress',
      sortOrder: 1,
      eta: new Date('2024-03-01'),
    },
  });

  await prisma.roadmapItem.create({
    data: {
      projectId: usWestProject.id,
      title: 'Mobile App v2.0',
      description: 'Major mobile app update with offline support and performance improvements.',
      visibility: 'public',
      status: 'planned',
      sortOrder: 2,
      eta: new Date('2024-04-15'),
    },
  });

  await prisma.roadmapItem.create({
    data: {
      projectId: usWestProject.id,
      title: 'API v2 (Internal)',
      description: 'Next generation API with improved performance and new endpoints.',
      visibility: 'private',
      status: 'planned',
      sortOrder: 3,
    },
  });
  console.log('✅ Created roadmap items');

  // Create NPS survey
  await prisma.survey.create({
    data: {
      projectId: usWestProject.id,
      name: 'Customer Satisfaction (NPS)',
      definition: {
        type: 'nps',
        title: 'How likely are you to recommend us?',
        description: 'Help us improve by sharing your feedback.',
        questions: [
          {
            id: 'nps_score',
            type: 'nps',
            required: true,
            text: 'On a scale of 0-10, how likely are you to recommend us to a friend or colleague?',
            min: 0,
            max: 10,
            minLabel: 'Not at all likely',
            maxLabel: 'Extremely likely',
          },
          {
            id: 'nps_reason',
            type: 'text',
            required: false,
            text: 'What is the primary reason for your score?',
            placeholder: 'Your feedback helps us improve...',
          },
        ],
        thankYouMessage: 'Thank you for your feedback!',
      },
      targeting: {
        showOnce: true,
        showAfterSeconds: 60,
        sampleRate: 0.2,
      },
      active: true,
      responseCount: 0,
    },
  });
  console.log('✅ Created NPS survey');

  // Create demo conversation
  const conversation = await prisma.conversation.create({
    data: {
      projectId: usWestProject.id,
      userId: demoUser.id,
      sessionId: demoSession.id,
      subject: 'Help with billing',
      status: 'open',
      messageCount: 2,
      lastMessageAt: new Date(),
    },
  });

  await prisma.message.createMany({
    data: [
      {
        projectId: usWestProject.id,
        conversationId: conversation.id,
        direction: 'inbound',
        body: 'Hi, I need help understanding my latest invoice. There seems to be an extra charge.',
        createdAt: new Date(Date.now() - 3600000),
      },
      {
        projectId: usWestProject.id,
        conversationId: conversation.id,
        direction: 'outbound',
        body: "Hello! I'd be happy to help you understand your invoice. Could you please share your account email or invoice number?",
        authorId: adminUser.id,
        createdAt: new Date(Date.now() - 1800000),
      },
    ],
  });
  console.log('✅ Created demo conversation');

  // Create privacy rules
  await prisma.privacyRule.createMany({
    data: [
      {
        projectId: usWestProject.id,
        name: 'Mask Credit Cards',
        enabled: true,
        rule: {
          type: 'mask',
          pattern: '\\d{4}[- ]?\\d{4}[- ]?\\d{4}[- ]?\\d{4}',
          scope: 'all',
        },
      },
      {
        projectId: usWestProject.id,
        name: 'Block Password Fields',
        enabled: true,
        rule: {
          type: 'block',
          selector: 'input[type="password"]',
          scope: 'replay',
        },
      },
    ],
  });
  console.log('✅ Created privacy rules');

  // Create feature flags
  await prisma.featureFlag.createMany({
    data: [
      { projectId: usWestProject.id, flag: 'integration_linear', enabled: true },
      { projectId: usWestProject.id, flag: 'integration_slack', enabled: true },
      { projectId: usWestProject.id, flag: 'integration_jira', enabled: false },
      { projectId: usWestProject.id, flag: 'integration_github', enabled: false },
      { projectId: usWestProject.id, flag: 'integration_email', enabled: false },
      { projectId: usWestProject.id, flag: 'ai_summaries', enabled: true },
      { projectId: usWestProject.id, flag: 'ai_labels', enabled: true },
      { projectId: usWestProject.id, flag: 'ai_dedupe', enabled: true },
    ],
  });
  console.log('✅ Created feature flags');

  console.log('\n🎉 Seeding complete!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Login with Magic Link:');
  console.log('  Email: admin@relay.dev');
  console.log('  (In dev mode, the magic link URL is logged to console)');
  console.log('');
  console.log('SDK API Keys (for testing):');
  console.log(`  US-West: ${usApiKey}`);
  console.log(`  EU-West: ${euApiKey}`);
  console.log('');
  console.log('Demo Projects:');
  console.log('  - Demo App (US) - with sample bugs, feedback, surveys');
  console.log('  - Demo App (EU) - GDPR-compliant settings');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
