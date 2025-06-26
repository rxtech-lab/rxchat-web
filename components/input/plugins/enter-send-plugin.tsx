'use client';

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { KEY_DOWN_COMMAND, COMMAND_PRIORITY_LOW } from 'lexical';
import { useEffect } from 'react';

interface EnterSendPluginProps {
  onSend: () => void;
}

/**
 * Plugin that handles Enter key press to send/submit the message.
 * When Enter is pressed without modifier keys (shift, ctrl, meta),
 * it triggers the onSend callback.
 *
 * Note: This plugin checks if any typeahead menus are open and prevents
 * sending if they are, allowing the menu to handle the Enter key instead.
 */
export function EnterSendPlugin({ onSend }: EnterSendPluginProps) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand(
      KEY_DOWN_COMMAND,
      (event: KeyboardEvent) => {
        if (
          event.key === 'Enter' &&
          !event.shiftKey &&
          !event.ctrlKey &&
          !event.metaKey
        ) {
          // Check if any typeahead menus are currently open
          // The typeahead plugin creates portals with specific styling/attributes
          const typeaheadMenus = document.querySelectorAll(
            '[data-state="open"]',
          );
          const hasOpenTypeaheadMenu = Array.from(typeaheadMenus).some(
            (element) => {
              // Check if this element is a typeahead menu by looking for common characteristics
              const hasTypeaheadContent =
                element.querySelector('ul') ||
                element.textContent?.includes('Searching tools') ||
                element.textContent?.includes('No tools found');
              return hasTypeaheadContent;
            },
          );

          // If there's an open typeahead menu, let it handle the Enter key
          if (hasOpenTypeaheadMenu) {
            return false; // Don't handle the command, let typeahead handle it
          }

          event.preventDefault();
          onSend();
          return true; // Command was handled
        }
        return false; // Command was not handled
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor, onSend]);

  return null;
}
