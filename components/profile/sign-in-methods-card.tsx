'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  CheckCircle2,
  Info,
  Mail,
  Plus,
  Shield,
  Smartphone,
  Trash2,
  Clock,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { registerPasskey, isWebAuthnSupported } from '@/lib/webauthn-client';
import { getUserPasskeys, deletePasskey } from '@/app/(chat)/profile/actions';
import { toast } from 'sonner';
import { PasskeyNameDialog } from './passkey-name-dialog';

/**
 * Sign-in method type definition
 */
interface SignInMethod {
  id: string;
  type: string;
  identifier: string;
  icon: React.ComponentType<{ className?: string }>;
  primary?: boolean;
  enabled?: boolean;
}

/**
 * Passkey type definition
 */
interface Passkey {
  id: string;
  name: string;
  createdAt: Date;
  lastUsed?: Date;
}

/**
 * Available sign-in method type definition
 */
interface AvailableMethod {
  id: string;
  type: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
  disabled?: boolean;
  loading?: boolean;
}

/**
 * Sign-in methods management component
 */
export function SignInMethodsCard() {
  const [isAdding, setIsAdding] = useState(false);
  const [addingMethod, setAddingMethod] = useState<'passkey' | 'email' | null>(
    null,
  );
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [isWebAuthnAvailable, setIsWebAuthnAvailable] = useState(false);
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [deletingPasskeyId, setDeletingPasskeyId] = useState<string | null>(
    null,
  );

  // Check WebAuthn support and load passkeys on mount
  useEffect(() => {
    setIsWebAuthnAvailable(isWebAuthnSupported());
    loadPasskeys();
  }, []);

  const loadPasskeys = async () => {
    try {
      const result = await getUserPasskeys();
      if (result.success && result.passkeys) {
        setPasskeys(result.passkeys);
      }
    } catch (error) {
      console.error('Failed to load passkeys:', error);
    }
  };

  const handleAddPasskey = () => {
    if (!isWebAuthnAvailable) {
      toast.error('Passkeys are not supported on this device');
      return;
    }

    setShowNameDialog(true);
  };

  const handlePasskeyNameConfirm = async (name: string) => {
    setIsAdding(true);
    setAddingMethod('passkey');

    try {
      const result = await registerPasskey(name);

      if (result.success) {
        toast.success(`Passkey "${name}" added successfully!`);
        await loadPasskeys(); // Reload passkeys after successful registration
        setShowNameDialog(false);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error('Passkey registration error:', error);
      toast.error('Failed to register passkey');
    } finally {
      setIsAdding(false);
      setAddingMethod(null);
    }
  };

  const handleNameDialogOpenChange = (open: boolean) => {
    setShowNameDialog(open);
    if (!open) {
      // Reset states when dialog is closed
      setIsAdding(false);
      setAddingMethod(null);
    }
  };

  const handleDeletePasskey = async (passkeyId: string) => {
    setDeletingPasskeyId(passkeyId);

    try {
      const passkeyToDelete = passkeys.find((p) => p.id === passkeyId);
      const passkeyName = passkeyToDelete?.name || 'this passkey';

      const confirm = window.confirm(
        `Are you sure you want to delete "${passkeyName}"? You won't be able to use it to sign in anymore.`,
      );
      if (!confirm) {
        return;
      }

      const result = await deletePasskey(passkeyId);

      if (result.success) {
        toast.success(`Passkey "${passkeyName}" deleted successfully`);
        await loadPasskeys(); // Reload passkeys after deletion
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error('Passkey deletion error:', error);
      toast.error('Failed to delete passkey');
    } finally {
      setDeletingPasskeyId(null);
    }
  };

  /**
   * Format date for display
   */
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  };

  /**
   * Format time for display
   */
  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)} hours ago`;
    } else if (diffInHours < 7 * 24) {
      const days = Math.floor(diffInHours / 24);
      return `${days} day${days > 1 ? 's' : ''} ago`;
    } else {
      return formatDate(date);
    }
  };

  // Current active sign-in methods
  const currentMethods: SignInMethod[] = [
    {
      id: 'email',
      type: 'Email & Password',
      identifier: 'Current password',
      icon: Mail,
      primary: true,
      enabled: true,
    },
    ...passkeys.map((passkey) => ({
      id: passkey.id,
      type: 'Passkey',
      identifier: passkey.name,
      icon: Smartphone,
      primary: false,
      enabled: true,
    })),
  ];

  // Available methods to add
  const availableMethods: AvailableMethod[] = [
    {
      id: 'passkey',
      type: 'Add Another Passkey',
      description: isWebAuthnAvailable
        ? `Add a passkey for another device (${passkeys.length} currently configured)`
        : 'Not supported on this device',
      icon: Smartphone,
      action: handleAddPasskey,
      disabled:
        !isWebAuthnAvailable || (isAdding && addingMethod === 'passkey'),
      loading: isAdding && addingMethod === 'passkey',
    },
  ];

  /**
   * Renders a current sign-in method item
   */
  const renderCurrentMethod = (method: SignInMethod) => {
    const IconComponent = method.icon;
    const isPasskey = method.type === 'Passkey';
    const isDeleting = deletingPasskeyId === method.id;
    const passkey = isPasskey ? passkeys.find((p) => p.id === method.id) : null;

    return (
      <div
        key={method.id}
        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
        data-testid={`current-method-${method.type}`}
      >
        <div className="flex items-center gap-3">
          <IconComponent className="size-5 text-muted-foreground" />
          <div className="flex-1">
            <p className="text-sm font-medium">{method.type}</p>
            <p className="text-xs text-muted-foreground">{method.identifier}</p>
            {passkey && (
              <div className="flex items-center gap-2 mt-1">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="size-3" />
                  {passkey.lastUsed
                    ? `Last used ${formatRelativeTime(passkey.lastUsed)}`
                    : `Created ${formatDate(passkey.createdAt)}`}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {method.primary && (
            <Badge variant="secondary" className="text-xs">
              Primary
            </Badge>
          )}
          {isPasskey && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDeletePasskey(method.id)}
              disabled={isDeleting}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              title={`Delete ${method.identifier}`}
            >
              <Trash2 className="size-4" />
              {isDeleting && <span className="ml-1 text-xs">Deleting...</span>}
            </Button>
          )}
          <CheckCircle2 className="size-4 text-green-500" />
        </div>
      </div>
    );
  };

  /**
   * Renders an available sign-in method item
   */
  const renderAvailableMethod = (method: AvailableMethod) => {
    const IconComponent = method.icon;
    return (
      <div
        key={method.id}
        className="flex items-center justify-between p-4 border rounded-lg border-dashed hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <IconComponent className="size-5 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">{method.type}</p>
            <p className="text-xs text-muted-foreground">
              {method.description}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={method.action}
          disabled={method.disabled}
          data-testid={`add-${method.id}-button`}
        >
          {method.loading ? (
            <>Adding...</>
          ) : (
            <>
              <Plus className="size-4 mr-1" />
              Add
            </>
          )}
        </Button>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="size-5" />
          Sign-in Methods
        </CardTitle>
        <CardDescription>
          Manage how you sign into your account. You can add multiple passkeys
          for different devices.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Methods */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Current Methods</h4>
            {passkeys.length > 0 && (
              <Badge variant="outline" className="text-xs">
                {passkeys.length} passkey{passkeys.length > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          <div className="space-y-3">
            {currentMethods.map(renderCurrentMethod)}
          </div>
        </div>

        {/* Add New Method */}
        {availableMethods.length > 0 && isWebAuthnAvailable && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Add New Method</h4>
            <div className="grid gap-3">
              {availableMethods.map(renderAvailableMethod)}
            </div>
          </div>
        )}

        {/* Info Alert */}
        <Alert>
          <Info className="size-4" />
          <AlertDescription>
            {isWebAuthnAvailable ? (
              <>
                You can add unlimited passkeys for all your devices (computer,
                phone, security key). Each device you use regularly should have
                its own passkey for convenient and secure access.
              </>
            ) : (
              'Passkeys require a compatible device with biometric authentication or security keys.'
            )}
          </AlertDescription>
        </Alert>
      </CardContent>

      {/* Passkey Name Dialog */}
      <PasskeyNameDialog
        open={showNameDialog}
        onOpenChange={handleNameDialogOpenChange}
        onConfirm={handlePasskeyNameConfirm}
        isLoading={isAdding}
      />
    </Card>
  );
}
