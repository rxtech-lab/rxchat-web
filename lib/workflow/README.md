# Workflow

A workflow is a type of execution engine that runs logic based on several conditions such as:

- Triggering runs on schedule or on demand
- Triggering runs when certain conditions are met (for example, when price reaches a certain point)
- Triggering runs via webhook

A node is the basic unit of the workflow that can be:

1. MCP Tools
2. Conditions
3. Triggers
4. Converters

## Node Relationship Constraints

**Important**: Different node types have different relationship constraints:

- **Regular nodes** (Tool, Converter, Trigger): Can only have **one parent and one child**
- **Conditional nodes**: Can have **multiple parents and multiple children**

This design ensures clear workflow execution paths while allowing conditional nodes to handle complex branching logic.

## MCP Tools

MCP tools contain logic including fetching external resources, and they provide both input and output (along with schema). Users can also customize the logic by uploading new tools to the MCP tools server. You can consider an MCP tool as a sandbox that only knows its input and output and has no other way to explore the whole workflow. This ensures the security of our workflow.

**Tool nodes can only have one parent and one child**, creating a linear execution flow.

## Conditional Node

This node takes multiple inputs from external sources and outputs the next node's ID along with the input for the next node. If it returns null, then the whole workflow exits.

**Conditional nodes are the only nodes that can have multiple parents and multiple children**, allowing for complex branching and merging logic. Only when all parent nodes have finished their work will the conditional node process and determine the next execution path.

## Triggers

Triggers are the entry point of the workflow and can either carry input and pass it down to their children or provide no input at all. **Trigger nodes can only have one child** (and no parents since they are entry points).

## Converter

This node converts input from one format to another. **Converter nodes can only have one parent and one child**, maintaining a linear data transformation flow.
