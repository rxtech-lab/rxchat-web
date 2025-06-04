'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDown } from 'lucide-react';
import { Button } from '../ui/button';

interface ScrollToBottomProps {
  isAtBottom: boolean;
  onScrollToBottom: () => void;
}

/**
 * Component for scroll to bottom button with animation
 * @param props - Props containing scroll state and handler
 * @returns JSX element with animated scroll button
 */
export function ScrollToBottom({
  isAtBottom,
  onScrollToBottom,
}: ScrollToBottomProps) {
  return (
    <AnimatePresence>
      {!isAtBottom && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className="absolute left-1/2 bottom-28 -translate-x-1/2 z-50"
        >
          <Button
            data-testid="scroll-to-bottom-button"
            className="rounded-full"
            size="icon"
            variant="outline"
            onClick={(event) => {
              event.preventDefault();
              onScrollToBottom();
            }}
          >
            <ArrowDown />
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
