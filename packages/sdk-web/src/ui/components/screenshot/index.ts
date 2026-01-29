// ============================================================================
// SCREENSHOT COMPONENTS - Index
// ============================================================================

export * from './AnnotationToolbar';
export * from './AnnotationLayer';
export * from './ScreenshotEditor';

// Combined styles for all screenshot components
import { annotationToolbarStyles } from './AnnotationToolbar';
import { annotationLayerStyles } from './AnnotationLayer';
import { screenshotEditorStyles } from './ScreenshotEditor';

export const screenshotComponentStyles = `
  ${annotationToolbarStyles}
  ${annotationLayerStyles}
  ${screenshotEditorStyles}
`;
