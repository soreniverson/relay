// ============================================================================
// FEATURE REQUEST FORM COMPONENT
// Dedicated form for feature requests
// ============================================================================

import { createElement, clearChildren } from "../../utils/dom";
import { createInput, type InputResult } from "../shared/Input";
import { createTextarea, type TextareaResult } from "../shared/Textarea";
import { createSelect, type SelectResult } from "../shared/Select";
import { createButton, setButtonLoading } from "../shared/Button";
import { createFileUpload, type FileUploadResult } from "../shared/FileUpload";

export interface FeatureRequestFormData {
  title: string;
  description: string;
  category: string;
  attachments: File[];
}

export interface FeatureRequestFormConfig {
  showAttachments?: boolean;
  maxAttachments?: number;
  maxAttachmentSize?: number;
  onSubmit: (data: FeatureRequestFormData) => Promise<void>;
  onFormChange?: () => void;
}

export const featureRequestFormStyles = `
  .relay-feature-form {
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 20px;
  }

  .relay-feature-form__footer {
    padding-top: 4px;
  }

  .relay-feature-form__success {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 24px;
    text-align: center;
  }

  .relay-feature-form__success-icon {
    width: 56px;
    height: 56px;
    margin-bottom: 16px;
    color: hsl(var(--relay-success));
    background: hsl(var(--relay-success) / 0.1);
    border-radius: 50%;
    padding: 12px;
  }

  .relay-feature-form__success-icon svg {
    width: 100%;
    height: 100%;
  }

  .relay-feature-form__success h4 {
    font-size: 18px;
    font-weight: 600;
    color: hsl(var(--relay-text));
    margin: 0 0 6px;
    letter-spacing: -0.01em;
  }

  .relay-feature-form__success p {
    font-size: 14px;
    color: hsl(var(--relay-text-muted));
    margin: 0;
  }
`;

const CATEGORY_OPTIONS = [
  { value: "feature", label: "New Feature" },
  { value: "enhancement", label: "Enhancement" },
  { value: "integration", label: "Integration" },
];

export interface FeatureRequestFormResult {
  element: HTMLFormElement;
  reset: () => void;
  showSuccess: () => void;
}

export function createFeatureRequestForm(
  config: FeatureRequestFormConfig,
): FeatureRequestFormResult {
  const {
    showAttachments = true,
    maxAttachments = 5,
    maxAttachmentSize = 10 * 1024 * 1024,
    onSubmit,
    onFormChange,
  } = config;

  // Create form element
  const form = createElement("form", {
    class: "relay-feature-form",
  }) as HTMLFormElement;

  // Title input
  const titleInput = createInput("Title", {
    name: "title",
    placeholder: "What feature would you like?",
    required: true,
    autoFocus: true,
    onChange: onFormChange,
  });

  // Description textarea
  const descriptionTextarea = createTextarea("Description", {
    name: "description",
    placeholder: "Describe your idea in detail. What problem does it solve?",
    required: true,
    rows: 5,
    maxLength: 2000,
    onChange: onFormChange,
  });

  // Category select
  const categorySelect = createSelect("Category", {
    name: "category",
    options: CATEGORY_OPTIONS,
    value: "feature",
  });

  // File upload
  let fileUpload: FileUploadResult | null = null;
  if (showAttachments) {
    fileUpload = createFileUpload("Attachments (optional)", {
      multiple: true,
      maxFiles: maxAttachments,
      maxSize: maxAttachmentSize,
      accept: "image/*,.pdf,.doc,.docx",
    });
  }

  // Submit button
  const submitBtn = createButton("Submit Request", {
    type: "submit",
    variant: "primary",
    fullWidth: true,
  });

  const footer = createElement("div", { class: "relay-feature-form__footer" });
  footer.appendChild(submitBtn);

  // Assemble form
  form.appendChild(titleInput.container);
  form.appendChild(descriptionTextarea.container);
  form.appendChild(categorySelect.container);
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
    const formData: FeatureRequestFormData = {
      title: titleInput.getValue().trim(),
      description: descriptionTextarea.getValue().trim(),
      category: categorySelect.getValue() || "feature",
      attachments: fileUpload?.getFiles() || [],
    };

    // Show loading state
    setButtonLoading(submitBtn, true, "Submitting...");

    try {
      await onSubmit(formData);
    } catch (error) {
      setButtonLoading(submitBtn, false);
      console.error("[Relay] Feature request submission failed:", error);
    }
  });

  // Reset form
  const reset = () => {
    form.reset();
    titleInput.setValue("");
    titleInput.setError(null);
    descriptionTextarea.setValue("");
    descriptionTextarea.setError(null);
    categorySelect.setValue("feature");
    if (fileUpload) fileUpload.clearFiles();
    setButtonLoading(submitBtn, false);
  };

  // Show success state
  const showSuccess = () => {
    clearChildren(form);
    form.className = "";

    const successEl = createElement("div", {
      class: "relay-feature-form__success",
    });

    const icon = createElement("div", {
      class: "relay-feature-form__success-icon",
    });
    icon.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`;

    const title = createElement("h4", {}, ["Thank you!"]);
    const message = createElement("p", {}, [
      "Your feature request has been submitted.",
    ]);

    successEl.appendChild(icon);
    successEl.appendChild(title);
    successEl.appendChild(message);
    form.appendChild(successEl);
  };

  return {
    element: form,
    reset,
    showSuccess,
  };
}
