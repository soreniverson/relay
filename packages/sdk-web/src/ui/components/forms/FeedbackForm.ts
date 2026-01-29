// ============================================================================
// FEEDBACK FORM COMPONENT
// Simple feedback form with optional rating
// ============================================================================

import { createElement, clearChildren } from "../../utils/dom";
import { createTextarea, type TextareaResult } from "../shared/Textarea";
import { createSelect, type SelectResult } from "../shared/Select";
import { createButton, setButtonLoading } from "../shared/Button";

export interface FeedbackFormData {
  text: string;
  category?: string;
  rating?: number;
}

export interface FeedbackFormConfig {
  showCategory?: boolean;
  showRating?: boolean;
  categories?: Array<{ value: string; label: string }>;
  onSubmit: (data: FeedbackFormData) => Promise<void>;
}

export const feedbackFormStyles = `
  .relay-feedback-form {
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 20px;
  }

  .relay-feedback-form__rating {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .relay-feedback-form__rating-label {
    font-size: 13px;
    font-weight: 500;
    color: hsl(var(--relay-text));
    letter-spacing: 0.01em;
  }

  .relay-feedback-form__rating-stars {
    display: flex;
    gap: 6px;
  }

  .relay-feedback-form__star {
    width: 36px;
    height: 36px;
    padding: 4px;
    background: none;
    border: none;
    cursor: pointer;
    color: hsl(var(--relay-border-hover));
    transition: all 0.15s ease;
    border-radius: 6px;
  }

  .relay-feedback-form__star:hover {
    transform: scale(1.1);
    background: hsl(var(--relay-bg-secondary));
  }

  .relay-feedback-form__star:active {
    transform: scale(0.95);
  }

  .relay-feedback-form__star--active {
    color: #f59e0b;
  }

  .relay-feedback-form__star svg {
    width: 100%;
    height: 100%;
  }

  .relay-feedback-form__footer {
    padding-top: 4px;
  }

  .relay-feedback-form__success {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 24px;
    text-align: center;
  }

  .relay-feedback-form__success-icon {
    width: 56px;
    height: 56px;
    margin-bottom: 16px;
    color: hsl(var(--relay-success));
    background: hsl(var(--relay-success) / 0.1);
    border-radius: 50%;
    padding: 12px;
  }

  .relay-feedback-form__success-icon svg {
    width: 100%;
    height: 100%;
  }

  .relay-feedback-form__success h4 {
    font-size: 18px;
    font-weight: 600;
    color: hsl(var(--relay-text));
    margin: 0 0 6px;
    letter-spacing: -0.01em;
  }

  .relay-feedback-form__success p {
    font-size: 14px;
    color: hsl(var(--relay-text-muted));
    margin: 0;
  }
`;

const DEFAULT_CATEGORIES = [
  { value: "general", label: "General feedback" },
  { value: "feature", label: "Feature request" },
  { value: "improvement", label: "Improvement suggestion" },
  { value: "other", label: "Other" },
];

const STAR_EMPTY = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;
const STAR_FILLED = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;

export interface FeedbackFormResult {
  element: HTMLFormElement;
  reset: () => void;
  showSuccess: () => void;
}

export function createFeedbackForm(
  config: FeedbackFormConfig,
): FeedbackFormResult {
  const {
    showCategory = false,
    showRating = true,
    categories = DEFAULT_CATEGORIES,
    onSubmit,
  } = config;

  let currentRating = 0;
  const starButtons: HTMLButtonElement[] = [];

  // Create form element
  const form = createElement("form", {
    class: "relay-feedback-form",
  }) as HTMLFormElement;

  // Category select
  let categorySelect: SelectResult | null = null;
  if (showCategory) {
    categorySelect = createSelect("Category", {
      name: "category",
      options: categories,
      placeholder: "Select a category",
    });
  }

  // Rating stars
  let ratingContainer: HTMLDivElement | null = null;
  if (showRating) {
    ratingContainer = createElement("div", {
      class: "relay-feedback-form__rating",
    });

    const ratingLabel = createElement(
      "span",
      { class: "relay-feedback-form__rating-label" },
      ["How would you rate your experience?"],
    );

    const starsContainer = createElement("div", {
      class: "relay-feedback-form__rating-stars",
    });

    const updateStars = (rating: number, isHover = false) => {
      starButtons.forEach((btn, i) => {
        const isActive = i < rating;
        btn.classList.toggle("relay-feedback-form__star--active", isActive);
        btn.innerHTML = isActive ? STAR_FILLED : STAR_EMPTY;
      });
    };

    for (let i = 1; i <= 5; i++) {
      const starBtn = createElement("button", {
        type: "button",
        class: "relay-feedback-form__star",
      }) as HTMLButtonElement;
      starBtn.innerHTML = STAR_EMPTY;
      starBtn.setAttribute("aria-label", `Rate ${i} star${i > 1 ? "s" : ""}`);

      starBtn.addEventListener("click", () => {
        currentRating = i;
        updateStars(currentRating);
      });

      starBtn.addEventListener("mouseenter", () => {
        updateStars(i, true);
      });

      starBtn.addEventListener("mouseleave", () => {
        updateStars(currentRating);
      });

      starButtons.push(starBtn);
      starsContainer.appendChild(starBtn);
    }

    ratingContainer.appendChild(ratingLabel);
    ratingContainer.appendChild(starsContainer);
  }

  // Feedback textarea
  const feedbackTextarea = createTextarea("Your Feedback", {
    name: "feedback",
    placeholder: "Share your thoughts, ideas, or suggestions...",
    required: true,
    rows: 5,
    maxLength: 2000,
    autoFocus: true,
  });

  // Submit button
  const submitBtn = createButton("Send Feedback", {
    type: "submit",
    variant: "primary",
    fullWidth: true,
  });

  const footer = createElement("div", { class: "relay-feedback-form__footer" });
  footer.appendChild(submitBtn);

  // Assemble form
  if (categorySelect) {
    form.appendChild(categorySelect.container);
  }
  if (ratingContainer) {
    form.appendChild(ratingContainer);
  }
  form.appendChild(feedbackTextarea.container);
  form.appendChild(footer);

  // Form submission handler
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Validate
    if (!feedbackTextarea.getValue().trim()) {
      feedbackTextarea.setError("Please enter your feedback");
      return;
    }

    // Clear errors
    feedbackTextarea.setError(null);

    // Collect form data
    const formData: FeedbackFormData = {
      text: feedbackTextarea.getValue().trim(),
      category: categorySelect?.getValue() || undefined,
      rating: currentRating > 0 ? currentRating : undefined,
    };

    // Show loading state
    setButtonLoading(submitBtn, true, "Sending...");

    try {
      await onSubmit(formData);
    } catch (error) {
      setButtonLoading(submitBtn, false);
      console.error("[Relay] Feedback submission failed:", error);
    }
  });

  // Reset form
  const reset = () => {
    form.reset();
    feedbackTextarea.setValue("");
    feedbackTextarea.setError(null);
    if (categorySelect) categorySelect.setValue("");
    currentRating = 0;
    starButtons.forEach((btn) => {
      btn.classList.remove("relay-feedback-form__star--active");
      btn.innerHTML = STAR_EMPTY;
    });
    setButtonLoading(submitBtn, false);
  };

  // Show success state
  const showSuccess = () => {
    clearChildren(form);
    form.className = "";

    const successEl = createElement("div", {
      class: "relay-feedback-form__success",
    });

    const icon = createElement("div", {
      class: "relay-feedback-form__success-icon",
    });
    icon.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`;

    const title = createElement("h4", {}, ["Thank you!"]);
    const message = createElement("p", {}, [
      "Your feedback has been received.",
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
