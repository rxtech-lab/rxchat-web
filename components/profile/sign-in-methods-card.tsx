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
} from 'lucide-react';
import { useState } from 'react';

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
  ];

  const handleAddPasskey = async () => {
    setIsAdding(true);
    setAddingMethod('passkey');

    // Simulate passkey registration (no actual implementation)
    setTimeout(() => {
      setIsAdding(false);
      setAddingMethod(null);
      // Show success message or add to list
    }, 2000);
  };

  const handleAddEmail = () => {
    setAddingMethod('email');
    // This would typically open a form or redirect to add secondary email
  };

  // Available methods to add
  const availableMethods: AvailableMethod[] = [
    {
      id: 'passkey',
      type: 'Passkey',
      description: "Use your device's biometric authentication",
      icon: Smartphone,
      action: handleAddPasskey,
      disabled: isAdding && addingMethod === 'passkey',
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
            backup access options. Passkey functionality is coming soon.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
