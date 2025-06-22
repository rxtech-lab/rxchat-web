/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Artifact } from './artifact';

jest.mock('swr', () => ({
  __esModule: true,
  default: jest.fn(() => ({ data: undefined, error: undefined, mutate: jest.fn(), isLoading: false })),
  useSWRConfig: jest.fn(() => ({ mutate: jest.fn() }))
}));
jest.mock('usehooks-ts', () => ({
  useDebounceCallback: jest.fn((fn) => fn),
  useWindowSize: jest.fn(() => ({ width: 1024, height: 768 }))
}));
jest.mock('@/hooks/use-artifact', () => ({
  useArtifact: jest.fn(() => ({
    artifact: {
      title: 'Test Artifact',
      documentId: 'doc-1',
      kind: 'text',
      content: 'Test content',
      isVisible: true,
      status: 'idle',
      boundingBox: { top: 0, left: 0, width: 300, height: 200 }
    },
    setArtifact: jest.fn(),
    metadata: {},
    setMetadata: jest.fn()
  }))
}));
jest.mock('./ui/sidebar', () => ({
  useSidebar: jest.fn(() => ({ open: false }))
}));
jest.mock('./input/multimodal-input', () => ({
  MultimodalInput: () => <div data-testid="multimodal-input">Multimodal Input</div>
}));
jest.mock('./artifact-messages', () => ({
  ArtifactMessages: () => <div data-testid="artifact-messages">Artifact Messages</div>
}));
jest.mock('./artifact-close-button', () => ({
  ArtifactCloseButton: () => <div data-testid="artifact-close-button">Close</div>
}));
jest.mock('./artifact-actions', () => ({
  ArtifactActions: () => <div data-testid="artifact-actions">Actions</div>
}));
jest.mock('./toolbar', () => ({
  Toolbar: () => <div data-testid="toolbar">Toolbar</div>
}));
jest.mock('./version-footer', () => ({
  VersionFooter: () => <div data-testid="version-footer">Version Footer</div>
}));

// Mock text artifact
jest.mock('@/artifacts/text/client', () => ({
  textArtifact: {
    kind: 'text',
    content: ({ title, content, onSaveContent }: any) => (
      <div data-testid="text-artifact">
        <div data-testid="artifact-title">{title}</div>
        <div data-testid="artifact-content">{content}</div>
      </div>
    )
  }
}));

// Mock other artifacts
jest.mock('@/artifacts/code/client', () => ({
  codeArtifact: { kind: 'code', content: () => <div>Code Artifact</div> }
}));
jest.mock('@/artifacts/image/client', () => ({
  imageArtifact: { kind: 'image', content: () => <div>Image Artifact</div> }
}));
jest.mock('@/artifacts/sheet/client', () => ({
  sheetArtifact: { kind: 'sheet', content: () => <div>Sheet Artifact</div> }
}));
jest.mock('@/artifacts/flowchart/client', () => ({
  flowchartArtifact: { kind: 'flowchart', content: () => <div>Flowchart Artifact</div> }
}));

describe('Artifact', () => {
  const defaultProps = {
    chatId: 'test-chat',
    input: '',
    setInput: jest.fn(),
    handleSubmit: jest.fn(),
    status: 'idle' as const,
    stop: jest.fn(),
    attachments: [],
    setAttachments: jest.fn(),
    append: jest.fn(),
    messages: [],
    setMessages: jest.fn(),
    reload: jest.fn(),
    votes: [],
    isReadonly: false,
    selectedVisibilityType: 'private' as const,
    selectedPrompt: null
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render artifact when visible', () => {
    render(<Artifact {...defaultProps} />);
    
    expect(screen.getByTestId('artifact')).toBeInTheDocument();
  });

  it('should render artifact title and content', () => {
    render(<Artifact {...defaultProps} />);
    
    expect(screen.getByTestId('artifact-title')).toHaveTextContent('Test Artifact');
    expect(screen.getByTestId('artifact-content')).toHaveTextContent('Test content');
  });

  it('should render artifact messages panel', () => {
    render(<Artifact {...defaultProps} />);
    
    expect(screen.getByTestId('artifact-messages')).toBeInTheDocument();
  });

  it('should render multimodal input', () => {
    render(<Artifact {...defaultProps} />);
    
    expect(screen.getByTestId('multimodal-input')).toBeInTheDocument();
  });

  it('should render artifact close button', () => {
    render(<Artifact {...defaultProps} />);
    
    expect(screen.getByTestId('artifact-close-button')).toBeInTheDocument();
  });

  it('should render artifact actions', () => {
    render(<Artifact {...defaultProps} />);
    
    expect(screen.getByTestId('artifact-actions')).toBeInTheDocument();
  });

  it('should render toolbar when current version', () => {
    render(<Artifact {...defaultProps} />);
    
    expect(screen.getByTestId('toolbar')).toBeInTheDocument();
  });

  it('should apply correct CSS classes to main container', () => {
    render(<Artifact {...defaultProps} />);
    
    const artifactContainer = screen.getByTestId('artifact');
    expect(artifactContainer).toHaveClass('flex', 'flex-row', 'h-dvh', 'w-dvw', 'fixed', 'top-0', 'left-0', 'z-50');
  });

  it('should handle readonly mode', () => {
    render(<Artifact {...defaultProps} isReadonly={true} />);
    
    expect(screen.getByTestId('artifact')).toBeInTheDocument();
    expect(screen.getByTestId('multimodal-input')).toBeInTheDocument();
  });

  it('should render text artifact content correctly', () => {
    render(<Artifact {...defaultProps} />);
    
    expect(screen.getByTestId('text-artifact')).toBeInTheDocument();
  });
});

describe('Artifact when not visible', () => {
  const mockUseArtifact = require('@/hooks/use-artifact').useArtifact;
  
  beforeEach(() => {
    mockUseArtifact.mockReturnValue({
      artifact: {
        title: 'Test Artifact',
        documentId: 'doc-1',
        kind: 'text',
        content: 'Test content',
        isVisible: false,
        status: 'idle',
        boundingBox: { top: 0, left: 0, width: 300, height: 200 }
      },
      setArtifact: jest.fn(),
      metadata: {},
      setMetadata: jest.fn()
    });
  });

  const defaultProps = {
    chatId: 'test-chat',
    input: '',
    setInput: jest.fn(),
    handleSubmit: jest.fn(),
    status: 'idle' as const,
    stop: jest.fn(),
    attachments: [],
    setAttachments: jest.fn(),
    append: jest.fn(),
    messages: [],
    setMessages: jest.fn(),
    reload: jest.fn(),
    votes: [],
    isReadonly: false,
    selectedVisibilityType: 'private' as const,
    selectedPrompt: null
  };

  it('should not render artifact when not visible', () => {
    render(<Artifact {...defaultProps} />);
    
    expect(screen.queryByTestId('artifact')).not.toBeInTheDocument();
  });
});