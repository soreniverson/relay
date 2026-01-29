// ============================================================================
// SHARED COMPONENTS - Index
// ============================================================================

export * from "./Button";
export * from "./Input";
export * from "./Textarea";
export * from "./Select";
export * from "./Checkbox";
export * from "./FileUpload";

// Combined styles for all shared components
import { buttonStyles } from "./Button";
import { inputStyles } from "./Input";
import { textareaStyles } from "./Textarea";
import { selectStyles } from "./Select";
import { checkboxStyles } from "./Checkbox";
import { fileUploadStyles } from "./FileUpload";

export const sharedComponentStyles = `
  ${buttonStyles}
  ${inputStyles}
  ${textareaStyles}
  ${selectStyles}
  ${checkboxStyles}
  ${fileUploadStyles}
`;
