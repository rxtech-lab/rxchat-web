'use client';

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  LexicalTypeaheadMenuPlugin,
  useBasicTypeaheadTriggerMatch,
} from '@lexical/react/LexicalTypeaheadMenuPlugin';
import { $createTextNode, type TextNode } from 'lexical';
import {
  useCallback,
  useMemo,
  useState,
  useEffect,
  type MutableRefObject,
} from 'react';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { KEY_ESCAPE_COMMAND, COMMAND_PRIORITY_HIGH } from 'lexical';
import {
  FileText,
  Wrench,
  FileSearch,
  Package,
  ChevronRight,
  ChevronLeft,
  Loader2,
} from 'lucide-react';

import { useMCPToolsQuery } from '@/hooks/use-mcp-tools-search';

import { cn } from '@/lib/utils';
import { $createMentionNode } from '../nodes/mention-node';
import type { Tool } from '@/lib/api/mcp-router/client';

// Menu types
type MenuType = 'main' | 'tools' | 'document-search' | 'workflow';

interface MenuItem {
  id: string;
  label: string;
  description?: string;
  icon?: JSX.Element;
  hasSubmenu?: boolean;
  action?: () => void;
}

interface MenuState {
  currentMenu: MenuType;
  searchQuery: string;
  selectedIndex: number;
}

// Type definitions for the typeahead plugin
interface QueryMatch {
  leadOffset: number;
  matchingString: string;
  replaceableString: string;
}

class TypeaheadOption {
  key: string;
  ref?: MutableRefObject<HTMLElement | null>;

  constructor(key: string) {
    this.key = key;
  }

  setRefElement = (element: HTMLElement | null) => {
    if (!this.ref) {
      this.ref = { current: null };
    }
    this.ref.current = element;
  };
}

const PUNCTUATION =
  '\\.,\\+\\*\\?\\$\\@\\|#{}\\(\\)\\^\\-\\[\\]\\\\/!%\'"~=<>_:;';

const TRIGGERS = ['@'].join('');

// Chars we expect to see in a mention (non-space, non-punctuation).
const VALID_CHARS = `[^${TRIGGERS}${PUNCTUATION}\\s]`;

// Non-standard series of chars. Each series must be preceded and followed by
// a valid char.
const VALID_JOINS = `(?:\\.[ |$]| |[${PUNCTUATION}]|)`;

const LENGTH_LIMIT = 75;

const AtSignMentionsRegex = new RegExp(
  `(^|\\s|\\()([${TRIGGERS}]((?:${VALID_CHARS}${VALID_JOINS}){0,${LENGTH_LIMIT}}))$`,
);

// 50 is the longest alias length limit.
const ALIAS_LENGTH_LIMIT = 50;

// Regex used to match alias.
const AtSignMentionsRegexAliasRegex = new RegExp(
  `(^|\\s|\\()([${TRIGGERS}]((?:${VALID_CHARS}){0,${ALIAS_LENGTH_LIMIT}}))$`,
);

// At most, 10 suggestions are shown in the popup.
const SUGGESTION_LIST_LENGTH_LIMIT = 10;

function checkForAtSignMentions(
  text: string,
  minMatchLength: number,
): QueryMatch | null {
  let match = AtSignMentionsRegex.exec(text);

  if (match === null) {
    match = AtSignMentionsRegexAliasRegex.exec(text);
  }
  if (match !== null) {
    // The strategy ignores leading whitespace but we need to know it's
    // length to add it to the leadOffset
    const maybeLeadingWhitespace = match[1];

    const matchingString = match[3];
    const replaceableString = match[2];

    // Don't show popover if there's a space immediately after @
    // Check if the replaceableString is just "@" and the text has a space after it
    if (
      replaceableString === '@' &&
      text.charAt(match.index + maybeLeadingWhitespace.length + 1) === ' '
    ) {
      return null;
    }

    if (matchingString.length >= minMatchLength) {
      return {
        leadOffset: match.index + maybeLeadingWhitespace.length,
        matchingString,
        replaceableString,
      };
    }
  }
  return null;
}

function getPossibleQueryMatch(text: string): QueryMatch | null {
  return checkForAtSignMentions(text, 0);
}

class MCPToolTypeaheadOption extends TypeaheadOption {
  tool: Tool;
  icon: JSX.Element;

  constructor(tool: Tool) {
    super(tool.identifier);
    this.tool = tool;
    this.icon = (
      <div className="flex size-6 items-center justify-center rounded bg-blue-100 text-blue-600">
        <FileText size={12} />
      </div>
    );
  }
}

class MenuItemTypeaheadOption extends TypeaheadOption {
  menuItem: MenuItem;
  type: 'menu-item' | 'tool';

  constructor(menuItem: MenuItem, type: 'menu-item' | 'tool' = 'menu-item') {
    super(menuItem.id);
    this.menuItem = menuItem;
    this.type = type;
  }
}

function MCPToolTypeaheadMenuItem({
  index,
  isSelected,
  onClick,
  onMouseEnter,
  option,
  ...rest
}: {
  index: number;
  isSelected: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  option: MCPToolTypeaheadOption;
}) {
  return (
    // eslint-disable-next-line jsx-a11y/role-supports-aria-props
    <li
      key={option.key}
      tabIndex={-1}
      className={cn(
        'flex cursor-pointer items-center gap-3 rounded-sm px-3 py-2 text-sm transition-colors',
        'hover:bg-accent hover:text-accent-foreground',
        isSelected && 'bg-accent text-accent-foreground',
      )}
      ref={option.setRefElement}
      aria-selected={isSelected}
      id={`typeahead-item-${index}`}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
      {...rest}
    >
      <div className="flex-1 overflow-hidden">
        <div className="font-medium truncate">{option.tool.title}</div>
        <div className="text-xs text-muted-foreground truncate">
          {option.tool.description}
        </div>
      </div>
    </li>
  );
}

function MenuItemTypeaheadMenuItem({
  index,
  isSelected,
  onClick,
  onMouseEnter,
  option,
}: {
  index: number;
  isSelected: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  option: MenuItemTypeaheadOption;
}) {
  const { menuItem } = option;

  return (
    // eslint-disable-next-line jsx-a11y/role-supports-aria-props
    <li
      key={option.key}
      tabIndex={-1}
      className={cn(
        'flex cursor-pointer items-center gap-3 rounded-sm px-3 py-2 text-sm transition-colors',
        'hover:bg-accent hover:text-accent-foreground',
        isSelected && 'bg-accent text-accent-foreground',
      )}
      ref={option.setRefElement}
      aria-selected={isSelected}
      id={`typeahead-item-${index}`}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
    >
      {menuItem.icon && <div className="shrink-0">{menuItem.icon}</div>}
      <div className="flex-1 overflow-hidden">
        <div className="font-medium truncate flex items-center gap-2">
          {menuItem.label}
          {menuItem.hasSubmenu && (
            <ChevronRight className="size-3 opacity-60" />
          )}
        </div>
        {menuItem.description && (
          <div className="text-xs text-muted-foreground truncate">
            {menuItem.description}
          </div>
        )}
      </div>
    </li>
  );
}

/**
 * MCP Tools Mentions Plugin for Lexical Editor
 *
 * This plugin allows users to mention MCP tools by typing "@" followed by a search query.
 * It uses the useMCPToolsQuery hook to search for available tools and displays them
 * in a typeahead menu at the cursor position.
 */
export default function MCPToolsMentionsPlugin(): JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  const [menuState, setMenuState] = useState<MenuState>({
    currentMenu: 'main',
    searchQuery: '',
    selectedIndex: 0,
  });
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const closeMenuRef = React.useRef<(() => void) | null>(null);

  // Use the MCP tools search hook
  const { tools, isLoading } = useMCPToolsQuery(
    menuState.currentMenu === 'tools' ? menuState.searchQuery : '',
    {
      enabled:
        menuState.currentMenu === 'tools' && menuState.searchQuery.length >= 0,
      debounceDelay: 300,
    },
  );

  // Handle ESC key to go back to main menu when in submenu
  useEffect(() => {
    return editor.registerCommand(
      KEY_ESCAPE_COMMAND,
      () => {
        if (isMenuOpen && menuState.currentMenu === 'tools') {
          setMenuState({
            currentMenu: 'main',
            searchQuery: '',
            selectedIndex: 0,
          });
          return true; // Prevent default ESC behavior
        }
        return false; // Allow default ESC behavior
      },
      COMMAND_PRIORITY_HIGH,
    );
  }, [editor, isMenuOpen, menuState.currentMenu]);

  // Handle click-away to close modal
  useEffect(() => {
    if (!isMenuOpen || !closeMenuRef.current) return;

    const handleClickAway = (event: MouseEvent) => {
      const target = event.target as Node;
      const modalElement = document.querySelector('[data-state="open"]');

      if (modalElement && !modalElement.contains(target)) {
        closeMenuRef.current?.();
      }
    };

    document.addEventListener('mousedown', handleClickAway);
    return () => {
      document.removeEventListener('mousedown', handleClickAway);
    };
  }, [isMenuOpen]);

  const checkForSlashTriggerMatch = useBasicTypeaheadTriggerMatch('/', {
    minLength: 0,
  });

  // Main menu items
  const mainMenuItems: MenuItem[] = useMemo(
    () => [
      {
        id: 'tools',
        label: 'Tools',
        description: 'Search and use available tools',
        hasSubmenu: true,
        icon: (
          <div className="flex size-6 items-center justify-center rounded bg-blue-100 text-blue-600">
            <Wrench size={12} />
          </div>
        ),
      },
      {
        id: 'document-search',
        label: 'Document Search',
        description: 'Search through your documents',
        hasSubmenu: false,
        icon: (
          <div className="flex size-6 items-center justify-center rounded bg-green-100 text-green-600">
            <FileSearch size={12} />
          </div>
        ),
      },
      {
        id: 'workflow',
        label: 'Workflow',
        description: 'Create and manage workflows',
        hasSubmenu: false,
        icon: (
          <div className="flex size-6 items-center justify-center rounded bg-purple-100 text-purple-600">
            <Package size={12} />
          </div>
        ),
      },
    ],
    [],
  );

  const options = useMemo(() => {
    if (menuState.currentMenu === 'main') {
      return mainMenuItems.map((item) => new MenuItemTypeaheadOption(item));
    } else if (menuState.currentMenu === 'tools') {
      return tools
        .map((tool) => new MCPToolTypeaheadOption(tool))
        .slice(0, SUGGESTION_LIST_LENGTH_LIMIT);
    }
    return [];
  }, [menuState.currentMenu, mainMenuItems, tools]);

  const onSelectOption = useCallback(
    (
      selectedOption: MCPToolTypeaheadOption | MenuItemTypeaheadOption,
      nodeToReplace: TextNode | null,
      closeMenu: () => void,
    ) => {
      // Store the close function for click-away handling
      closeMenuRef.current = closeMenu;
      if (selectedOption instanceof MCPToolTypeaheadOption) {
        // Handle tool selection - create mention node
        editor.update(() => {
          const mentionNode = $createMentionNode(selectedOption.tool);
          if (nodeToReplace) {
            nodeToReplace.replace(mentionNode);
          }

          // Insert a space after the mention node
          const spaceNode = $createTextNode(' ');
          mentionNode.insertAfter(spaceNode);

          // Position cursor after the space
          spaceNode.select(1, 1);
          closeMenu();
        });
      } else if (selectedOption instanceof MenuItemTypeaheadOption) {
        const { menuItem } = selectedOption;

        if (menuItem.hasSubmenu) {
          // Navigate to submenu
          if (menuItem.id === 'tools') {
            setMenuState((prev) => ({
              ...prev,
              currentMenu: 'tools',
              searchQuery: '',
              selectedIndex: 0,
            }));
          }
        } else {
          // Create mention node for menu items without submenu
          editor.update(() => {
            const mentionData = {
              identifier: menuItem.id,
              title: menuItem.label,
              description: menuItem.description || '',
              inputSchema: {},
              outputSchema: {},
              sha256: '',
            };

            const mentionNode = $createMentionNode(mentionData);
            if (nodeToReplace) {
              nodeToReplace.replace(mentionNode);
            }

            // Insert a space after the mention node
            const spaceNode = $createTextNode(' ');
            mentionNode.insertAfter(spaceNode);

            // Position cursor after the space
            spaceNode.select(1, 1);
            closeMenu();
          });
        }
      }
    },
    [editor],
  );

  const checkForMentionMatch = useCallback(
    (text: string) => {
      const mentionMatch = getPossibleQueryMatch(text);
      const slashMatch = checkForSlashTriggerMatch(text, editor);

      if (!slashMatch && mentionMatch) {
        // Update menu state based on query
        const query = mentionMatch.matchingString.toLowerCase();

        if (menuState.currentMenu === 'tools') {
          setMenuState((prev) => ({
            ...prev,
            searchQuery: query,
          }));
        } else {
          // Reset to main menu if starting fresh
          setMenuState({
            currentMenu: 'main',
            searchQuery: query,
            selectedIndex: 0,
          });
        }

        return mentionMatch;
      }

      // If no match and we're in a submenu, reset to main menu
      if (!mentionMatch && menuState.currentMenu !== 'main') {
        setMenuState({
          currentMenu: 'main',
          searchQuery: '',
          selectedIndex: 0,
        });
      }

      return null;
    },
    [checkForSlashTriggerMatch, editor, menuState.currentMenu],
  );

  return (
    <LexicalTypeaheadMenuPlugin<
      MCPToolTypeaheadOption | MenuItemTypeaheadOption
    >
      onQueryChange={() => {}}
      onSelectOption={onSelectOption}
      triggerFn={checkForMentionMatch}
      options={options}
      onOpen={() => setIsMenuOpen(true)}
      onClose={() => {
        setIsMenuOpen(false);
        closeMenuRef.current = null;
        setMenuState({
          currentMenu: 'main',
          searchQuery: '',
          selectedIndex: 0,
        });
      }}
      menuRenderFn={(
        anchorElementRef,
        { selectedIndex, selectOptionAndCleanUp, setHighlightedIndex },
      ) => {
        // Get the actual DOM element from the ref
        const anchorElement = anchorElementRef?.current || anchorElementRef;

        return ReactDOM.createPortal(
          <div
            className={cn(
              'z-50 min-w-[300px] max-w-[400px] rounded-2xl border bg-popover p-2 text-popover-foreground outline-none',
              'transform',
            )}
            data-state="open"
            style={{
              position: 'absolute',
              bottom: '100%',
              marginBottom: '30px',
            }}
            role="menu"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-2 py-1 mb-2 border-b border-border/50">
              <div className="flex items-center gap-2">
                {menuState.currentMenu === 'tools' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuState({
                        currentMenu: 'main',
                        searchQuery: '',
                        selectedIndex: 0,
                      });
                    }}
                    className="flex items-center justify-center size-5 rounded hover:bg-accent"
                  >
                    <ChevronLeft className="size-3" />
                  </button>
                )}
                <span className="text-xs font-medium text-muted-foreground">
                  {menuState.currentMenu === 'main'
                    ? 'Select Category'
                    : menuState.currentMenu === 'tools'
                      ? 'Search Tools'
                      : menuState.currentMenu}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                {menuState.currentMenu === 'tools'
                  ? 'ESC to go back'
                  : 'Enter to select'}
              </span>
            </div>

            {/* Content */}
            {options.length ||
            (menuState.currentMenu === 'tools' && isLoading) ? (
              <>
                {menuState.currentMenu === 'tools' && isLoading ? (
                  <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Searching tools...
                  </div>
                ) : options.length === 0 ? (
                  <div className="py-4 text-center text-sm text-muted-foreground">
                    {menuState.currentMenu === 'tools'
                      ? 'No tools found'
                      : 'No options available'}
                  </div>
                ) : (
                  <ul
                    className="space-y-1 max-w-[300px]"
                    data-testid="mentions-menu"
                  >
                    {options.map((option, i: number) => {
                      if (option instanceof MCPToolTypeaheadOption) {
                        return (
                          <MCPToolTypeaheadMenuItem
                            index={i}
                            isSelected={selectedIndex === i}
                            data-testid={`mentions-menu-item-${option.key}`}
                            onClick={() => {
                              setHighlightedIndex(i);
                              selectOptionAndCleanUp(option);
                            }}
                            onMouseEnter={() => {
                              setHighlightedIndex(i);
                            }}
                            key={option.key}
                            option={option}
                          />
                        );
                      } else {
                        return (
                          <MenuItemTypeaheadMenuItem
                            index={i}
                            data-testid={`mentions-menu-item-${option.key}`}
                            isSelected={selectedIndex === i}
                            onClick={() => {
                              setHighlightedIndex(i);
                              selectOptionAndCleanUp(option);
                            }}
                            onMouseEnter={() => {
                              setHighlightedIndex(i);
                            }}
                            key={option.key}
                            option={option}
                          />
                        );
                      }
                    })}
                  </ul>
                )}
              </>
            ) : (
              <div className="py-4 text-center text-sm text-muted-foreground">
                {menuState.currentMenu === 'tools'
                  ? 'No tools found'
                  : 'No options available'}
              </div>
            )}
          </div>,
          anchorElement as any,
        );
      }}
    />
  );
}
