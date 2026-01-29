// ============================================================================
// ROADMAP ITEM COMPONENT
// Individual roadmap item with vote button
// ============================================================================

import { createElement, escapeHtml } from "../../utils/dom";

export type RoadmapStatus = "planned" | "in_progress" | "shipped";

export interface RoadmapItemData {
  id: string;
  title: string;
  description: string;
  status: RoadmapStatus;
  voteCount: number;
  hasVoted: boolean;
}

export interface RoadmapItemConfig {
  item: RoadmapItemData;
  onVote: (item: RoadmapItemData) => void;
}

export const roadmapItemStyles = `
  .relay-roadmap-item {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 14px 16px;
    background: hsl(var(--relay-bg));
    border: 1px solid hsl(var(--relay-border));
    border-radius: 12px;
    transition: all 0.15s ease;
  }

  .relay-roadmap-item:hover {
    border-color: hsl(var(--relay-border-hover));
    box-shadow: 0 2px 4px hsl(var(--relay-shadow));
  }

  .relay-roadmap-item__vote {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  .relay-roadmap-item__vote-btn {
    width: 40px;
    height: 40px;
    padding: 0;
    background: hsl(var(--relay-bg-secondary));
    border: 1px solid hsl(var(--relay-border));
    border-radius: 10px;
    cursor: pointer;
    color: hsl(var(--relay-text-muted));
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .relay-roadmap-item__vote-btn:hover {
    background: hsl(var(--relay-bg-tertiary));
    border-color: hsl(var(--relay-border-hover));
    color: hsl(var(--relay-text));
  }

  .relay-roadmap-item__vote-btn:active {
    transform: scale(0.95);
  }

  .relay-roadmap-item__vote-btn--voted {
    background: hsl(var(--relay-primary) / 0.1);
    border-color: hsl(var(--relay-primary) / 0.3);
    color: hsl(var(--relay-primary));
  }

  .relay-roadmap-item__vote-btn--voted:hover {
    background: hsl(var(--relay-primary) / 0.15);
    border-color: hsl(var(--relay-primary) / 0.4);
  }

  .relay-roadmap-item__vote-btn svg {
    width: 20px;
    height: 20px;
  }

  .relay-roadmap-item__vote-count {
    font-size: 12px;
    font-weight: 600;
    color: hsl(var(--relay-text-muted));
  }

  .relay-roadmap-item__vote-btn--voted + .relay-roadmap-item__vote-count {
    color: hsl(var(--relay-primary));
  }

  .relay-roadmap-item__content {
    flex: 1;
    min-width: 0;
  }

  .relay-roadmap-item__header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }

  .relay-roadmap-item__title {
    font-size: 14px;
    font-weight: 600;
    color: hsl(var(--relay-text));
    margin: 0;
    flex: 1;
    min-width: 0;
  }

  .relay-roadmap-item__status {
    flex-shrink: 0;
    padding: 3px 8px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    border-radius: 6px;
  }

  .relay-roadmap-item__status--planned {
    background: hsl(217 91% 60% / 0.1);
    color: hsl(217 91% 50%);
  }

  .relay-roadmap-item__status--in_progress {
    background: hsl(38 92% 50% / 0.1);
    color: hsl(38 92% 40%);
  }

  .relay-roadmap-item__status--shipped {
    background: hsl(142 76% 36% / 0.1);
    color: hsl(142 76% 32%);
  }

  .relay-roadmap-item__description {
    font-size: 13px;
    color: hsl(var(--relay-text-muted));
    line-height: 1.4;
    margin: 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
`;

const ARROW_UP_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 19V5M5 12l7-7 7 7"/></svg>`;
const ARROW_UP_FILLED = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 4l-8 8h5v8h6v-8h5z"/></svg>`;

const STATUS_LABELS: Record<RoadmapStatus, string> = {
  planned: "Planned",
  in_progress: "In Progress",
  shipped: "Shipped",
};

export interface RoadmapItemResult {
  element: HTMLElement;
  update: (item: RoadmapItemData) => void;
}

export function createRoadmapItem(
  config: RoadmapItemConfig,
): RoadmapItemResult {
  const { item: initialItem, onVote } = config;

  let item = { ...initialItem };

  const container = createElement("div", { class: "relay-roadmap-item" });

  // Vote section
  const voteSection = createElement("div", {
    class: "relay-roadmap-item__vote",
  });

  const voteBtn = createElement("button", {
    type: "button",
    class: `relay-roadmap-item__vote-btn ${item.hasVoted ? "relay-roadmap-item__vote-btn--voted" : ""}`,
  }) as HTMLButtonElement;
  voteBtn.innerHTML = item.hasVoted ? ARROW_UP_FILLED : ARROW_UP_ICON;
  voteBtn.setAttribute("aria-label", item.hasVoted ? "Remove vote" : "Vote");

  const voteCount = createElement(
    "span",
    { class: "relay-roadmap-item__vote-count" },
    [String(item.voteCount)],
  );

  voteSection.appendChild(voteBtn);
  voteSection.appendChild(voteCount);

  // Content section
  const content = createElement("div", {
    class: "relay-roadmap-item__content",
  });

  const header = createElement("div", { class: "relay-roadmap-item__header" });

  const title = createElement("h4", { class: "relay-roadmap-item__title" }, [
    escapeHtml(item.title),
  ]);

  const statusBadge = createElement(
    "span",
    {
      class: `relay-roadmap-item__status relay-roadmap-item__status--${item.status}`,
    },
    [STATUS_LABELS[item.status]],
  );

  header.appendChild(title);
  header.appendChild(statusBadge);

  const description = createElement(
    "p",
    { class: "relay-roadmap-item__description" },
    [escapeHtml(item.description)],
  );

  content.appendChild(header);
  content.appendChild(description);

  container.appendChild(voteSection);
  container.appendChild(content);

  // Vote handler
  voteBtn.addEventListener("click", () => {
    onVote(item);
  });

  // Update function
  const update = (newItem: RoadmapItemData) => {
    item = { ...newItem };

    // Update vote button
    voteBtn.classList.toggle(
      "relay-roadmap-item__vote-btn--voted",
      item.hasVoted,
    );
    voteBtn.innerHTML = item.hasVoted ? ARROW_UP_FILLED : ARROW_UP_ICON;
    voteBtn.setAttribute("aria-label", item.hasVoted ? "Remove vote" : "Vote");

    // Update vote count
    voteCount.textContent = String(item.voteCount);

    // Update title
    title.textContent = item.title;

    // Update status
    statusBadge.className = `relay-roadmap-item__status relay-roadmap-item__status--${item.status}`;
    statusBadge.textContent = STATUS_LABELS[item.status];

    // Update description
    description.textContent = item.description;
  };

  return {
    element: container,
    update,
  };
}
