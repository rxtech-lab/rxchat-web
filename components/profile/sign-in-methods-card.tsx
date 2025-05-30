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
        toast.success(result.message);
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
      const confirm = window.confirm(
        'Are you sure you want to delete this passkey?',
      );
      if (!confirm) {
        return;
      }
      // We'll implement this server action next
      const result = await deletePasskey(passkeyId);

      if (result.success) {
        toast.success('Passkey deleted successfully');
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
      type: 'Passkey',
      description: isWebAuthnAvailable
        ? "Use your device's biometric authentication"
        : 'Not supported on this device',
      icon: Smartphone,
      action: handleAddPasskey,
      disabled:
        !isWebAuthnAvailable || (isAdding && addingMethod === 'passkey'),
      loading: isAdding && addingMethod === 'passkey',
    },
    // You can easily add more methods here
    // {
    //   id: 'backup-email',
    //   type: 'Backup Email',
    //   description: 'Add a secondary email address',
    //   icon: Mail,
    //   action: handleAddEmail,
    //   disabled: isAdding && addingMethod === 'email',
    //   loading: isAdding && addingMethod === 'email',
    // },
  ];

  /**
   * Renders a current sign-in method item
   */
  const renderCurrentMethod = (method: SignInMethod) => {
    const IconComponent = method.icon;
    const isPasskey = method.type === 'Passkey';
    const isDeleting = deletingPasskeyId === method.id;

    return (
      <div
        key={method.id}
        className="flex items-center justify-between p-3 border rounded-lg"
      >
        <div className="flex items-center gap-3">
          <IconComponent className="size-5 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">{method.type}</p>
            <p className="text-xs text-muted-foreground">{method.identifier}</p>
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
            >
              <Trash2 className="size-4" />
              {isDeleting && <span className="ml-1">Deleting...</span>}
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
        className="flex items-center justify-between p-3 border rounded-lg"
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
          Manage how you sign into your account. Add additional methods for
          better security.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Methods */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Current Methods</h4>
          <div className="space-y-3">
            {currentMethods.map(renderCurrentMethod)}
          </div>
        </div>

        {/* Add New Method */}
        {availableMethods.length > 0 && (
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
            Additional sign-in methods help secure your account and provide
            backup access options.{' '}
            {!isWebAuthnAvailable &&
              'Passkeys require a compatible device with biometric authentication.'}
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
