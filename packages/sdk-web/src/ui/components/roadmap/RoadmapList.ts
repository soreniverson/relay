// ============================================================================
// ROADMAP LIST COMPONENT
// List of roadmap items grouped by status
// ============================================================================

import { createElement } from "../../utils/dom";
import {
  createRoadmapItem,
  type RoadmapItemData,
  type RoadmapStatus,
  type RoadmapItemResult,
} from "./RoadmapItem";

// Re-export types for convenience
export type { RoadmapItemData, RoadmapStatus } from "./RoadmapItem";

export interface RoadmapListConfig {
  items: RoadmapItemData[];
  onVote: (item: RoadmapItemData) => void;
  loading?: boolean;
  groupByStatus?: boolean;
}

export const roadmapListStyles = `
  .relay-roadmap-list {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    gap: 16px;
  }

  .relay-roadmap-list__loading {
    display: flex;
    justify-content: center;
    align-items: center;
    flex: 1;
    padding: 32px;
  }

  .relay-roadmap-list__spinner {
    width: 32px;
    height: 32px;
    border: 3px solid hsl(var(--relay-border));
    border-top-color: hsl(var(--relay-primary));
    border-radius: 50%;
    animation: relay-spin 0.8s linear infinite;
  }

  .relay-roadmap-list__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    padding: 48px 24px;
    text-align: center;
  }

  .relay-roadmap-list__empty-icon {
    width: 48px;
    height: 48px;
    margin-bottom: 16px;
    color: hsl(var(--relay-text-subtle));
  }

  .relay-roadmap-list__empty-icon svg {
    width: 100%;
    height: 100%;
  }

  .relay-roadmap-list__empty-title {
    font-size: 17px;
    font-weight: 600;
    color: hsl(var(--relay-text));
    margin: 0 0 4px;
  }

  .relay-roadmap-list__empty-text {
    font-size: 14px;
    color: hsl(var(--relay-text-muted));
    margin: 0;
  }

  .relay-roadmap-list__group {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .relay-roadmap-list__group-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 4px;
  }

  .relay-roadmap-list__group-title {
    font-size: 13px;
    font-weight: 600;
    color: hsl(var(--relay-text-muted));
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin: 0;
  }

  .relay-roadmap-list__group-count {
    font-size: 12px;
    font-weight: 500;
    color: hsl(var(--relay-text-subtle));
    background: hsl(var(--relay-bg-secondary));
    padding: 2px 8px;
    border-radius: 10px;
  }

  .relay-roadmap-list__group-items {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
`;

const EMPTY_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>`;

const STATUS_ORDER: RoadmapStatus[] = ["in_progress", "planned", "shipped"];

const STATUS_LABELS: Record<RoadmapStatus, string> = {
  planned: "Planned",
  in_progress: "In Progress",
  shipped: "Shipped",
};

export interface RoadmapListResult {
  element: HTMLElement;
  setItems: (items: RoadmapItemData[]) => void;
  updateItem: (item: RoadmapItemData) => void;
  setLoading: (loading: boolean) => void;
}

export function createRoadmapList(
  config: RoadmapListConfig,
): RoadmapListResult {
  const {
    items: initialItems,
    onVote,
    loading = false,
    groupByStatus = true,
  } = config;

  let items = [...initialItems];
  let isLoading = loading;
  const itemComponents = new Map<string, RoadmapItemResult>();

  const container = createElement("div", { class: "relay-roadmap-list" });

  // Group items by status
  const groupItems = (
    itemList: RoadmapItemData[],
  ): Map<RoadmapStatus, RoadmapItemData[]> => {
    const groups = new Map<RoadmapStatus, RoadmapItemData[]>();

    STATUS_ORDER.forEach((status) => {
      groups.set(status, []);
    });

    itemList.forEach((item) => {
      const group = groups.get(item.status);
      if (group) {
        group.push(item);
      }
    });

    // Sort by vote count within each group
    groups.forEach((group) => {
      group.sort((a, b) => b.voteCount - a.voteCount);
    });

    return groups;
  };

  // Render list
  const render = () => {
    container.innerHTML = "";
    itemComponents.clear();

    // Loading state
    if (isLoading) {
      const loadingEl = createElement("div", {
        class: "relay-roadmap-list__loading",
      });
      const spinner = createElement("div", {
        class: "relay-roadmap-list__spinner",
      });
      loadingEl.appendChild(spinner);
      container.appendChild(loadingEl);
      return;
    }

    // Empty state
    if (items.length === 0) {
      const emptyEl = createElement("div", {
        class: "relay-roadmap-list__empty",
      });

      const icon = createElement("div", {
        class: "relay-roadmap-list__empty-icon",
      });
      icon.innerHTML = EMPTY_ICON;

      const title = createElement(
        "h3",
        { class: "relay-roadmap-list__empty-title" },
        ["No roadmap items"],
      );
      const text = createElement(
        "p",
        { class: "relay-roadmap-list__empty-text" },
        ["Check back later for updates!"],
      );

      emptyEl.appendChild(icon);
      emptyEl.appendChild(title);
      emptyEl.appendChild(text);
      container.appendChild(emptyEl);
      return;
    }

    if (groupByStatus) {
      // Grouped view
      const groups = groupItems(items);

      STATUS_ORDER.forEach((status) => {
        const groupItems = groups.get(status);
        if (!groupItems || groupItems.length === 0) return;

        const group = createElement("div", {
          class: "relay-roadmap-list__group",
        });

        // Group header
        const header = createElement("div", {
          class: "relay-roadmap-list__group-header",
        });
        const title = createElement(
          "h3",
          { class: "relay-roadmap-list__group-title" },
          [STATUS_LABELS[status]],
        );
        const count = createElement(
          "span",
          { class: "relay-roadmap-list__group-count" },
          [String(groupItems.length)],
        );
        header.appendChild(title);
        header.appendChild(count);

        // Group items
        const itemsContainer = createElement("div", {
          class: "relay-roadmap-list__group-items",
        });

        groupItems.forEach((item) => {
          const itemComponent = createRoadmapItem({
            item,
            onVote,
          });
          itemComponents.set(item.id, itemComponent);
          itemsContainer.appendChild(itemComponent.element);
        });

        group.appendChild(header);
        group.appendChild(itemsContainer);
        container.appendChild(group);
      });
    } else {
      // Flat list (sorted by votes)
      const sortedItems = [...items].sort((a, b) => b.voteCount - a.voteCount);

      sortedItems.forEach((item) => {
        const itemComponent = createRoadmapItem({
          item,
          onVote,
        });
        itemComponents.set(item.id, itemComponent);
        container.appendChild(itemComponent.element);
      });
    }
  };

  render();

  return {
    element: container,
    setItems: (newItems: RoadmapItemData[]) => {
      items = [...newItems];
      render();
    },
    updateItem: (updatedItem: RoadmapItemData) => {
      // Update in items array
      const index = items.findIndex((i) => i.id === updatedItem.id);
      if (index !== -1) {
        items[index] = updatedItem;
      }

      // Update component if it exists
      const component = itemComponents.get(updatedItem.id);
      if (component) {
        component.update(updatedItem);
      }
    },
    setLoading: (loading: boolean) => {
      isLoading = loading;
      render();
    },
  };
}
