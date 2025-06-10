'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  Info,
  Lightbulb,
  Loader2,
  Play,
  Search,
  Square,
  Wrench,
} from 'lucide-react';
import type { OnStep } from './types';
import WorkflowView from './workflow-view';

interface OnStepViewProps {
  onStep: OnStep;
  className?: string;
  showMainInfo: boolean;
}

/**
 * Component to display OnStep information in a structured UI format
 */
export function OnStepView({
  onStep,
  className,
  showMainInfo,
}: OnStepViewProps) {
  // Get the appropriate icon and color based on step type
  const getStepIcon = () => {
    switch (onStep.type) {
      case 'success':
        return <CheckCircle className="size-5 text-green-600" />;
      case 'error':
        return <AlertTriangle className="size-5 text-red-600" />;
      case 'info':
      default:
        return <Info className="size-5 text-blue-600" />;
    }
  };

  const getStepColor = () => {
    switch (onStep.type) {
      case 'success':
        return 'border-green-200 bg-green-50';
      case 'error':
        return 'border-red-200 bg-red-50';
      case 'info':
      default:
        return 'border-blue-200 bg-blue-50';
    }
  };

  return (
    <div className="relative h-full">
      {/* Workflow Display - Left Side */}
      {onStep.workflow && (
        <div className="h-full col-span-2">
          <WorkflowView workflow={onStep.workflow} />
        </div>
      )}

      {/* Main Info - Right Side */}
      {showMainInfo && (
        <div className="absolute right-0 top-0 mt-10 h-full max-h-screen overflow-y-auto">
          <div className="space-y-6 flex flex-col overflow-y-auto max-w-md">
            <Card className={cn('p-1', getStepColor())}>
              <CardHeader className="pb-3 bg-white">
                <div className="flex items-center gap-3">
                  {onStep.type !== 'success' && (
                    <Loader2 className="size-5 animate-spin text-gray-600" />
                  )}{' '}
                  {getStepIcon()}
                  <CardTitle className="text-lg bg-white z-10">
                    {onStep.title}
                  </CardTitle>
                  <Badge
                    variant={
                      onStep.type === 'error' ? 'destructive' : 'secondary'
                    }
                  >
                    {onStep.type.toUpperCase()}
                  </Badge>
                </div>
              </CardHeader>
            </Card>

            {/* Error Display */}
            {onStep.error && (
              <Alert variant="destructive">
                <AlertTriangle className="size-4" />
                <AlertTitle>Error Occurred</AlertTitle>
                <AlertDescription className="mt-2">
                  <div className="font-mono text-sm bg-red-100 p-3 rounded-md">
                    {onStep.error.message}
                  </div>
                  {onStep.error.stack && (
                    <details className="mt-3">
                      <summary className="cursor-pointer font-medium">
                        View Stack Trace
                      </summary>
                      <pre className="mt-2 text-xs bg-red-50 p-3 rounded border overflow-auto">
                        {onStep.error.stack}
                      </pre>
                    </details>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {/* Tool Discovery Display */}
            {onStep.toolDiscovery && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Search className="size-5 text-indigo-600" />
                    <CardTitle className="text-base">Tool Discovery</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-medium text-sm text-gray-700 mb-2">
                      Reasoning:
                    </h4>
                    <p className="text-sm bg-gray-50 p-3 rounded-md">
                      {onStep.toolDiscovery.reasoning}
                    </p>
                  </div>

                  <div>
                    <h4 className="font-medium text-sm text-gray-700 mb-2">
                      Selected Tools (
                      {onStep.toolDiscovery.selectedTools.length}
                      ):
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {onStep.toolDiscovery.selectedTools.length > 0 ? (
                        onStep.toolDiscovery.selectedTools.map((tool) => (
                          <Badge
                            key={tool}
                            variant="outline"
                            className="flex items-center gap-1"
                          >
                            <Wrench className="size-3" />
                            {tool}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm text-gray-500 italic">
                          No tools selected
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Suggestions Display */}
            {onStep.suggestion && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Lightbulb className="size-5 text-yellow-600" />
                    <CardTitle className="text-base">Suggestions</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {onStep.suggestion.suggestions &&
                    onStep.suggestion.suggestions.length > 0 && (
                      <div>
                        <h4 className="font-medium text-sm text-gray-700 mb-2">
                          Suggestions:
                        </h4>
                        <ul className="space-y-2">
                          {onStep.suggestion.suggestions.map(
                            (suggestion, index) => (
                              <li
                                key={`suggestion-${index}-${suggestion.substring(0, 50)}`}
                                className="flex items-start gap-2"
                              >
                                <ArrowRight className="size-4 text-gray-400 mt-0.5 shrink-0" />
                                <span className="text-sm bg-yellow-50 p-2 rounded border">
                                  {suggestion}
                                </span>
                              </li>
                            ),
                          )}
                        </ul>
                      </div>
                    )}

                  {onStep.suggestion.modifications &&
                    onStep.suggestion.modifications.length > 0 && (
                      <div>
                        <h4 className="font-medium text-sm text-gray-700 mb-2">
                          Modifications:
                        </h4>
                        <ul className="space-y-2">
                          {onStep.suggestion.modifications.map(
                            (modification, index) => (
                              <li
                                key={`modification-${index}-${modification.substring(0, 50)}`}
                                className="flex items-start gap-2"
                              >
                                <ArrowRight className="size-4 text-gray-400 mt-0.5 shrink-0" />
                                <span className="text-sm bg-blue-50 p-2 rounded border">
                                  {modification}
                                </span>
                              </li>
                            ),
                          )}
                        </ul>
                      </div>
                    )}

                  <div className="flex items-center gap-2 pt-2">
                    <span className="text-sm font-medium text-gray-700">
                      Next Step:
                    </span>
                    <Badge
                      variant={
                        onStep.suggestion.nextStep === 'continue'
                          ? 'default'
                          : 'secondary'
                      }
                      className="flex items-center gap-1"
                    >
                      {onStep.suggestion.nextStep === 'continue' ? (
                        <>
                          <Play className="size-3" />
                          Continue
                        </>
                      ) : (
                        <>
                          <Square className="size-3" />
                          Stop
                        </>
                      )}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Empty State */}
            {!onStep.toolDiscovery &&
              !onStep.suggestion &&
              !onStep.workflow &&
              !onStep.error && (
                <Card className="border-dashed">
                  <CardContent className="flex items-center justify-center py-12">
                    <div className="text-center">
                      <Info className="size-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-500">
                        No additional information available for this step.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
          </div>
        </div>
      )}
    </div>
  );
}

export default OnStepView;
