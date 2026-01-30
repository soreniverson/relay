// ============================================================================
// SURVEY COMPONENT
// Renders survey questions with various question types
// ============================================================================

import { createElement, clearChildren } from "../../utils/dom";
import { createButton, setButtonLoading } from "../shared/Button";

// Survey types
export interface SurveyQuestion {
  id: string;
  type: "nps" | "rating" | "text" | "single_choice" | "multi_choice";
  required: boolean;
  text: string;
  placeholder?: string;
  options?: string[];
  min?: number;
  max?: number;
  minLabel?: string;
  maxLabel?: string;
}

export interface SurveyDefinition {
  type: "nps" | "csat" | "ces" | "custom";
  title: string;
  description?: string;
  questions: SurveyQuestion[];
  thankYouMessage?: string;
}

export interface SurveyConfig {
  surveyId: string;
  definition: SurveyDefinition;
  onSubmit: (responses: Record<string, unknown>) => Promise<void>;
  onDismiss: () => void;
}

export interface SurveyResult {
  element: HTMLDivElement;
  show: () => void;
  hide: () => void;
  destroy: () => void;
}

// Survey styles
export const surveyStyles = `
  .relay-survey-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 999999;
    display: none;
    align-items: center;
    justify-content: center;
    animation: relay-fade-in 0.2s ease;
  }

  .relay-survey-overlay--visible {
    display: flex;
  }

  .relay-survey {
    width: 100%;
    max-width: 480px;
    max-height: 90vh;
    background: hsl(var(--relay-bg));
    border-radius: 16px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
    overflow: hidden;
    animation: relay-slide-up 0.3s ease;
  }

  .relay-survey__header {
    padding: 20px 24px;
    border-bottom: 1px solid hsl(var(--relay-border));
  }

  .relay-survey__close {
    position: absolute;
    top: 16px;
    right: 16px;
    width: 32px;
    height: 32px;
    padding: 0;
    background: none;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    color: hsl(var(--relay-text-muted));
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
    font-family: inherit;
  }

  .relay-survey__close:hover {
    background: hsl(var(--relay-bg-secondary));
    color: hsl(var(--relay-text));
  }

  .relay-survey__close svg {
    width: 18px;
    height: 18px;
  }

  .relay-survey__title {
    font-size: 18px;
    font-weight: 600;
    color: hsl(var(--relay-text));
    margin: 0 0 4px;
    padding-right: 32px;
  }

  .relay-survey__description {
    font-size: 14px;
    color: hsl(var(--relay-text-muted));
    margin: 0;
  }

  .relay-survey__content {
    padding: 24px;
    overflow-y: auto;
    max-height: 400px;
  }

  .relay-survey__question {
    margin-bottom: 24px;
  }

  .relay-survey__question:last-child {
    margin-bottom: 0;
  }

  .relay-survey__question-text {
    font-size: 15px;
    font-weight: 500;
    color: hsl(var(--relay-text));
    margin: 0 0 12px;
  }

  .relay-survey__question-required {
    color: hsl(var(--relay-error));
    margin-left: 2px;
  }

  /* NPS Scale */
  .relay-survey__nps {
    display: flex;
    gap: 4px;
  }

  .relay-survey__nps-btn {
    flex: 1;
    padding: 12px 0;
    background: hsl(var(--relay-bg-secondary));
    border: 1px solid hsl(var(--relay-border));
    border-radius: 8px;
    font-family: inherit;
    font-size: 14px;
    font-weight: 500;
    color: hsl(var(--relay-text));
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .relay-survey__nps-btn:hover {
    background: hsl(var(--relay-bg-tertiary));
    border-color: hsl(var(--relay-border-hover));
  }

  .relay-survey__nps-btn--selected {
    background: hsl(var(--relay-primary));
    border-color: hsl(var(--relay-primary));
    color: white;
  }

  .relay-survey__nps-labels {
    display: flex;
    justify-content: space-between;
    margin-top: 8px;
  }

  .relay-survey__nps-label {
    font-size: 12px;
    color: hsl(var(--relay-text-muted));
  }

  /* Rating Stars */
  .relay-survey__rating {
    display: flex;
    gap: 8px;
  }

  .relay-survey__rating-star {
    padding: 8px;
    background: none;
    border: none;
    cursor: pointer;
    color: hsl(var(--relay-border));
    transition: all 0.15s ease;
  }

  .relay-survey__rating-star:hover,
  .relay-survey__rating-star--selected {
    color: #f59e0b;
    transform: scale(1.1);
  }

  .relay-survey__rating-star svg {
    width: 32px;
    height: 32px;
  }

  /* Text Input */
  .relay-survey__text {
    width: 100%;
    padding: 12px 14px;
    background: hsl(var(--relay-bg-secondary));
    border: 1px solid hsl(var(--relay-border));
    border-radius: 10px;
    font-family: inherit;
    font-size: 14px;
    color: hsl(var(--relay-text));
    resize: vertical;
    min-height: 100px;
    transition: all 0.15s ease;
  }

  .relay-survey__text:focus {
    outline: none;
    border-color: hsl(var(--relay-primary));
    box-shadow: 0 0 0 3px hsl(var(--relay-primary) / 0.1);
  }

  .relay-survey__text::placeholder {
    color: hsl(var(--relay-text-subtle));
  }

  /* Choice Options */
  .relay-survey__choices {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .relay-survey__choice {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    background: hsl(var(--relay-bg-secondary));
    border: 1px solid hsl(var(--relay-border));
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .relay-survey__choice:hover {
    border-color: hsl(var(--relay-border-hover));
  }

  .relay-survey__choice--selected {
    border-color: hsl(var(--relay-primary));
    background: hsl(var(--relay-primary) / 0.05);
  }

  .relay-survey__choice-indicator {
    width: 18px;
    height: 18px;
    border: 2px solid hsl(var(--relay-border));
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: all 0.15s ease;
  }

  .relay-survey__choice--multi .relay-survey__choice-indicator {
    border-radius: 4px;
  }

  .relay-survey__choice--selected .relay-survey__choice-indicator {
    border-color: hsl(var(--relay-primary));
    background: hsl(var(--relay-primary));
  }

  .relay-survey__choice--selected .relay-survey__choice-indicator::after {
    content: '';
    width: 8px;
    height: 8px;
    background: white;
    border-radius: 50%;
  }

  .relay-survey__choice--multi.relay-survey__choice--selected .relay-survey__choice-indicator::after {
    content: '\\2713';
    width: auto;
    height: auto;
    background: none;
    color: white;
    font-size: 12px;
    font-weight: bold;
    border-radius: 0;
  }

  .relay-survey__choice-text {
    font-size: 14px;
    color: hsl(var(--relay-text));
  }

  /* Footer */
  .relay-survey__footer {
    padding: 16px 24px 24px;
    display: flex;
    gap: 12px;
  }

  .relay-survey__footer > button {
    flex: 1;
  }

  /* Progress */
  .relay-survey__progress {
    display: flex;
    gap: 4px;
    padding: 0 24px 16px;
  }

  .relay-survey__progress-dot {
    flex: 1;
    height: 4px;
    background: hsl(var(--relay-border));
    border-radius: 2px;
    transition: all 0.2s ease;
  }

  .relay-survey__progress-dot--active {
    background: hsl(var(--relay-primary));
  }

  /* Thank You */
  .relay-survey__thanks {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 24px;
    text-align: center;
  }

  .relay-survey__thanks-icon {
    width: 56px;
    height: 56px;
    margin-bottom: 16px;
    color: hsl(var(--relay-success));
    background: hsl(var(--relay-success) / 0.1);
    border-radius: 50%;
    padding: 12px;
  }

  .relay-survey__thanks-icon svg {
    width: 100%;
    height: 100%;
  }

  .relay-survey__thanks h4 {
    font-size: 18px;
    font-weight: 600;
    color: hsl(var(--relay-text));
    margin: 0 0 6px;
  }

  .relay-survey__thanks p {
    font-size: 14px;
    color: hsl(var(--relay-text-muted));
    margin: 0;
  }

  @keyframes relay-fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`;

const CLOSE_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>`;
const STAR_ICON = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;
const CHECK_ICON = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`;

export function createSurvey(config: SurveyConfig): SurveyResult {
  const { surveyId, definition, onSubmit, onDismiss } = config;

  let currentQuestionIndex = 0;
  const responses: Record<string, unknown> = {};

  // Create overlay
  const overlay = createElement("div", {
    class: "relay-survey-overlay",
  }) as HTMLDivElement;

  // Create survey container
  const survey = createElement("div", {
    class: "relay-survey",
  });

  // Header
  const header = createElement("div", { class: "relay-survey__header" });
  header.style.position = "relative";

  const closeBtn = createElement("button", {
    type: "button",
    class: "relay-survey__close",
  });
  closeBtn.innerHTML = CLOSE_ICON;
  closeBtn.setAttribute("aria-label", "Close survey");
  closeBtn.addEventListener("click", () => {
    hide();
    onDismiss();
  });

  const title = createElement("h2", { class: "relay-survey__title" }, [
    definition.title,
  ]);

  header.appendChild(closeBtn);
  header.appendChild(title);

  if (definition.description) {
    const desc = createElement("p", { class: "relay-survey__description" }, [
      definition.description,
    ]);
    header.appendChild(desc);
  }

  // Content
  const content = createElement("div", { class: "relay-survey__content" });

  // Progress
  const progress = createElement("div", { class: "relay-survey__progress" });
  definition.questions.forEach((_, i) => {
    const dot = createElement("div", {
      class: `relay-survey__progress-dot ${i === 0 ? "relay-survey__progress-dot--active" : ""}`,
    });
    progress.appendChild(dot);
  });

  // Footer
  const footer = createElement("div", { class: "relay-survey__footer" });

  // Assemble
  survey.appendChild(header);
  if (definition.questions.length > 1) {
    survey.appendChild(progress);
  }
  survey.appendChild(content);
  survey.appendChild(footer);
  overlay.appendChild(survey);

  // Render current question
  const renderQuestion = () => {
    clearChildren(content);
    clearChildren(footer);

    const question = definition.questions[currentQuestionIndex];
    if (!question) return;

    const questionEl = createElement("div", {
      class: "relay-survey__question",
    });

    // Question text
    const textEl = createElement(
      "p",
      { class: "relay-survey__question-text" },
      [question.text],
    );
    if (question.required) {
      const requiredSpan = createElement(
        "span",
        { class: "relay-survey__question-required" },
        ["*"],
      );
      textEl.appendChild(requiredSpan);
    }
    questionEl.appendChild(textEl);

    // Render based on type
    switch (question.type) {
      case "nps":
        questionEl.appendChild(renderNPS(question));
        break;
      case "rating":
        questionEl.appendChild(renderRating(question));
        break;
      case "text":
        questionEl.appendChild(renderText(question));
        break;
      case "single_choice":
        questionEl.appendChild(renderChoices(question, false));
        break;
      case "multi_choice":
        questionEl.appendChild(renderChoices(question, true));
        break;
    }

    content.appendChild(questionEl);

    // Footer buttons
    if (currentQuestionIndex > 0) {
      const backBtn = createButton("Back", {
        type: "button",
        variant: "secondary",
      });
      backBtn.addEventListener("click", () => {
        currentQuestionIndex--;
        renderQuestion();
        updateProgress();
      });
      footer.appendChild(backBtn);
    }

    const isLast = currentQuestionIndex === definition.questions.length - 1;
    const nextBtn = createButton(isLast ? "Submit" : "Next", {
      type: "button",
      variant: "primary",
    });
    nextBtn.addEventListener("click", async () => {
      // Validate required
      if (question.required && responses[question.id] === undefined) {
        return;
      }

      if (isLast) {
        // Submit
        setButtonLoading(nextBtn, true, "Submitting...");
        try {
          await onSubmit(responses);
          showThankYou();
        } catch (error) {
          console.error("[Relay Survey] Submit failed:", error);
          setButtonLoading(nextBtn, false);
        }
      } else {
        currentQuestionIndex++;
        renderQuestion();
        updateProgress();
      }
    });
    footer.appendChild(nextBtn);
  };

  const updateProgress = () => {
    const dots = progress.querySelectorAll(".relay-survey__progress-dot");
    dots.forEach((dot, i) => {
      if (i <= currentQuestionIndex) {
        dot.classList.add("relay-survey__progress-dot--active");
      } else {
        dot.classList.remove("relay-survey__progress-dot--active");
      }
    });
  };

  const renderNPS = (question: SurveyQuestion): HTMLElement => {
    const container = createElement("div");

    const scale = createElement("div", { class: "relay-survey__nps" });
    const min = question.min ?? 0;
    const max = question.max ?? 10;

    for (let i = min; i <= max; i++) {
      const btn = createElement(
        "button",
        {
          type: "button",
          class: "relay-survey__nps-btn",
        },
        [String(i)],
      );

      if (responses[question.id] === i) {
        btn.classList.add("relay-survey__nps-btn--selected");
      }

      btn.addEventListener("click", () => {
        responses[question.id] = i;
        // Update selection
        scale.querySelectorAll(".relay-survey__nps-btn").forEach((b) => {
          b.classList.remove("relay-survey__nps-btn--selected");
        });
        btn.classList.add("relay-survey__nps-btn--selected");
      });

      scale.appendChild(btn);
    }

    container.appendChild(scale);

    // Labels
    if (question.minLabel || question.maxLabel) {
      const labels = createElement("div", {
        class: "relay-survey__nps-labels",
      });
      labels.appendChild(
        createElement("span", { class: "relay-survey__nps-label" }, [
          question.minLabel || "",
        ]),
      );
      labels.appendChild(
        createElement("span", { class: "relay-survey__nps-label" }, [
          question.maxLabel || "",
        ]),
      );
      container.appendChild(labels);
    }

    return container;
  };

  const renderRating = (question: SurveyQuestion): HTMLElement => {
    const container = createElement("div", { class: "relay-survey__rating" });
    const max = question.max ?? 5;

    for (let i = 1; i <= max; i++) {
      const btn = createElement("button", {
        type: "button",
        class: "relay-survey__rating-star",
      });
      btn.innerHTML = STAR_ICON;

      if (
        responses[question.id] !== undefined &&
        i <= (responses[question.id] as number)
      ) {
        btn.classList.add("relay-survey__rating-star--selected");
      }

      btn.addEventListener("click", () => {
        responses[question.id] = i;
        // Update selection
        container
          .querySelectorAll(".relay-survey__rating-star")
          .forEach((star, idx) => {
            if (idx < i) {
              star.classList.add("relay-survey__rating-star--selected");
            } else {
              star.classList.remove("relay-survey__rating-star--selected");
            }
          });
      });

      container.appendChild(btn);
    }

    return container;
  };

  const renderText = (question: SurveyQuestion): HTMLElement => {
    const textarea = createElement("textarea", {
      class: "relay-survey__text",
      placeholder: question.placeholder || "Your answer...",
    }) as HTMLTextAreaElement;

    if (responses[question.id]) {
      textarea.value = responses[question.id] as string;
    }

    textarea.addEventListener("input", () => {
      responses[question.id] = textarea.value;
    });

    return textarea;
  };

  const renderChoices = (
    question: SurveyQuestion,
    multi: boolean,
  ): HTMLElement => {
    const container = createElement("div", { class: "relay-survey__choices" });

    if (!question.options) return container;

    question.options.forEach((option, idx) => {
      const choice = createElement("div", {
        class: `relay-survey__choice ${multi ? "relay-survey__choice--multi" : ""}`,
      });

      const indicator = createElement("div", {
        class: "relay-survey__choice-indicator",
      });
      const text = createElement(
        "span",
        { class: "relay-survey__choice-text" },
        [option],
      );

      choice.appendChild(indicator);
      choice.appendChild(text);

      // Check if selected
      if (multi) {
        const selected = (responses[question.id] as string[]) || [];
        if (selected.includes(option)) {
          choice.classList.add("relay-survey__choice--selected");
        }
      } else {
        if (responses[question.id] === option) {
          choice.classList.add("relay-survey__choice--selected");
        }
      }

      choice.addEventListener("click", () => {
        if (multi) {
          const selected = ((responses[question.id] as string[]) || []).slice();
          const idx = selected.indexOf(option);
          if (idx >= 0) {
            selected.splice(idx, 1);
            choice.classList.remove("relay-survey__choice--selected");
          } else {
            selected.push(option);
            choice.classList.add("relay-survey__choice--selected");
          }
          responses[question.id] = selected;
        } else {
          responses[question.id] = option;
          container
            .querySelectorAll(".relay-survey__choice")
            .forEach((c) =>
              c.classList.remove("relay-survey__choice--selected"),
            );
          choice.classList.add("relay-survey__choice--selected");
        }
      });

      container.appendChild(choice);
    });

    return container;
  };

  const showThankYou = () => {
    clearChildren(content);
    clearChildren(footer);
    progress.style.display = "none";

    const thanks = createElement("div", { class: "relay-survey__thanks" });

    const icon = createElement("div", { class: "relay-survey__thanks-icon" });
    icon.innerHTML = CHECK_ICON;

    const title = createElement("h4", {}, ["Thank you!"]);
    const message = createElement("p", {}, [
      definition.thankYouMessage || "Your feedback has been submitted.",
    ]);

    thanks.appendChild(icon);
    thanks.appendChild(title);
    thanks.appendChild(message);
    content.appendChild(thanks);

    // Auto-close after 2 seconds
    setTimeout(() => {
      hide();
    }, 2000);
  };

  const show = () => {
    overlay.classList.add("relay-survey-overlay--visible");
    renderQuestion();
  };

  const hide = () => {
    overlay.classList.remove("relay-survey-overlay--visible");
  };

  const destroy = () => {
    overlay.remove();
  };

  return {
    element: overlay,
    show,
    hide,
    destroy,
  };
}
