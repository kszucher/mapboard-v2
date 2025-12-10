import { BranchInput } from './BranchInput.tsx';
import { EditableList } from './shared/EditableList.tsx';

interface SwitchBodyProps {
  branches: string[];
  onBranchesChange: (newBranches: string[], deletedIndex?: number) => void;
}

export const SwitchBody = ({ branches, onBranchesChange }: SwitchBodyProps) => {
  return (
    <EditableList
      items={branches}
      onItemsChange={onBranchesChange}
      renderItem={(branch, index, { onUpdate, onDelete }) => (
        <BranchInput
          key={index}
          value={branch}
          onChange={onUpdate}
          onDelete={onDelete}
          enableValidation={true}
        />
      )}
    />
  );
};
