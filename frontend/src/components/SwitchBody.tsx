import { PlusIcon } from '@radix-ui/react-icons';
import { Flex, IconButton } from '@radix-ui/themes';

import { BranchInput } from './BranchInput.tsx';

interface SwitchBodyProps {
  branches: string[];
  onBranchesChange: (newBranches: string[], deletedIndex?: number) => void;
}

export const SwitchBody = ({ branches, onBranchesChange }: SwitchBodyProps) => {
  const handleAddBranch = () => {
    const newBranches = [...branches, ''];
    onBranchesChange(newBranches);
  };

  const handleUpdateBranch = (index: number, newValue: string) => {
    const newBranches = [...branches];
    newBranches[index] = newValue;
    onBranchesChange(newBranches);
  };

  const handleDeleteBranch = (index: number) => {
    const newBranches = branches.filter((_: string, i: number) => i !== index);
    onBranchesChange(newBranches, index);
  };

  return (
    <Flex direction="column" gap="2">
      {branches.length > 0 && (
        <Flex direction="column" gap="2">
          {branches.map((branch: string, i: number) => (
            <BranchInput
              key={i}
              value={branch}
              onChange={val => handleUpdateBranch(i, val)}
              onDelete={() => handleDeleteBranch(i)}
              enableValidation={true}
            />
          ))}
        </Flex>
      )}

      <Flex gap="2" align="center" style={{ marginLeft: 16, height: 32 }}>
        <IconButton onClick={handleAddBranch} size="1" variant="ghost" color="gray">
          <PlusIcon />
        </IconButton>
      </Flex>
    </Flex>
  );
};
