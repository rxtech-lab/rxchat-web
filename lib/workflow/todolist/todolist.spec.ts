import { v4 as uuidv4 } from 'uuid';
import { TodoList } from './todolist';
import type { TodoItem } from '../types';

describe('TodoList', () => {
  let todoList: TodoList;

  beforeEach(() => {
    todoList = new TodoList();
  });

  describe('constructor', () => {
    it('should initialize with empty items array', () => {
      expect(todoList.items).toEqual([]);
    });
  });

  describe('addItems', () => {
    it('should add single item with generated id', () => {
      const itemsToAdd = [{ title: 'Test task', completed: false }];

      todoList.addItems(itemsToAdd);

      expect(todoList.items).toHaveLength(1);
      expect(todoList.items[0]).toMatchObject({
        title: 'Test task',
        completed: false,
      });
      expect(todoList.items[0].id).toBeDefined();
      expect(typeof todoList.items[0].id).toBe('string');
    });

    it('should add multiple items with unique generated ids', () => {
      const itemsToAdd = [
        { title: 'Task 1', completed: false },
        { title: 'Task 2', completed: true },
        { title: 'Task 3', completed: false },
      ];

      todoList.addItems(itemsToAdd);

      expect(todoList.items).toHaveLength(3);
      expect(todoList.items[0].title).toBe('Task 1');
      expect(todoList.items[1].title).toBe('Task 2');
      expect(todoList.items[2].title).toBe('Task 3');

      const ids = todoList.items.map((item) => item.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(3);
    });

    it('should append items to existing list', () => {
      const firstBatch = [{ title: 'First task', completed: false }];
      const secondBatch = [{ title: 'Second task', completed: true }];

      todoList.addItems(firstBatch);
      todoList.addItems(secondBatch);

      expect(todoList.items).toHaveLength(2);
      expect(todoList.items[0].title).toBe('First task');
      expect(todoList.items[1].title).toBe('Second task');
    });

    it('should handle empty array', () => {
      todoList.addItems([]);

      expect(todoList.items).toHaveLength(0);
    });
  });

  describe('markAsCompleted', () => {
    beforeEach(() => {
      todoList.addItems([
        { title: 'Task 1', completed: false },
        { title: 'Task 2', completed: false },
      ]);
    });

    it('should mark existing item as completed by id', () => {
      const itemId = todoList.items[0].id;

      todoList.markAsCompleted(itemId);

      expect(todoList.items[0].completed).toBe(true);
      expect(todoList.items[1].completed).toBe(false);
    });

    it('should not affect items when id does not exist', () => {
      const nonExistentId = uuidv4();

      todoList.markAsCompleted(nonExistentId);

      expect(todoList.items[0].completed).toBe(false);
      expect(todoList.items[1].completed).toBe(false);
    });

    it('should handle empty string id', () => {
      todoList.markAsCompleted('');

      expect(todoList.items[0].completed).toBe(false);
      expect(todoList.items[1].completed).toBe(false);
    });
  });

  describe('markAsCompletedByIndex', () => {
    beforeEach(() => {
      todoList.addItems([
        { title: 'Task 1', completed: false },
        { title: 'Task 2', completed: false },
        { title: 'Task 3', completed: false },
      ]);
    });

    it('should mark item as completed by index', () => {
      todoList.markAsCompletedByIndex(1);

      expect(todoList.items[0].completed).toBe(false);
      expect(todoList.items[1].completed).toBe(true);
      expect(todoList.items[2].completed).toBe(false);
    });

    it('should handle first index', () => {
      todoList.markAsCompletedByIndex(0);

      expect(todoList.items[0].completed).toBe(true);
    });

    it('should handle last index', () => {
      todoList.markAsCompletedByIndex(2);

      expect(todoList.items[2].completed).toBe(true);
    });

    it('should not affect items when index is out of bounds', () => {
      todoList.markAsCompletedByIndex(5);

      expect(todoList.items.every((item) => !item.completed)).toBe(true);
    });

    it('should handle negative index', () => {
      todoList.markAsCompletedByIndex(-1);

      expect(todoList.items.every((item) => !item.completed)).toBe(true);
    });
  });

  describe('deleteItem', () => {
    beforeEach(() => {
      todoList.addItems([
        { title: 'Task 1', completed: false },
        { title: 'Task 2', completed: true },
        { title: 'Task 3', completed: false },
      ]);
    });

    it('should delete item by id', () => {
      const itemToDelete = todoList.items[1];

      todoList.deleteItem(itemToDelete.id);

      expect(todoList.items).toHaveLength(2);
      expect(
        todoList.items.find((item) => item.id === itemToDelete.id),
      ).toBeUndefined();
      expect(todoList.items[0].title).toBe('Task 1');
      expect(todoList.items[1].title).toBe('Task 3');
    });

    it('should not affect items when id does not exist', () => {
      const nonExistentId = uuidv4();
      const originalLength = todoList.items.length;

      todoList.deleteItem(nonExistentId);

      expect(todoList.items).toHaveLength(originalLength);
    });

    it('should handle empty string id', () => {
      const originalLength = todoList.items.length;

      todoList.deleteItem('');

      expect(todoList.items).toHaveLength(originalLength);
    });

    it('should delete all items when called multiple times', () => {
      const itemIds = todoList.items.map((item) => item.id);

      itemIds.forEach((id) => todoList.deleteItem(id));

      expect(todoList.items).toHaveLength(0);
    });
  });

  describe('toViewableString', () => {
    it('should return "No todo items" when list is empty', () => {
      expect(todoList.toViewableString()).toBe('No todo items');
    });

    it('should format single incomplete item', () => {
      todoList.addItems([{ title: 'Buy groceries', completed: false }]);

      expect(todoList.toViewableString()).toBe('❌ Buy groceries');
    });

    it('should format single completed item', () => {
      todoList.addItems([{ title: 'Buy groceries', completed: true }]);

      expect(todoList.toViewableString()).toBe('✅ Buy groceries');
    });

    it('should format multiple mixed items', () => {
      todoList.addItems([
        { title: 'Buy groceries', completed: true },
        { title: 'Walk the dog', completed: false },
        { title: 'Read book', completed: true },
      ]);

      const expected = '✅ Buy groceries\n❌ Walk the dog\n✅ Read book';
      expect(todoList.toViewableString()).toBe(expected);
    });

    it('should handle items with special characters', () => {
      todoList.addItems([
        { title: 'Task with "quotes" & symbols', completed: false },
      ]);

      expect(todoList.toViewableString()).toBe(
        '❌ Task with "quotes" & symbols',
      );
    });
  });

  describe('toViewableObject', () => {
    it('should return correct object for empty list', () => {
      const result = todoList.toViewableObject();

      expect(result).toEqual({
        items: [],
        completedCount: 0,
        totalCount: 0,
      });
    });

    it('should return correct object with mixed completion status', () => {
      todoList.addItems([
        { title: 'Task 1', completed: true },
        { title: 'Task 2', completed: false },
        { title: 'Task 3', completed: true },
        { title: 'Task 4', completed: false },
      ]);

      const result = todoList.toViewableObject();

      expect(result.items).toHaveLength(4);
      expect(result.completedCount).toBe(2);
      expect(result.totalCount).toBe(4);
      expect(result.items[0].title).toBe('Task 1');
      expect(result.items[0].completed).toBe(true);
    });

    it('should return correct object with all items completed', () => {
      todoList.addItems([
        { title: 'Task 1', completed: true },
        { title: 'Task 2', completed: true },
      ]);

      const result = todoList.toViewableObject();

      expect(result.completedCount).toBe(2);
      expect(result.totalCount).toBe(2);
    });

    it('should return correct object with no items completed', () => {
      todoList.addItems([
        { title: 'Task 1', completed: false },
        { title: 'Task 2', completed: false },
      ]);

      const result = todoList.toViewableObject();

      expect(result.completedCount).toBe(0);
      expect(result.totalCount).toBe(2);
    });
  });

  describe('getCompletionCount', () => {
    it('should return "0/0" for empty list', () => {
      expect(todoList.getCompletionCount()).toBe('0/0');
    });

    it('should return correct count with no completed items', () => {
      todoList.addItems([
        { title: 'Task 1', completed: false },
        { title: 'Task 2', completed: false },
      ]);

      expect(todoList.getCompletionCount()).toBe('0/2');
    });

    it('should return correct count with some completed items', () => {
      todoList.addItems([
        { title: 'Task 1', completed: true },
        { title: 'Task 2', completed: false },
        { title: 'Task 3', completed: true },
      ]);

      expect(todoList.getCompletionCount()).toBe('2/3');
    });

    it('should return correct count with all completed items', () => {
      todoList.addItems([
        { title: 'Task 1', completed: true },
        { title: 'Task 2', completed: true },
      ]);

      expect(todoList.getCompletionCount()).toBe('2/2');
    });

    it('should update count after marking items as completed', () => {
      todoList.addItems([
        { title: 'Task 1', completed: false },
        { title: 'Task 2', completed: false },
      ]);

      expect(todoList.getCompletionCount()).toBe('0/2');

      todoList.markAsCompletedByIndex(0);
      expect(todoList.getCompletionCount()).toBe('1/2');

      todoList.markAsCompletedByIndex(1);
      expect(todoList.getCompletionCount()).toBe('2/2');
    });

    it('should update count after deleting items', () => {
      todoList.addItems([
        { title: 'Task 1', completed: true },
        { title: 'Task 2', completed: false },
      ]);

      expect(todoList.getCompletionCount()).toBe('1/2');

      todoList.deleteItem(todoList.items[0].id);
      expect(todoList.getCompletionCount()).toBe('0/1');
    });
  });

  describe('integration tests', () => {
    it('should handle complex workflow', () => {
      todoList.addItems([
        { title: 'Setup project', completed: false },
        { title: 'Write tests', completed: false },
        { title: 'Implement features', completed: false },
      ]);

      expect(todoList.getCompletionCount()).toBe('0/3');

      todoList.markAsCompletedByIndex(0);
      expect(todoList.getCompletionCount()).toBe('1/3');
      expect(todoList.toViewableString()).toContain('✅ Setup project');

      todoList.deleteItem(todoList.items[1].id);
      expect(todoList.items).toHaveLength(2);
      expect(todoList.getCompletionCount()).toBe('1/2');

      todoList.addItems([{ title: 'Deploy to production', completed: false }]);
      expect(todoList.getCompletionCount()).toBe('1/3');
    });
  });
});
