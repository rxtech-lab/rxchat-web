import { Globe } from 'lucide-react';
import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../ui/button';

// WebSearchButton component to toggle web search functionality
function PureWebSearchButton({
  isWebSearchEnabled,
  onToggle,
  status,
}: {
  isWebSearchEnabled: boolean;
  onToggle: () => void;
  status: 'ready' | 'streaming' | 'submitted' | 'error';
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      className={`rounded-md p-2 h-fit flex items-center gap-1.5 dark:border-zinc-700 hover:bg-blue-200 hover:dark:bg-blue-900 hover:text-blue-900 hover:dark:text-blue-300 ${
        isWebSearchEnabled
          ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
          : ''
      }`}
      data-testid="web-search-button"
      onClick={onToggle}
      disabled={status === 'streaming' || status === 'submitted'}
      title={
        isWebSearchEnabled
          ? 'Disable web search for this message'
          : 'Enable web search for this message'
      }
    >
      <Globe size={14} />
      <AnimatePresence>
        {isWebSearchEnabled && (
          <motion.span
            className="text-xs font-medium"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            Web Search
          </motion.span>
        )}
      </AnimatePresence>
    </Button>
  );
}

export const WebSearchButton = memo(
  PureWebSearchButton,
  (prevProps, nextProps) => {
    return (
      prevProps.isWebSearchEnabled === nextProps.isWebSearchEnabled &&
      prevProps.status === nextProps.status
    );
  },
);
