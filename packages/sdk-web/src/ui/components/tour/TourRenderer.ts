// ============================================================================
// TOUR RENDERER COMPONENT
// Renders product tours with tooltips, modals, highlights, and beacons
// ============================================================================

interface TourStep {
  id: string;
  type: "tooltip" | "modal" | "highlight" | "beacon";
  target?: string;
  title?: string;
  content: string;
  image?: string;
  video?: string;
  position?: "top" | "bottom" | "left" | "right" | "auto";
  primaryButton?: {
    label: string;
    action: "next" | "complete" | "url";
    url?: string;
  };
  secondaryButton?: {
    label: string;
    action: "skip" | "back" | "dismiss";
  };
  advanceOn?: "click" | "input" | "custom";
  advanceSelector?: string;
}

interface Tour {
  id: string;
  name: string;
  steps: TourStep[];
  dismissible: boolean;
  currentStep: number;
}

interface TourRendererCallbacks {
  onStart: (tourId: string) => Promise<void>;
  onProgress: (tourId: string, step: number) => Promise<void>;
  onComplete: (tourId: string) => Promise<void>;
  onDismiss: (tourId: string) => Promise<void>;
}

// Styles for tour elements
const tourStyles = `
  .relay-tour-overlay {
    position: fixed;
    inset: 0;
    z-index: 999998;
    pointer-events: none;
  }

  .relay-tour-spotlight {
    position: fixed;
    z-index: 999997;
    box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5);
    border-radius: 4px;
    transition: all 0.3s ease;
    pointer-events: none;
  }

  .relay-tour-tooltip {
    position: fixed;
    z-index: 999999;
    width: 320px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    animation: relay-tour-fade-in 0.2s ease;
    pointer-events: auto;
  }

  .relay-tour-tooltip--dark {
    background: #1a1a1a;
    color: white;
  }

  @keyframes relay-tour-fade-in {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .relay-tour-tooltip__arrow {
    position: absolute;
    width: 12px;
    height: 12px;
    background: white;
    transform: rotate(45deg);
  }

  .relay-tour-tooltip--dark .relay-tour-tooltip__arrow {
    background: #1a1a1a;
  }

  .relay-tour-tooltip__arrow--top {
    bottom: -6px;
    left: 50%;
    margin-left: -6px;
  }

  .relay-tour-tooltip__arrow--bottom {
    top: -6px;
    left: 50%;
    margin-left: -6px;
  }

  .relay-tour-tooltip__arrow--left {
    right: -6px;
    top: 50%;
    margin-top: -6px;
  }

  .relay-tour-tooltip__arrow--right {
    left: -6px;
    top: 50%;
    margin-top: -6px;
  }

  .relay-tour-tooltip__content {
    padding: 16px;
  }

  .relay-tour-tooltip__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 8px;
  }

  .relay-tour-tooltip__title {
    font-size: 15px;
    font-weight: 600;
    color: #111827;
    margin: 0;
  }

  .relay-tour-tooltip--dark .relay-tour-tooltip__title {
    color: white;
  }

  .relay-tour-tooltip__close {
    width: 24px;
    height: 24px;
    padding: 0;
    background: none;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    color: #9ca3af;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .relay-tour-tooltip__close:hover {
    background: rgba(0, 0, 0, 0.05);
    color: #6b7280;
  }

  .relay-tour-tooltip--dark .relay-tour-tooltip__close:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #9ca3af;
  }

  .relay-tour-tooltip__body {
    font-size: 14px;
    line-height: 1.5;
    color: #4b5563;
  }

  .relay-tour-tooltip--dark .relay-tour-tooltip__body {
    color: #9ca3af;
  }

  .relay-tour-tooltip__media {
    margin: 12px 0;
    border-radius: 8px;
    overflow: hidden;
  }

  .relay-tour-tooltip__media img,
  .relay-tour-tooltip__media video {
    width: 100%;
    display: block;
  }

  .relay-tour-tooltip__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-top: 1px solid #f3f4f6;
    gap: 8px;
  }

  .relay-tour-tooltip--dark .relay-tour-tooltip__footer {
    border-top-color: #333;
  }

  .relay-tour-tooltip__progress {
    font-size: 12px;
    color: #9ca3af;
  }

  .relay-tour-tooltip__buttons {
    display: flex;
    gap: 8px;
  }

  .relay-tour-btn {
    padding: 8px 14px;
    font-family: inherit;
    font-size: 13px;
    font-weight: 500;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .relay-tour-btn--primary {
    background: #3b82f6;
    border: none;
    color: white;
  }

  .relay-tour-btn--primary:hover {
    background: #2563eb;
  }

  .relay-tour-btn--secondary {
    background: #f3f4f6;
    border: none;
    color: #374151;
  }

  .relay-tour-tooltip--dark .relay-tour-btn--secondary {
    background: #333;
    color: #d1d5db;
  }

  .relay-tour-btn--secondary:hover {
    background: #e5e7eb;
  }

  .relay-tour-tooltip--dark .relay-tour-btn--secondary:hover {
    background: #444;
  }

  .relay-tour-modal {
    position: fixed;
    inset: 0;
    z-index: 999999;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.5);
    animation: relay-tour-fade-in 0.2s ease;
  }

  .relay-tour-modal__content {
    width: 100%;
    max-width: 480px;
    max-height: 90vh;
    background: white;
    border-radius: 16px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
    overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .relay-tour-beacon {
    position: fixed;
    z-index: 999999;
    width: 24px;
    height: 24px;
    cursor: pointer;
  }

  .relay-tour-beacon__dot {
    position: absolute;
    inset: 0;
    background: #3b82f6;
    border-radius: 50%;
    animation: relay-tour-beacon-pulse 2s ease infinite;
  }

  @keyframes relay-tour-beacon-pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.5); opacity: 0.5; }
  }

  .relay-tour-beacon__ring {
    position: absolute;
    inset: -8px;
    border: 2px solid #3b82f6;
    border-radius: 50%;
    opacity: 0.5;
    animation: relay-tour-beacon-ring 2s ease infinite;
  }

  @keyframes relay-tour-beacon-ring {
    0%, 100% { transform: scale(1); opacity: 0.5; }
    50% { transform: scale(1.3); opacity: 0; }
  }
`;

export class TourRenderer {
  private currentTour: Tour | null = null;
  private currentStepIndex = 0;
  private container: HTMLElement | null = null;
  private styleElement: HTMLStyleElement | null = null;
  private callbacks: TourRendererCallbacks;
  private advanceListener: EventListener | null = null;
  private advanceListenerTarget: Element | null = null;
  private advanceListenerType: string | null = null;

  constructor(callbacks: TourRendererCallbacks) {
    this.callbacks = callbacks;
  }

  private injectStyles(): void {
    if (this.styleElement) return;

    this.styleElement = document.createElement("style");
    this.styleElement.textContent = tourStyles;
    document.head.appendChild(this.styleElement);
  }

  async startTour(tour: Tour): Promise<void> {
    this.injectStyles();
    this.currentTour = tour;
    this.currentStepIndex = tour.currentStep || 0;

    await this.callbacks.onStart(tour.id);
    this.renderStep();
  }

  private renderStep(): void {
    if (!this.currentTour) return;

    // Clean up previous step
    this.cleanup();

    const step = this.currentTour.steps[this.currentStepIndex];
    if (!step) {
      this.completeTour();
      return;
    }

    // Create container
    this.container = document.createElement("div");
    this.container.className = "relay-tour-container";
    document.body.appendChild(this.container);

    switch (step.type) {
      case "tooltip":
      case "highlight":
        this.renderTooltip(step);
        break;
      case "modal":
        this.renderModal(step);
        break;
      case "beacon":
        this.renderBeacon(step);
        break;
    }

    // Set up advance listeners if configured
    if (step.advanceOn && step.advanceSelector) {
      this.setupAdvanceListener(step);
    }
  }

  private renderTooltip(step: TourStep): void {
    if (!this.container) return;

    // Find target element
    let targetRect: DOMRect | null = null;
    if (step.target) {
      const targetEl = document.querySelector(step.target);
      if (targetEl) {
        targetRect = targetEl.getBoundingClientRect();

        // Create spotlight
        if (step.type === "highlight") {
          const spotlight = document.createElement("div");
          spotlight.className = "relay-tour-spotlight";
          spotlight.style.cssText = `
            left: ${targetRect.left - 4}px;
            top: ${targetRect.top - 4}px;
            width: ${targetRect.width + 8}px;
            height: ${targetRect.height + 8}px;
          `;
          this.container.appendChild(spotlight);
        }
      }
    }

    // Create tooltip
    const tooltip = document.createElement("div");
    tooltip.className = "relay-tour-tooltip";

    // Position tooltip
    const position = this.calculatePosition(targetRect, step.position);
    tooltip.style.cssText = `
      left: ${position.left}px;
      top: ${position.top}px;
    `;

    // Arrow
    if (targetRect) {
      const arrow = document.createElement("div");
      arrow.className = `relay-tour-tooltip__arrow relay-tour-tooltip__arrow--${position.arrowPosition}`;
      tooltip.appendChild(arrow);
    }

    // Content
    const content = document.createElement("div");
    content.className = "relay-tour-tooltip__content";

    // Header
    const header = document.createElement("div");
    header.className = "relay-tour-tooltip__header";

    if (step.title) {
      const title = document.createElement("h4");
      title.className = "relay-tour-tooltip__title";
      title.textContent = step.title;
      header.appendChild(title);
    }

    if (this.currentTour?.dismissible) {
      const closeBtn = document.createElement("button");
      closeBtn.className = "relay-tour-tooltip__close";
      closeBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>`;
      closeBtn.onclick = () => this.dismissTour();
      header.appendChild(closeBtn);
    }

    content.appendChild(header);

    // Body
    const body = document.createElement("div");
    body.className = "relay-tour-tooltip__body";
    body.textContent = step.content;
    content.appendChild(body);

    // Media
    if (step.image || step.video) {
      const media = document.createElement("div");
      media.className = "relay-tour-tooltip__media";
      if (step.video) {
        const video = document.createElement("video");
        video.src = step.video;
        video.controls = true;
        video.autoplay = true;
        video.muted = true;
        media.appendChild(video);
      } else if (step.image) {
        const img = document.createElement("img");
        img.src = step.image;
        img.alt = step.title || "";
        media.appendChild(img);
      }
      content.appendChild(media);
    }

    tooltip.appendChild(content);

    // Footer
    const footer = document.createElement("div");
    footer.className = "relay-tour-tooltip__footer";

    const progress = document.createElement("span");
    progress.className = "relay-tour-tooltip__progress";
    progress.textContent = `${this.currentStepIndex + 1} of ${this.currentTour!.steps.length}`;
    footer.appendChild(progress);

    const buttons = document.createElement("div");
    buttons.className = "relay-tour-tooltip__buttons";

    if (step.secondaryButton) {
      const secondaryBtn = document.createElement("button");
      secondaryBtn.className = "relay-tour-btn relay-tour-btn--secondary";
      secondaryBtn.textContent = step.secondaryButton.label;
      secondaryBtn.onclick = () => this.handleSecondaryAction(step.secondaryButton!.action);
      buttons.appendChild(secondaryBtn);
    } else if (this.currentStepIndex > 0) {
      const backBtn = document.createElement("button");
      backBtn.className = "relay-tour-btn relay-tour-btn--secondary";
      backBtn.textContent = "Back";
      backBtn.onclick = () => this.previousStep();
      buttons.appendChild(backBtn);
    }

    if (step.primaryButton) {
      const primaryBtn = document.createElement("button");
      primaryBtn.className = "relay-tour-btn relay-tour-btn--primary";
      primaryBtn.textContent = step.primaryButton.label;
      primaryBtn.onclick = () => this.handlePrimaryAction(step.primaryButton!);
      buttons.appendChild(primaryBtn);
    } else {
      const nextBtn = document.createElement("button");
      nextBtn.className = "relay-tour-btn relay-tour-btn--primary";
      nextBtn.textContent =
        this.currentStepIndex === this.currentTour!.steps.length - 1
          ? "Done"
          : "Next";
      nextBtn.onclick = () => this.nextStep();
      buttons.appendChild(nextBtn);
    }

    footer.appendChild(buttons);
    tooltip.appendChild(footer);

    this.container.appendChild(tooltip);
  }

  private renderModal(step: TourStep): void {
    if (!this.container) return;

    const modal = document.createElement("div");
    modal.className = "relay-tour-modal";

    const content = document.createElement("div");
    content.className = "relay-tour-modal__content";

    // Use same content structure as tooltip
    const inner = document.createElement("div");
    inner.className = "relay-tour-tooltip__content";

    // Header
    const header = document.createElement("div");
    header.className = "relay-tour-tooltip__header";

    if (step.title) {
      const title = document.createElement("h4");
      title.className = "relay-tour-tooltip__title";
      title.textContent = step.title;
      header.appendChild(title);
    }

    if (this.currentTour?.dismissible) {
      const closeBtn = document.createElement("button");
      closeBtn.className = "relay-tour-tooltip__close";
      closeBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>`;
      closeBtn.onclick = () => this.dismissTour();
      header.appendChild(closeBtn);
    }

    inner.appendChild(header);

    // Body
    const body = document.createElement("div");
    body.className = "relay-tour-tooltip__body";
    body.textContent = step.content;
    inner.appendChild(body);

    // Media
    if (step.image || step.video) {
      const media = document.createElement("div");
      media.className = "relay-tour-tooltip__media";
      if (step.video) {
        const video = document.createElement("video");
        video.src = step.video;
        video.controls = true;
        video.autoplay = true;
        video.muted = true;
        media.appendChild(video);
      } else if (step.image) {
        const img = document.createElement("img");
        img.src = step.image;
        img.alt = step.title || "";
        media.appendChild(img);
      }
      inner.appendChild(media);
    }

    content.appendChild(inner);

    // Footer
    const footer = document.createElement("div");
    footer.className = "relay-tour-tooltip__footer";

    const progress = document.createElement("span");
    progress.className = "relay-tour-tooltip__progress";
    progress.textContent = `${this.currentStepIndex + 1} of ${this.currentTour!.steps.length}`;
    footer.appendChild(progress);

    const buttons = document.createElement("div");
    buttons.className = "relay-tour-tooltip__buttons";

    if (step.secondaryButton) {
      const secondaryBtn = document.createElement("button");
      secondaryBtn.className = "relay-tour-btn relay-tour-btn--secondary";
      secondaryBtn.textContent = step.secondaryButton.label;
      secondaryBtn.onclick = () => this.handleSecondaryAction(step.secondaryButton!.action);
      buttons.appendChild(secondaryBtn);
    } else if (this.currentStepIndex > 0) {
      const backBtn = document.createElement("button");
      backBtn.className = "relay-tour-btn relay-tour-btn--secondary";
      backBtn.textContent = "Back";
      backBtn.onclick = () => this.previousStep();
      buttons.appendChild(backBtn);
    }

    if (step.primaryButton) {
      const primaryBtn = document.createElement("button");
      primaryBtn.className = "relay-tour-btn relay-tour-btn--primary";
      primaryBtn.textContent = step.primaryButton.label;
      primaryBtn.onclick = () => this.handlePrimaryAction(step.primaryButton!);
      buttons.appendChild(primaryBtn);
    } else {
      const nextBtn = document.createElement("button");
      nextBtn.className = "relay-tour-btn relay-tour-btn--primary";
      nextBtn.textContent =
        this.currentStepIndex === this.currentTour!.steps.length - 1
          ? "Done"
          : "Next";
      nextBtn.onclick = () => this.nextStep();
      buttons.appendChild(nextBtn);
    }

    footer.appendChild(buttons);
    content.appendChild(footer);

    modal.appendChild(content);

    // Close on backdrop click if dismissible
    if (this.currentTour?.dismissible) {
      modal.onclick = (e) => {
        if (e.target === modal) {
          this.dismissTour();
        }
      };
    }

    this.container.appendChild(modal);
  }

  private renderBeacon(step: TourStep): void {
    if (!this.container || !step.target) return;

    const targetEl = document.querySelector(step.target);
    if (!targetEl) return;

    const targetRect = targetEl.getBoundingClientRect();

    const beacon = document.createElement("div");
    beacon.className = "relay-tour-beacon";
    beacon.style.cssText = `
      left: ${targetRect.right + 8}px;
      top: ${targetRect.top + targetRect.height / 2 - 12}px;
    `;

    const dot = document.createElement("div");
    dot.className = "relay-tour-beacon__dot";
    beacon.appendChild(dot);

    const ring = document.createElement("div");
    ring.className = "relay-tour-beacon__ring";
    beacon.appendChild(ring);

    beacon.onclick = () => {
      // Convert beacon to tooltip
      const tooltipStep: TourStep = { ...step, type: "tooltip" };
      this.cleanup();
      this.container = document.createElement("div");
      this.container.className = "relay-tour-container";
      document.body.appendChild(this.container);
      this.renderTooltip(tooltipStep);
    };

    this.container.appendChild(beacon);
  }

  private calculatePosition(
    targetRect: DOMRect | null,
    preferredPosition?: string
  ): { left: number; top: number; arrowPosition: string } {
    const tooltipWidth = 320;
    const tooltipHeight = 200; // Approximate
    const padding = 12;

    if (!targetRect) {
      // Center on screen
      return {
        left: (window.innerWidth - tooltipWidth) / 2,
        top: (window.innerHeight - tooltipHeight) / 2,
        arrowPosition: "bottom",
      };
    }

    const positions = {
      top: {
        left: targetRect.left + targetRect.width / 2 - tooltipWidth / 2,
        top: targetRect.top - tooltipHeight - padding,
        arrowPosition: "top",
      },
      bottom: {
        left: targetRect.left + targetRect.width / 2 - tooltipWidth / 2,
        top: targetRect.bottom + padding,
        arrowPosition: "bottom",
      },
      left: {
        left: targetRect.left - tooltipWidth - padding,
        top: targetRect.top + targetRect.height / 2 - tooltipHeight / 2,
        arrowPosition: "left",
      },
      right: {
        left: targetRect.right + padding,
        top: targetRect.top + targetRect.height / 2 - tooltipHeight / 2,
        arrowPosition: "right",
      },
    };

    // Use preferred position if specified and valid
    if (preferredPosition && preferredPosition !== "auto") {
      const pos = positions[preferredPosition as keyof typeof positions];
      if (pos) {
        // Clamp to viewport
        pos.left = Math.max(padding, Math.min(pos.left, window.innerWidth - tooltipWidth - padding));
        pos.top = Math.max(padding, Math.min(pos.top, window.innerHeight - tooltipHeight - padding));
        return pos;
      }
    }

    // Auto-position: prefer bottom, then top, then right, then left
    for (const position of ["bottom", "top", "right", "left"] as const) {
      const pos = positions[position];
      if (
        pos.left >= padding &&
        pos.left + tooltipWidth <= window.innerWidth - padding &&
        pos.top >= padding &&
        pos.top + tooltipHeight <= window.innerHeight - padding
      ) {
        return pos;
      }
    }

    // Fallback to bottom, clamped
    const fallback = positions.bottom;
    fallback.left = Math.max(padding, Math.min(fallback.left, window.innerWidth - tooltipWidth - padding));
    fallback.top = Math.max(padding, Math.min(fallback.top, window.innerHeight - tooltipHeight - padding));
    return fallback;
  }

  private setupAdvanceListener(step: TourStep): void {
    if (!step.advanceSelector) return;

    const targetEl = document.querySelector(step.advanceSelector);
    if (!targetEl) return;

    const handler = () => {
      this.nextStep();
    };

    if (step.advanceOn === "click") {
      targetEl.addEventListener("click", handler);
      this.advanceListener = handler;
      this.advanceListenerTarget = targetEl;
      this.advanceListenerType = "click";
    } else if (step.advanceOn === "input") {
      targetEl.addEventListener("input", handler);
      this.advanceListener = handler;
      this.advanceListenerTarget = targetEl;
      this.advanceListenerType = "input";
    }
  }

  private handlePrimaryAction(button: TourStep["primaryButton"]): void {
    if (!button) return;

    switch (button.action) {
      case "next":
        this.nextStep();
        break;
      case "complete":
        this.completeTour();
        break;
      case "url":
        if (button.url) {
          window.open(button.url, "_blank");
        }
        this.nextStep();
        break;
    }
  }

  private handleSecondaryAction(action: string): void {
    switch (action) {
      case "skip":
        this.nextStep();
        break;
      case "back":
        this.previousStep();
        break;
      case "dismiss":
        this.dismissTour();
        break;
    }
  }

  private async nextStep(): Promise<void> {
    if (!this.currentTour) return;

    this.currentStepIndex++;

    if (this.currentStepIndex >= this.currentTour.steps.length) {
      this.completeTour();
    } else {
      await this.callbacks.onProgress(this.currentTour.id, this.currentStepIndex);
      this.renderStep();
    }
  }

  private async previousStep(): Promise<void> {
    if (!this.currentTour || this.currentStepIndex <= 0) return;

    this.currentStepIndex--;
    await this.callbacks.onProgress(this.currentTour.id, this.currentStepIndex);
    this.renderStep();
  }

  private async completeTour(): Promise<void> {
    if (!this.currentTour) return;

    await this.callbacks.onComplete(this.currentTour.id);
    this.cleanup();
    this.currentTour = null;
    this.currentStepIndex = 0;
  }

  private async dismissTour(): Promise<void> {
    if (!this.currentTour) return;

    await this.callbacks.onDismiss(this.currentTour.id);
    this.cleanup();
    this.currentTour = null;
    this.currentStepIndex = 0;
  }

  private cleanup(): void {
    if (this.container) {
      this.container.remove();
      this.container = null;
    }

    // Properly remove advance listener to prevent memory leaks
    if (this.advanceListener && this.advanceListenerTarget && this.advanceListenerType) {
      this.advanceListenerTarget.removeEventListener(
        this.advanceListenerType,
        this.advanceListener
      );
    }
    this.advanceListener = null;
    this.advanceListenerTarget = null;
    this.advanceListenerType = null;
  }

  destroy(): void {
    this.cleanup();
    if (this.styleElement) {
      this.styleElement.remove();
      this.styleElement = null;
    }
  }
}
