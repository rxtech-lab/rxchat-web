'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { ExternalLink, MessageCircle, Unlink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  generateTelegramLink,
  getTelegramStatus,
  unlinkTelegramAccount,
} from '@/app/(auth)/api/auth/link/telegram/actions';

interface TelegramLinkStatus {
  isLinked: boolean;
  userId?: string;
  linkedAt?: string;
}

interface LinkingTabProps {
  initialTelegramStatus: TelegramLinkStatus;
  userId: string;
}

/**
 * Linking tab component for managing external account connections
 */
export function LinkingTab({ initialTelegramStatus, userId }: LinkingTabProps) {
  const [isLinking, setIsLinking] = useState(false);

  // Use SWR to keep the telegram link status updated
  const { data: telegramStatus, mutate } = useSWR<TelegramLinkStatus>(
    `telegram-status-${userId}`,
    async () => {
      const result = await getTelegramStatus();
      if (result.error) {
        throw new Error(result.error);
      }
      return {
        isLinked: result.isLinked ?? false,
        userId: result.userId?.toString(),
        linkedAt: result.linkedAt,
      };
    },
    {
      fallbackData: initialTelegramStatus,
      refreshInterval: 5000, // Refresh every 5 seconds when linking
    },
  );

  const handleTelegramLink = async () => {
    setIsLinking(true);
    try {
      const result = await generateTelegramLink();

      if (result.error) {
        console.error('Failed to generate telegram link:', result.error);
        return;
      }

      if (result.link) {
        // Open the telegram link in a new tab
        window.open(result.link, '_blank');

        // Start polling for updates
        mutate();
      }
    } catch (error) {
      console.error('Error generating telegram link:', error);
    } finally {
      setIsLinking(false);
    }
  };

  const handleTelegramUnlink = async () => {
    try {
      const result = await unlinkTelegramAccount();

      if (result.error) {
        console.error('Failed to unlink telegram:', result.error);
        return;
      }

      if (result.success) {
        mutate();
      }
    } catch (error) {
      console.error('Error unlinking telegram:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Telegram Linking */}
      <Card data-testid="telegram-linking-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="size-5" />
            Telegram
          </CardTitle>
          <CardDescription>
            Connect your Telegram account to receive notifications and interact
            with your AI assistant via Telegram.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {telegramStatus?.isLinked ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg bg-green-50 border-green-200">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-green-800">
                    Telegram Account Connected
                  </p>
                  {telegramStatus.userId && (
                    <p className="text-xs text-green-600">
                      {telegramStatus.userId}
                    </p>
                  )}
                  {telegramStatus.linkedAt && (
                    <p className="text-xs text-green-600">
                      Connected on{' '}
                      {new Date(telegramStatus.linkedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTelegramUnlink}
                >
                  <Unlink className="size-4 mr-2" />
                  Unlink
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Telegram Not Connected</p>
                  <p className="text-xs text-muted-foreground">
                    Link your Telegram account to get started
                  </p>
                </div>
                <Button
                  onClick={handleTelegramLink}
                  disabled={isLinking}
                  variant="outline"
                >
                  <ExternalLink className="size-4 mr-2" />
                  {isLinking ? 'Generating Link...' : 'Link Telegram'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Future integrations can be added here */}
      <Card>
        <CardHeader>
          <CardTitle>More Integrations</CardTitle>
          <CardDescription>
            Additional integrations will be available soon.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Stay tuned for more platform integrations like Discord, Slack, and
            more.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
