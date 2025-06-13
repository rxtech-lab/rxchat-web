'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  Info,
  Lightbulb,
  Loader2,
  Search,
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

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.3,
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.4,
        ease: [0.4, 0, 0.2, 1],
      },
    },
  };

  const slideInFromRight = {
    hidden: { opacity: 0, x: 50 },
    visible: {
      opacity: 1,
      x: 0,
      transition: {
        duration: 0.5,
        ease: [0.4, 0, 0.2, 1],
      },
    },
  };

  const scaleInVariants = {
    hidden: { opacity: 0, scale: 0.9 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.3,
        ease: [0.4, 0, 0.2, 1],
      },
    },
  };

  return (
    <div className="relative h-full">
      {/* Workflow Display - Left Side */}
      <AnimatePresence>
        {onStep.workflow && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
            className="h-full col-span-2"
          >
            <WorkflowView workflow={onStep.workflow} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Info - Right Side */}
      <AnimatePresence>
        {showMainInfo && (
          <motion.div
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={slideInFromRight}
            className="absolute right-0 top-0 mt-10 h-full max-h-screen overflow-y-auto p-2"
          >
            <motion.div
              variants={containerVariants}
              className="space-y-6 flex flex-col overflow-y-auto min-w-md max-w-md"
            >
              {/* Main Step Card */}
              <motion.div variants={itemVariants}>
                <Card className={cn('p-1', getStepColor())}>
                  <CardHeader className="pb-3 bg-white">
                    <div className="flex items-center gap-3">
                      <AnimatePresence>
                        {onStep.type !== 'success' && (
                          <motion.div
                            initial={{ opacity: 0, rotate: 0 }}
                            animate={{ opacity: 1, rotate: 360 }}
                            exit={{ opacity: 0 }}
                            transition={{
                              duration: 0.4,
                              rotate: {
                                duration: 1,
                                repeat: Number.POSITIVE_INFINITY,
                                ease: 'linear',
                              },
                            }}
                          >
                            <Loader2 className="size-5 animate-spin text-gray-600" />
                          </motion.div>
                        )}
                      </AnimatePresence>
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{
                          delay: 0.2,
                          type: 'spring',
                          stiffness: 300,
                        }}
                      >
                        {getStepIcon()}
                      </motion.div>
                      <CardTitle className="text-lg bg-white z-10">
                        {onStep.title}
                      </CardTitle>
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{
                          delay: 0.3,
                          type: 'spring',
                          stiffness: 300,
                        }}
                      >
                        <Badge
                          variant={
                            onStep.type === 'error'
                              ? 'destructive'
                              : 'secondary'
                          }
                        >
                          {onStep.type.toUpperCase()}
                        </Badge>
                      </motion.div>
                    </div>
                  </CardHeader>
                </Card>
              </motion.div>

              {/* Error Display */}
              <AnimatePresence>
                {onStep.error && (
                  <motion.div
                    variants={itemVariants}
                    initial="hidden"
                    animate="visible"
                    exit="hidden"
                  >
                    <Alert variant="destructive">
                      <motion.div
                        initial={{ rotate: 0 }}
                        animate={{ rotate: [0, -5, 5, 0] }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                      >
                        <AlertTriangle className="size-4" />
                      </motion.div>
                      <AlertTitle>Error Occurred</AlertTitle>
                      <AlertDescription className="mt-2">
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          transition={{ duration: 0.3, delay: 0.2 }}
                          className="font-mono text-sm bg-red-100 p-3 rounded-md break-all"
                        >
                          {JSON.stringify(onStep.error)}
                        </motion.div>
                        {onStep.error.stack && (
                          <motion.details
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.4 }}
                            className="mt-3"
                          >
                            <summary className="cursor-pointer font-medium">
                              View Stack Trace
                            </summary>
                            <pre className="mt-2 text-xs bg-red-50 p-3 rounded border overflow-auto">
                              {onStep.error.stack}
                            </pre>
                          </motion.details>
                        )}
                      </AlertDescription>
                    </Alert>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Tool Discovery Display */}
              <AnimatePresence>
                {onStep.toolDiscovery && (
                  <motion.div
                    variants={itemVariants}
                    initial="hidden"
                    animate="visible"
                    exit="hidden"
                  >
                    <Card>
                      <CardHeader>
                        <div className="flex items-center gap-2">
                          <motion.div
                            animate={{ rotate: [0, 15, -15, 0] }}
                            transition={{
                              duration: 2,
                              repeat: Number.POSITIVE_INFINITY,
                            }}
                          >
                            <Search className="size-5 text-indigo-600" />
                          </motion.div>
                          <CardTitle className="text-base">
                            Tool Discovery
                          </CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <motion.div
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.2 }}
                        >
                          <h4 className="font-medium text-sm text-gray-700 mb-2">
                            Reasoning:
                          </h4>
                          <p className="text-sm bg-gray-50 p-3 rounded-md">
                            {onStep.toolDiscovery.reasoning}
                          </p>
                        </motion.div>

                        <motion.div
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.3 }}
                        >
                          <h4 className="font-medium text-sm text-gray-700 mb-2">
                            Selected Tools (
                            {onStep.toolDiscovery.selectedTools.length}
                            ):
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {onStep.toolDiscovery.selectedTools.length > 0 ? (
                              onStep.toolDiscovery.selectedTools.map(
                                (tool, index) => (
                                  <motion.div
                                    key={tool}
                                    initial={{ opacity: 0, scale: 0 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{
                                      delay: 0.4 + index * 0.1,
                                      type: 'spring',
                                      stiffness: 300,
                                    }}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                  >
                                    <Badge
                                      variant="outline"
                                      className="flex items-center gap-1"
                                    >
                                      <Wrench className="size-3" />
                                      {tool}
                                    </Badge>
                                  </motion.div>
                                ),
                              )
                            ) : (
                              <span className="text-sm text-gray-500 italic">
                                No tools selected
                              </span>
                            )}
                          </div>
                        </motion.div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Suggestions Display */}
              <AnimatePresence>
                {onStep.suggestion && (
                  <motion.div
                    variants={itemVariants}
                    initial="hidden"
                    animate="visible"
                    exit="hidden"
                  >
                    <Card>
                      <CardHeader>
                        <div className="flex items-center gap-2">
                          <motion.div
                            animate={{
                              scale: [1, 1.1, 1],
                              rotate: [0, 5, -5, 0],
                            }}
                            transition={{
                              duration: 2,
                              repeat: Number.POSITIVE_INFINITY,
                              ease: 'easeInOut',
                            }}
                          >
                            <Lightbulb className="size-5 text-yellow-600" />
                          </motion.div>
                          <CardTitle className="text-base">
                            Suggestions
                          </CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {onStep.suggestion.modifications &&
                          onStep.suggestion.modifications.length > 0 && (
                            <motion.div
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.4 }}
                            >
                              <h4 className="font-medium text-sm text-gray-700 mb-2">
                                Modifications:
                              </h4>
                              <ul className="space-y-2">
                                {onStep.suggestion.modifications.map(
                                  (modification, index) => (
                                    <motion.li
                                      key={`modification-${index}-${modification.substring(0, 50)}`}
                                      initial={{ opacity: 0, x: -20 }}
                                      animate={{ opacity: 1, x: 0 }}
                                      transition={{ delay: 0.5 + index * 0.1 }}
                                      className="flex items-start gap-2"
                                    >
                                      <motion.div
                                        animate={{ x: [0, 3, 0] }}
                                        transition={{
                                          duration: 1.5,
                                          repeat: Number.POSITIVE_INFINITY,
                                          delay: index * 0.2,
                                        }}
                                      >
                                        <ArrowRight className="size-4 text-gray-400 mt-0.5 shrink-0" />
                                      </motion.div>
                                      <span className="text-sm bg-blue-50 p-2 rounded border">
                                        {modification}
                                      </span>
                                    </motion.li>
                                  ),
                                )}
                              </ul>
                            </motion.div>
                          )}
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Empty State */}
              <AnimatePresence>
                {!onStep.toolDiscovery &&
                  !onStep.suggestion &&
                  !onStep.workflow &&
                  !onStep.error && (
                    <motion.div
                      variants={scaleInVariants}
                      initial="hidden"
                      animate="visible"
                      exit="hidden"
                    >
                      <Card className="border-dashed">
                        <CardContent className="flex items-center justify-center py-12">
                          <div className="text-center">
                            <motion.div
                              animate={{
                                scale: [1, 1.1, 1],
                                opacity: [0.5, 1, 0.5],
                              }}
                              transition={{
                                duration: 2,
                                repeat: Number.POSITIVE_INFINITY,
                                ease: 'easeInOut',
                              }}
                            >
                              <Info className="size-12 text-gray-400 mx-auto mb-3" />
                            </motion.div>
                            <p className="text-gray-500">
                              No additional information available for this step.
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default OnStepView;
