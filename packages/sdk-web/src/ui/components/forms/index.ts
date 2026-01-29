// ============================================================================
// FORM COMPONENTS - Index
// ============================================================================

export * from "./BugReportForm";
export * from "./FeedbackForm";
export * from "./FeatureRequestForm";
export * from "./ChatForm";

// Combined styles for all form components
import { bugReportFormStyles } from "./BugReportForm";
import { feedbackFormStyles } from "./FeedbackForm";
import { featureRequestFormStyles } from "./FeatureRequestForm";
import { chatFormStyles } from "./ChatForm";

export const formComponentStyles = `
  ${bugReportFormStyles}
  ${feedbackFormStyles}
  ${featureRequestFormStyles}
  ${chatFormStyles}
`;
