import React from 'react';

interface SpinnerProps {
  /** Size of the spinner - defaults to 'md' */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Color variant of the spinner - defaults to 'blue' */
  color?:
    | 'blue'
    | 'gray'
    | 'green'
    | 'red'
    | 'purple'
    | 'pink'
    | 'indigo'
    | 'black';
  /** Additional CSS classes to apply */
  className?: string;
  /** Accessible label for screen readers */
  label?: string;
}

/**
 * A customizable loading spinner component using Tailwind CSS
 *
 * @param size - Controls the size of the spinner (sm, md, lg, xl)
 * @param color - Controls the color theme of the spinner
 * @param className - Additional CSS classes to apply
 * @param label - Accessible label for screen readers
 */
const Spinner: React.FC<SpinnerProps> = ({
  size = 'md',
  color = 'blue',
  className = '',
  label = 'Loading...',
}) => {
  // Size mappings
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12',
  };

  // Color mappings
  const colorClasses = {
    blue: 'border-blue-600',
    gray: 'border-gray-600',
    green: 'border-green-600',
    red: 'border-red-600',
    purple: 'border-purple-600',
    pink: 'border-pink-600',
    indigo: 'border-indigo-600',
    black: 'border-black',
  };

  return (
    <div
      className={`
        inline-block
        ${sizeClasses[size]}
        border-2
        border-gray-200
        ${colorClasses[color]}
        border-t-transparent
        rounded-full
        animate-spin
        ${className}
      `
        .trim()
        .replace(/\s+/g, ' ')}
      role="status"
      aria-label={label}
    >
      <span className="sr-only">{label}</span>
    </div>
  );
};

export default Spinner;
