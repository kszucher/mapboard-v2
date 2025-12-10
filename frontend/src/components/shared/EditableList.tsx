import { PlusIcon } from '@radix-ui/react-icons';
import { Flex, IconButton } from '@radix-ui/themes';
import type { ReactNode } from 'react';

export interface ItemHandlers {
  onUpdate: (newValue: string) => void;
  onDelete: () => void;
}

interface EditableListProps {
  items: string[];
  onItemsChange: (items: string[], deletedIndex?: number) => void;
  renderItem: (item: string, index: number, handlers: ItemHandlers) => ReactNode;
}

export const EditableList = ({
                               items,
                               onItemsChange,
                               renderItem,
                             }: EditableListProps) => {
  const handleAddItem = () => {
    const newItems = [...items, ''];
    onItemsChange(newItems);
  };

  const handleUpdateItem = (index: number, newValue: string) => {
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
