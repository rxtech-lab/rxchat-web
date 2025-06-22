/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SendButton, StopButton } from './send-button';

describe('SendButton', () => {
  const mockSubmitForm = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render send button with arrow icon', () => {
    render(
      <SendButton
        submitForm={mockSubmitForm}
        input="test message"
        uploadQueue={[]}
      />,
    );

    const button = screen.getByTestId('send-button');
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass('rounded-full', 'p-1.5', 'h-fit', 'border');
  });

  it('should call submitForm when clicked', () => {
    render(
      <SendButton
        submitForm={mockSubmitForm}
        input="test message"
        uploadQueue={[]}
      />,
    );

    const button = screen.getByTestId('send-button');
    fireEvent.click(button);

    expect(mockSubmitForm).toHaveBeenCalledTimes(1);
  });

  it('should call submitForm when button is clicked', () => {
    render(
      <SendButton
        submitForm={mockSubmitForm}
        input="test message"
        uploadQueue={[]}
      />,
    );

    const button = screen.getByTestId('send-button');
    fireEvent.click(button);

    expect(mockSubmitForm).toHaveBeenCalledTimes(1);
  });

  it('should be disabled when input is empty', () => {
    render(
      <SendButton submitForm={mockSubmitForm} input="" uploadQueue={[]} />,
    );

    const button = screen.getByTestId('send-button');
    expect(button).toBeDisabled();
  });

  it('should be disabled when upload queue has items', () => {
    render(
      <SendButton
        submitForm={mockSubmitForm}
        input="test message"
        uploadQueue={['file1.jpg', 'file2.png']}
      />,
    );

    const button = screen.getByTestId('send-button');
    expect(button).toBeDisabled();
  });

  it('should be enabled when input has content and upload queue is empty', () => {
    render(
      <SendButton
        submitForm={mockSubmitForm}
        input="test message"
        uploadQueue={[]}
      />,
    );

    const button = screen.getByTestId('send-button');
    expect(button).not.toBeDisabled();
  });

  it('should not call submitForm when button is disabled', () => {
    render(
      <SendButton submitForm={mockSubmitForm} input="" uploadQueue={[]} />,
    );

    const button = screen.getByTestId('send-button');
    fireEvent.click(button);

    expect(mockSubmitForm).not.toHaveBeenCalled();
  });
});

describe('StopButton', () => {
  const mockStop = jest.fn();
  const mockSetMessages = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render stop button with stop icon', () => {
    render(<StopButton stop={mockStop} setMessages={mockSetMessages} />);

    const button = screen.getByTestId('stop-button');
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass('rounded-full', 'p-1.5', 'h-fit', 'border');
  });

  it('should call stop function when clicked', () => {
    render(<StopButton stop={mockStop} setMessages={mockSetMessages} />);

    const button = screen.getByTestId('stop-button');
    fireEvent.click(button);

    expect(mockStop).toHaveBeenCalledTimes(1);
  });

  it('should call setMessages with current messages when clicked', () => {
    render(<StopButton stop={mockStop} setMessages={mockSetMessages} />);

    const button = screen.getByTestId('stop-button');
    fireEvent.click(button);

    expect(mockSetMessages).toHaveBeenCalledTimes(1);
    expect(mockSetMessages).toHaveBeenCalledWith(expect.any(Function));
  });

  it('should call both stop and setMessages when clicked', () => {
    render(<StopButton stop={mockStop} setMessages={mockSetMessages} />);

    const button = screen.getByTestId('stop-button');
    fireEvent.click(button);

    expect(mockStop).toHaveBeenCalledTimes(1);
    expect(mockSetMessages).toHaveBeenCalledTimes(1);
  });

  it('should have correct dark mode border classes', () => {
    render(<StopButton stop={mockStop} setMessages={mockSetMessages} />);

    const button = screen.getByTestId('stop-button');
    expect(button).toHaveClass('dark:border-zinc-600');
  });
});
