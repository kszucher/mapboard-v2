import { PlusIcon } from '@radix-ui/react-icons';
import { Flex, IconButton } from '@radix-ui/themes';
import type { ReactNode } from 'react';

export interface ItemHandlers<T = string> {
  onUpdate: (newValue: T) => void;
  onDelete: () => void;
}

interface EditableListProps<T> {
  items: T[];
  onItemsChange: (items: T[], deletedIndex?: number) => void;
  renderItem: (item: T, index: number, handlers: ItemHandlers<T>) => ReactNode;
  createNewItem: () => T;
}

export const EditableList = <T,>({
  items,
  onItemsChange,
  renderItem,
  createNewItem,
}: EditableListProps<T>) => {
  const handleAddItem = () => {
    const newItems = [...items, createNewItem()];
    onItemsChange(newItems);
  };

  const handleUpdateItem = (index: number, newValue: T) => {
    const newItems = [...items];
    newItems[index] = newValue;
    onItemsChange(newItems);
  };

  const handleDeleteItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    onItemsChange(newItems, index);
  };

  return (
    <Flex direction="column" gap="2">
      {items.length > 0 && (
        <Flex direction="column" gap="2">
          {items.map((item, i) =>
            renderItem(item, i, {
              onUpdate: (newValue) => handleUpdateItem(i, newValue),
              onDelete: () => handleDeleteItem(i),
            }),
          )}
        </Flex>
      )}

      <Flex gap="2" align="center" style={{ marginLeft: 16, height: 32 }}>
        <IconButton onClick={handleAddItem} size="1" variant="ghost" color="gray">
          <PlusIcon />
        </IconButton>
      </Flex>
    </Flex>
  );
};
