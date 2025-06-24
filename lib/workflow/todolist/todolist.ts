import type { TodoItem } from '../types';
import { v4 as uuidv4 } from 'uuid';

export class TodoList {
  items: TodoItem[] = [];

  /**
   * Adds multiple todo items to the list, generating a unique id for each.
   * @param items - Array of todo items without ids.
   */
  addItems(items: Omit<TodoItem, 'id'>[]) {
    const newItems = items.map((item) => ({
      ...item,
      id: uuidv4(),
    }));
    this.items.push(...newItems);
  }

  markAsCompleted(itemId: string) {
    const item = this.items.find((item) => item.id === itemId);
    if (item) {
      item.completed = true;
    }
  }

  markAsCompletedByIndex(index: number) {
    const item = this.items[index];
    if (item) {
      item.completed = true;
    }
  }

  deleteItem(itemId: string) {
    this.items = this.items.filter((item) => item.id !== itemId);
  }

  /**
   * Returns the todo list as a markdown-formatted string with [ ] and [x] checkboxes and emoji.
   * Example:
   * - ✅ Task 1
   * - ❌ Task 2
   */
  toViewableString() {
    if (this.items.length === 0) {
      return 'No todo items';
    }

    return this.items
      .map((item) => `${item.completed ? '✅' : '❌'} ${item.title}`)
      .join('\n');
  }

  /**
   * Returns the todo list as an object with items and completion tracking for collapsible display
   */
  toViewableObject() {
    const completedCount = this.items.filter((item) => item.completed).length;
    const totalCount = this.items.length;

    return {
      items: this.items,
      completedCount,
      totalCount,
    };
  }

  /**
   * Returns completion count string (e.g., "2/4" for 2 completed out of 4 total)
   */
  getCompletionCount() {
    const completedCount = this.items.filter((item) => item.completed).length;
    const totalCount = this.items.length;
    return `${completedCount}/${totalCount}`;
  }
}
