import type Konva from 'konva';
import type { LucideIcon } from 'lucide-react';

const ACTION_BAR_OFFSET_PX = 5;

/**
 * Uses the union of the nodes' own client rects rather than the transformer's,
 * since the transformer rect includes its handles (e.g. the rotate anchor and
 * its stem above the selection) which would otherwise push the bar away from
 * the selection.
 */
const getNodesActionBarPosition = (nodes: Konva.Node[]) => {
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const node of nodes) {
    const rect = node.getClientRect({ skipStroke: true, skipShadow: true });

    minX = Math.min(minX, rect.x);
    maxX = Math.max(maxX, rect.x + rect.width);
    maxY = Math.max(maxY, rect.y + rect.height);
  }

  if (!Number.isFinite(minX) || !Number.isFinite(maxY)) {
    return null;
  }

  return {
    top: `${maxY + ACTION_BAR_OFFSET_PX}px`,
    left: `${minX + (maxX - minX) / 2}px`,
  };
};

type EnvelopeCanvasActionBarProps = {
  nodes: Konva.Node[];

  hidden?: boolean;

  children: React.ReactNode;
};

/**
 * Must be rendered within the page's relatively positioned container.
 */
export const EnvelopeCanvasActionBar = ({ nodes, hidden = false, children }: EnvelopeCanvasActionBarProps) => {
  const position = nodes.length > 0 ? getNodesActionBarPosition(nodes) : null;

  if (!position || hidden) {
    return null;
  }

  return (
    <div
      data-testid="envelope-canvas-action-bar"
      className="flex flex-col items-center"
      style={{
        position: 'absolute',
        top: position.top,
        left: position.left,
        transform: 'translateX(-50%)',
        gap: '8px',
        pointerEvents: 'auto',
        zIndex: 50,
      }}
    >
      {children}
    </div>
  );
};

/**
 * Themed like the viewer toolbar, but the ring and shadow are stronger since
 * the bar sits directly on the page, which is usually white, rather than on
 * the viewer background.
 */
export const EnvelopeCanvasActionButtonGroup = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="flex w-fit items-center gap-x-0.5 rounded-lg bg-popover p-1 text-popover-foreground shadow-black/25 shadow-lg ring-1 ring-black/15 dark:shadow-black/60 dark:ring-white/20">
      {children}
    </div>
  );
};

export const EnvelopeCanvasActionDivider = () => {
  return <div className="mx-0.5 h-4 w-px bg-border" />;
};

type EnvelopeCanvasActionButtonProps = {
  title: string;
  icon: LucideIcon;
  onClick: () => void;
};

export const EnvelopeCanvasActionButton = ({ title, icon: Icon, onClick }: EnvelopeCanvasActionButtonProps) => {
  return (
    <button
      type="button"
      title={title}
      className="rounded-md p-1.5 text-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
      onClick={onClick}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
};
