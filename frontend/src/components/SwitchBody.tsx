import { PlusIcon } from '@radix-ui/react-icons';
import { Flex, IconButton } from '@radix-ui/themes';
import type { Id } from '../../../convex/convex/_generated/dataModel';
import { BranchInput } from './BranchInput.tsx';

interface SwitchBodyProps {
  nodeId: Id<'nodes'>;
  // inputValue might be legacy, focusing on inputTextsSecondary which stores branches now
  inputValue: any;
  inputTextsSecondary?: string[];
  updateNode: (args: { nodeId: Id<'nodes'>; patch: any }) => void;
  isLogicalSwitch?: boolean;
}

export const SwitchBody = ({
  nodeId,
  inputValue,
  inputTextsSecondary,
  updateNode,
  isLogicalSwitch,
}: SwitchBodyProps) => {
  const branches = inputTextsSecondary ?? (Array.isArray(inputValue?.branches) ? inputValue.branches : []);

  const handleAddBranch = () => {
    const newBranches = [...branches, ''];

    updateNode({
      nodeId,
      patch: {
        inputTextsSecondary: newBranches,
        numHandles: newBranches.length,
      },
    });
  };

  const handleUpdateBranch = (index: number, newValue: string) => {
    const newBranches = [...branches];
    newBranches[index] = newValue;
    updateNode({
      nodeId,
      patch: {
        inputTextsSecondary: newBranches,
      },
    });
  };

  const handleDeleteBranch = (index: number) => {
    const newBranches = branches.filter((_: string, i: number) => i !== index);
    updateNode({
      nodeId,
      patch: {
        inputTextsSecondary: newBranches,
        numHandles: newBranches.length,
      },
    });
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
              enableValidation={isLogicalSwitch}
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
