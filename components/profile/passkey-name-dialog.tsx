'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Smartphone, Monitor, Laptop, Key } from 'lucide-react';

interface PasskeyNameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (name: string) => void;
  isLoading?: boolean;
}

/**
 * Get device type suggestion based on user agent
 */
function getDeviceTypeSuggestion() {
  if (typeof window === 'undefined') return 'Device';

  const userAgent = navigator.userAgent.toLowerCase();
  const platform = navigator.platform?.toLowerCase() || '';

  // Mobile devices
  if (/android/.test(userAgent)) return 'Android Phone';
  if (/iphone|ipod/.test(userAgent)) return 'iPhone';
  if (/ipad/.test(userAgent)) return 'iPad';

  // Desktop/Laptop
  if (/macintosh|mac os x/.test(userAgent)) {
    if (/mobile/.test(userAgent)) return 'Mac (Mobile)';
    return 'Mac';
  }
  if (/windows/.test(userAgent) || /win32|win64/.test(platform))
    return 'Windows PC';
  if (/linux/.test(userAgent) || /linux/.test(platform))
    return 'Linux Computer';
  if (/chrome os/.test(userAgent)) return 'Chromebook';

  // Fallback
  return 'This Device';
}

/**
 * Get device icon based on device type
 */
function getDeviceIcon(deviceName: string) {
  const name = deviceName.toLowerCase();
  if (/phone|android|iphone/.test(name)) return Smartphone;
  if (/ipad|tablet/.test(name)) return Smartphone;
  if (/mac|laptop|book/.test(name)) return Laptop;
  if (/pc|windows|linux|computer/.test(name)) return Monitor;
  return Key;
}

/**
 * Generate device name suggestions
 */
function getDeviceNameSuggestions() {
  const deviceType = getDeviceTypeSuggestion();
  const currentDate = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  return [
    deviceType,
    `My ${deviceType}`,
    `${deviceType} - ${currentDate}`,
    'Work Device',
    'Personal Device',
    'Security Key',
  ];
}

/**
 * Dialog for naming a passkey during registration
 */
export function PasskeyNameDialog({
  open,
  onOpenChange,
  onConfirm,
  isLoading = false,
}: PasskeyNameDialogProps) {
  const [name, setName] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      const deviceSuggestions = getDeviceNameSuggestions();
      setSuggestions(deviceSuggestions);
      setName(deviceSuggestions[0]); // Pre-fill with the first suggestion
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onConfirm(name.trim());
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!isLoading) {
      onOpenChange(newOpen);
      if (!newOpen) {
        setName('');
      }
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setName(suggestion);
  };

  const IconComponent = getDeviceIcon(name);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconComponent className="size-5" />
            Name Your Passkey
          </DialogTitle>
          <DialogDescription>
            Give your passkey a memorable name to help you identify this device
            later. You can add multiple passkeys for different devices.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="passkey-name">Passkey Name</Label>
            <Input
              id="passkey-name"
              placeholder="e.g., My MacBook, iPhone Touch ID"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              disabled={isLoading}
              maxLength={50}
            />
            <p className="text-xs text-muted-foreground">
              Choose a name that helps you remember which device this passkey is
              for.
            </p>
          </div>

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Suggestions:
              </Label>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((suggestion) => (
                  <Badge
                    key={suggestion}
                    variant={name === suggestion ? 'default' : 'outline'}
                    className="cursor-pointer hover:bg-muted transition-colors"
                    onClick={() => handleSuggestionClick(suggestion)}
                  >
                    {suggestion}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <DialogFooter className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || isLoading}
              data-testid="passkey-name-dialog-create-button"
            >
              {isLoading ? 'Adding Passkey...' : 'Add Passkey'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
