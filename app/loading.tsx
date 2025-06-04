import React from 'react';
import Spinner from '@/components/spiner';
import { getBrandName } from '@/lib/utils';

/**
 * Simplified loading page component for NextJS app
 *
 * This component displays a clean loading screen with minimal elements
 * while the app is loading.
 */
export default function Loading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center p-4">
      <div className="text-center">
        {/* Main spinner */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            {/* Main spinner */}
            <Spinner
              size="xl"
              color="blue"
              className="relative z-10"
              label={`Loading ${getBrandName()}...`}
            />
            {/* Pulse effect */}
            <div className="absolute inset-0 rounded-full border-4 border-primary/30 animate-ping" />
          </div>
        </div>

        {/* Brand and slogan */}
        <h1 className="text-3xl font-bold text-foreground mb-2 animate-bounce">
          {getBrandName()}
        </h1>
        <p className="text-lg text-muted-foreground animate-pulse">
          Where conversations come to life
        </p>
      </div>
      {/* Floating elements for visual interest */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 size-2 bg-primary/20 rounded-full animate-bounce delay-100" />
        <div className="absolute top-3/4 right-1/4 size-3 bg-primary/30 rounded-full animate-bounce delay-300" />
        <div className="absolute top-1/2 left-1/6 size-1 bg-primary/40 rounded-full animate-bounce delay-500" />
        <div className="absolute bottom-1/4 right-1/3 size-2 bg-primary/25 rounded-full animate-bounce delay-700" />
      </div>
    </div>
  );
}
