// ============================================================================
// BUG REPORT FORM COMPONENT
// Enhanced bug report form with severity, screenshot preview, and file attachments
// ============================================================================

import { createElement, clearChildren } from "../../utils/dom";
import { createInput, type InputResult } from "../shared/Input";
import { createTextarea, type TextareaResult } from "../shared/Textarea";
import { createSelect, type SelectResult } from "../shared/Select";
import { createCheckbox, type CheckboxResult } from "../shared/Checkbox";
import { createButton, setButtonLoading } from "../shared/Button";
import { createFileUpload, type FileUploadResult } from "../shared/FileUpload";

export interface BugReportFormData {
  title: string;
  description: string;
  severity: "low" | "med" | "high" | "critical";
  includeScreenshot: boolean;
  includeLogs: boolean;
  attachments: File[];
}

export interface BugReportFormConfig {
  showSeverity?: boolean;
  showScreenshot?: boolean;
  showLogs?: boolean;
  showAttachments?: boolean;
  defaultSeverity?: BugReportFormData["severity"];
  maxAttachments?: number;
  maxAttachmentSize?: number;
  onSubmit: (data: BugReportFormData) => Promise<void>;
  onScreenshotEdit?: () => void;
  onFormChange?: () => void;
}

export const bugReportFormStyles = `
  .relay-bug-form {
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 20px;
  }

  .relay-bug-form__row {
    display: flex;
    gap: 12px;
  }

  .relay-bug-form__row > * {
    flex: 1;
  }

  .relay-bug-form__screenshot {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .relay-bug-form__screenshot-label {
    font-size: 13px;
    font-weight: 500;
    color: hsl(var(--relay-text));
    letter-spacing: 0.01em;
  }

  .relay-bug-form__screenshot-preview {
    position: relative;
    width: 100%;
    max-height: 200px;
    background: hsl(var(--relay-bg-tertiary));
    border: 1px solid hsl(var(--relay-border));
    border-radius: 12px;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .relay-bug-form__screenshot-preview img {
    max-width: 100%;
    max-height: 200px;
    object-fit: contain;
  }

  .relay-bug-form__screenshot-actions {
    position: absolute;
    bottom: 10px;
    right: 10px;
    display: flex;
    gap: 6px;
    z-index: 1;
  }

  .relay-bug-form__screenshot-btn {
    padding: 6px 12px;
    font-family: inherit;
    font-size: 12px;
    font-weight: 500;
    background: hsl(var(--relay-bg));
    color: hsl(var(--relay-text));
    border: 1px solid hsl(var(--relay-border));
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s ease;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  }

  .relay-bug-form__screenshot-btn:hover {
    background: hsl(var(--relay-bg-secondary));
    border-color: hsl(var(--relay-border-hover));
  }

  .relay-bug-form__screenshot-btn:active {
    transform: scale(0.98);
  }

  .relay-bug-form__screenshot-btn--danger {
    color: hsl(var(--relay-error));
  }

  .relay-bug-form__screenshot-btn--danger:hover {
    background: hsl(var(--relay-error) / 0.08);
    border-color: hsl(var(--relay-error) / 0.3);
  }

  .relay-bug-form__options {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 14px 16px;
    background: hsl(var(--relay-bg-secondary));
    border: 1px solid hsl(var(--relay-border));
    border-radius: 12px;
  }

  .relay-bug-form__footer {
    padding-top: 4px;
  }

  .relay-bug-form__success {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 24px;
    text-align: center;
  }

  .relay-bug-form__success-icon {
    width: 56px;
    height: 56px;
    margin-bottom: 16px;
    color: hsl(var(--relay-success));
    background: hsl(var(--relay-success) / 0.1);
    border-radius: 50%;
    padding: 12px;
  }

  .relay-bug-form__success-icon svg {
    width: 100%;
    height: 100%;
  }

  .relay-bug-form__success h4 {
    font-size: 18px;
    font-weight: 600;
    color: hsl(var(--relay-text));
    margin: 0 0 6px;
    letter-spacing: -0.01em;
  }

  .relay-bug-form__success p {
    font-size: 14px;
    color: hsl(var(--relay-text-muted));
    margin: 0;
  }
`;

const SEVERITY_OPTIONS = [
  { value: "low", label: "Low - Minor issue" },
  { value: "med", label: "Medium - Affects workflow" },
  { value: "high", label: "High - Major impact" },
  { value: "critical", label: "Critical - Blocking" },
];

export interface BugReportFormResult {
  element: HTMLFormElement;
  setScreenshotPreview: (blob: Blob | null) => void;
  getScreenshotBlob: () => Blob | null;
  reset: () => void;
  showSuccess: () => void;
  setPrefillData: (data: { title?: string; description?: string }) => void;
}

export function createBugReportForm(
  config: BugReportFormConfig,
): BugReportFormResult {
  const {
    showSeverity = true,
    showScreenshot = true,
    showLogs = true,
    showAttachments = true,
    defaultSeverity = "med",
    maxAttachments = 5,
    maxAttachmentSize = 10 * 1024 * 1024,
    onSubmit,
    onScreenshotEdit,
    onFormChange,
  } = config;

  let screenshotBlob: Blob | null = null;

  // Create form element
  const form = createElement("form", {
    class: "relay-bug-form",
  }) as HTMLFormElement;

  // Title input
  const titleInput = createInput("Title", {
    name: "title",
    placeholder: "Brief summary of the issue",
    required: true,
    autoFocus: true,
    onChange: onFormChange,
  });

  // Description textarea
  const descriptionTextarea = createTextarea("Description", {
    name: "description",
    placeholder: "Describe what happened and how to reproduce it...",
    required: true,
    rows: 4,
    maxLength: 2000,
    onChange: onFormChange,
  });

  // Severity select
  let severitySelect: SelectResult | null = null;
  if (showSeverity) {
    severitySelect = createSelect("Severity", {
      name: "severity",
      options: SEVERITY_OPTIONS,
      value: defaultSeverity,
    });
  }

  // Screenshot preview container
  let screenshotContainer: HTMLDivElement | null = null;
  let screenshotPreviewEl: HTMLDivElement | null = null;
  let screenshotImg: HTMLImageElement | null = null;

  if (showScreenshot) {
    screenshotContainer = createElement("div", {
      class: "relay-bug-form__screenshot",
    });
    screenshotContainer.style.display = "none";

    const label = createElement(
      "span",
      { class: "relay-bug-form__screenshot-label" },
      ["Screenshot"],
    );

    screenshotPreviewEl = createElement("div", {
      class: "relay-bug-form__screenshot-preview",
    });
    screenshotImg = createElement("img", {
      alt: "Screenshot preview",
    }) as HTMLImageElement;
    screenshotPreviewEl.appendChild(screenshotImg);

    // Action buttons
    const actions = createElement("div", {
      class: "relay-bug-form__screenshot-actions",
    });

    if (onScreenshotEdit) {
      const editBtn = createElement(
        "button",
        {
          type: "button",
          class: "relay-bug-form__screenshot-btn",
        },
        ["Edit"],
      );
      editBtn.addEventListener("click", () => onScreenshotEdit());
      actions.appendChild(editBtn);
    }

    const removeBtn = createElement(
      "button",
      {
        type: "button",
        class:
          "relay-bug-form__screenshot-btn relay-bug-form__screenshot-btn--danger",
      },
      ["Remove"],
    );
    removeBtn.addEventListener("click", () => {
      setScreenshotPreview(null);
    });
    actions.appendChild(removeBtn);

    screenshotPreviewEl.appendChild(actions);
    screenshotContainer.appendChild(label);
    screenshotContainer.appendChild(screenshotPreviewEl);
  }

  // Options checkboxes
  const optionsContainer = createElement("div", {
    class: "relay-bug-form__options",
  });

  let screenshotCheckbox: CheckboxResult | null = null;
  if (showScreenshot) {
    screenshotCheckbox = createCheckbox("Include screenshot", {
      checked: true,
    });
    optionsContainer.appendChild(screenshotCheckbox.container);
  }

  let logsCheckbox: CheckboxResult | null = null;
  if (showLogs) {
    logsCheckbox = createCheckbox(
      "Include console logs",
      { checked: true },
      "Helps us debug the issue",
    );
    optionsContainer.appendChild(logsCheckbox.container);
  }

  // File upload
  let fileUpload: FileUploadResult | null = null;
  if (showAttachments) {
    fileUpload = createFileUpload("Attachments", {
      multiple: true,
      maxFiles: maxAttachments,
      maxSize: maxAttachmentSize,
      accept: "image/*,video/*,.pdf,.log,.txt",
    });
  }

  // Submit button
  const submitBtn = createButton("Submit Bug Report", {
    type: "submit",
    variant: "primary",
    fullWidth: true,
  });

  const footer = createElement("div", { class: "relay-bug-form__footer" });
  footer.appendChild(submitBtn);

  // Assemble form
  form.appendChild(titleInput.container);
  form.appendChild(descriptionTextarea.container);
  if (severitySelect) {
    form.appendChild(severitySelect.container);
  }
  if (screenshotContainer) {
    form.appendChild(screenshotContainer);
  }
  form.appendChild(optionsContainer);
  if (fileUpload) {
    form.appendChild(fileUpload.container);
  }
  form.appendChild(footer);

  // Form submission handler
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Validate
    if (!titleInput.getValue().trim()) {
      titleInput.setError("Title is required");
      return;
    }
    if (!descriptionTextarea.getValue().trim()) {
      descriptionTextarea.setError("Description is required");
      return;
    }

    // Clear errors
    titleInput.setError(null);
    descriptionTextarea.setError(null);

    // Collect form data
    const formData: BugReportFormData = {
      title: titleInput.getValue().trim(),
      description: descriptionTextarea.getValue().trim(),
      severity:
        (severitySelect?.getValue() as BugReportFormData["severity"]) || "med",
      includeScreenshot: screenshotCheckbox?.isChecked() ?? false,
      includeLogs: logsCheckbox?.isChecked() ?? false,
      attachments: fileUpload?.getFiles() || [],
    };

    // Show loading state
    setButtonLoading(submitBtn, true, "Submitting...");

    try {
      await onSubmit(formData);
    } catch (error) {
      setButtonLoading(submitBtn, false);
      console.error("[Relay] Bug report submission failed:", error);
    }
  });

  // Screenshot preview helper
  const setScreenshotPreview = (blob: Blob | null) => {
    screenshotBlob = blob;

    if (screenshotContainer && screenshotImg) {
      if (blob) {
        const url = URL.createObjectURL(blob);
        screenshotImg.onload = () => URL.revokeObjectURL(url);
        screenshotImg.src = url;
        screenshotContainer.style.display = "flex";
      } else {
        screenshotImg.src = "";
        screenshotContainer.style.display = "none";
      }
    }
  };

  // Reset form
  const reset = () => {
    form.reset();
    titleInput.setValue("");
    titleInput.setError(null);
    descriptionTextarea.setValue("");
    descriptionTextarea.setError(null);
    if (severitySelect) severitySelect.setValue(defaultSeverity);
    if (screenshotCheckbox) screenshotCheckbox.setChecked(true);
    if (logsCheckbox) logsCheckbox.setChecked(true);
    if (fileUpload) fileUpload.clearFiles();
    setScreenshotPreview(null);
    setButtonLoading(submitBtn, false);
  };

  // Show success state
  const showSuccess = () => {
    clearChildren(form);
    form.className = "";

    const successEl = createElement("div", {
      class: "relay-bug-form__success",
    });

    const icon = createElement("div", {
      class: "relay-bug-form__success-icon",
    });
    icon.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`;

    const title = createElement("h4", {}, ["Thank you!"]);
    const message = createElement("p", {}, [
      "Your bug report has been submitted.",
    ]);

    successEl.appendChild(icon);
    successEl.appendChild(title);
    successEl.appendChild(message);
    form.appendChild(successEl);
  };

  // Set prefill data
  const setPrefillData = (data: { title?: string; description?: string }) => {
    if (data.title) {
      titleInput.setValue(data.title);
    }
    if (data.description) {
      descriptionTextarea.setValue(data.description);
    }
  };

  return {
    element: form,
    setScreenshotPreview,
    getScreenshotBlob: () => screenshotBlob,
    reset,
    showSuccess,
    setPrefillData,
  };
}
