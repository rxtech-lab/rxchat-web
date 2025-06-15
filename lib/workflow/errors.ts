import zodToJsonSchema from 'zod-to-json-schema';
import { UserContextSchema } from '../types';

export class WorkflowEngineError extends Error {
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, WorkflowEngineError.prototype);
    this.name = 'WorkflowEngineError';
  }
}

export class WorkflowInputOutputMismatchError extends WorkflowEngineError {
  errors: string[];
  suggestions: string[];
  constructor(errors: string[], suggestions: string[]) {
    super(
      `Input and output mismatch: ${errors.join(', ')}. Suggestions: ${suggestions.join(', ')}`,
    );
    Object.setPrototypeOf(this, WorkflowInputOutputMismatchError.prototype);
    this.name = 'WorkflowInputOutputMismatchError';
    this.errors = errors;
    this.suggestions = suggestions;
  }
}

export class WorkflowToolMissingError extends WorkflowEngineError {
  private missingTools: string[];
  constructor(missingTools: string[]) {
    super(
      `Tools missing: ${missingTools.join(', ')}. Please check if the tools are available in the MCP Router.`,
    );
    Object.setPrototypeOf(this, WorkflowToolMissingError.prototype);
    this.name = 'WorkflowToolMissingError';
    this.missingTools = missingTools;
  }

  getMissingTools(): string[] {
    return this.missingTools;
  }
}

export class WorkflowReferenceError extends WorkflowEngineError {
  field: 'input' | 'context';
  reference: string;

  /**
   * Create a new WorkflowReferenceError.
   *
   * @param field - The field that is referenced.
   * @param reference - The reference that is not found. Can be nested object like 'input.user.name'.
   */
  constructor(field: 'input' | 'context', reference: string) {
    super(
      `Reference to non existing ${field}: ${reference}. Please check if the ${field} is available in the workflow.`,
    );
    Object.setPrototypeOf(this, WorkflowReferenceError.prototype);
    this.name = 'WorkflowReferenceError';
    this.field = field;
    this.reference = reference;
  }

  private getDescriptionForField(jsonSchema: any): any {
    if (!jsonSchema || !this.reference) {
      return null;
    }

    // Split the reference by dots to handle nested properties like 'input.user.name'
    const fieldParts = this.reference.split('.');
    let currentSchema = jsonSchema;

    // Traverse the schema recursively for each part of the reference
    for (const fieldPart of fieldParts) {
      // Check if current schema has properties
      if (!currentSchema.properties || !currentSchema.properties[fieldPart]) {
        return null;
      }

      // Move to the next level of the schema
      currentSchema = currentSchema.properties[fieldPart];

      // If this is an object type, we might need to go deeper
      if (currentSchema.type === 'object' && currentSchema.properties) {
        // Continue with the current schema for the next iteration
        continue;
      }
    }

    return currentSchema;
  }

  get humanReadableMessage(): string {
    if (this.field === 'context') {
      const jsonSchema = zodToJsonSchema(UserContextSchema);
      const fieldSchema = this.getDescriptionForField(jsonSchema);

      if (fieldSchema) {
        return `Missing field '${this.reference}': ${fieldSchema.description}. You can go to my account tab to set it.`;
      }
    }

    return `Please check if the ${this.field} field '${this.reference}' should be passed by its parent node but not. Call AI to fix it.`;
  }

  private getAvailableProperties(jsonSchema: any, reference: string): string[] {
    if (!jsonSchema || !jsonSchema.properties) {
      return [];
    }

    // Get the parent path for nested references
    const referenceParts = reference.split('.');
    const parentPath = referenceParts.slice(0, -1);

    let currentSchema = jsonSchema;

    // Navigate to the parent object
    for (const part of parentPath) {
      if (currentSchema.properties?.[part]) {
        currentSchema = currentSchema.properties[part];
      } else {
        return Object.keys(jsonSchema.properties);
      }
    }

    // Return available properties at the current level
    if (currentSchema.properties) {
      return Object.keys(currentSchema.properties);
    }

    return [];
  }
}
