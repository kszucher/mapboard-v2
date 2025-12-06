import { Cross2Icon, DotsHorizontalIcon, PlusIcon } from '@radix-ui/react-icons';
import { Badge, Box, DropdownMenu, Flex, IconButton, TextField } from '@radix-ui/themes';
import { Handle, type NodeProps, Position, useUpdateNodeInternals } from '@xyflow/react';
import { useMutation } from 'convex/react';
import { memo, useEffect, useRef } from 'react';
import { api } from '../../../convex/convex/_generated/api';
import type { AppFlowNode } from './types.ts';

import { useState } from 'react';
import type { Id } from '../../../convex/convex/_generated/dataModel';

interface BranchInputProps {
  value: string;
  onChange: (newValue: string) => void;
  onDelete: () => void;
}

const BranchInput = ({ value, onChange, onDelete }: BranchInputProps) => {
  const [localValue, setLocalValue] = useState(value);

  // Sync prop changes (if external update happens)
  // Optimization: Only sync if not focused? Or rely on simple diff?
  // For now simple: if value prop changes and diff from local, sync, but careful with cursor.
  // Actually, usually value prop changes come from us.

  // If we want fully controlled but performant:
  // We initialize local state. We push up on blur. 
  // Should we sync down? If backend changes (another user)? Yes.
  // If we type, local updates. Prop doesn't update until blur.
  // So standard 'Draft State' pattern.

  return (
    <Flex gap="2" align="center" style={{ marginLeft: 16 }}>
      <TextField.Root
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={() => {
          if (localValue !== value) {
            onChange(localValue);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.currentTarget.blur(); // Trigger blur to save
          }
        }}
        style={{ flexGrow: 1, boxShadow: 'none' }}
      />
      <IconButton onClick={onDelete} size="1" variant="ghost" color="gray">
        <Cross2Icon />
      </IconButton>
    </Flex>
  );
};

interface SwitchNodeContentProps {
  nodeId: Id<'nodes'>;
  inputValue: any;
  updateNode: (args: { nodeId: Id<'nodes'>; patch: any }) => void;
}

const SwitchNodeContent = ({ nodeId, inputValue, updateNode }: SwitchNodeContentProps) => {
  /* REMOVED branchInput state */
  const branches = Array.isArray(inputValue?.branches) ? inputValue.branches : [];

  const instruction = inputValue?.instruction || '';

  const handleAddBranch = () => {
    // Just add an empty branch
    const newBranches = [...branches, ""];

    updateNode({
      nodeId,
      patch: {
        inputValue: {
          ...inputValue,
          instruction: localInstruction,
          branches: newBranches
        },
        numHandles: newBranches.length
      }
    });
  };

  const handleUpdateBranch = (index: number, newValue: string) => {
    const newBranches = [...branches];
    newBranches[index] = newValue;
    updateNode({
      nodeId,
      patch: {
        inputValue: {
          ...inputValue,
          instruction: localInstruction,
          branches: newBranches
        },
        // numHandles doesn't change here
      }
    });
  };

  const handleDeleteBranch = (index: number) => {
    const newBranches = branches.filter((_: string, i: number) => i !== index);
    updateNode({
      nodeId,
      patch: {
        inputValue: {
          ...inputValue,
          instruction: localInstruction,
          branches: newBranches
        },
        numHandles: newBranches.length
      }
    });
  };


  // We use local state for instruction to avoid stutter, but sync on blur
  const [localInstruction, setLocalInstruction] = useState(instruction);

  return (
    <Flex direction="column" gap="2">
      <TextField.Root
        placeholder="Instruction / Condition"
        value={localInstruction}
        onChange={(e) => setLocalInstruction(e.target.value)}
        onBlur={() => {
          if (localInstruction !== instruction) {
            updateNode({
              nodeId,
              patch: {
                inputValue: { ...inputValue, instruction: localInstruction, branches }
              }
            });
          }
        }}
        style={{ boxShadow: 'none' }}
      />

      {branches.length > 0 && (
        <Flex direction="column" gap="2">
          {branches.map((branch: string, i: number) => (
            <BranchInput
              key={i}
              value={branch}
              onChange={(val) => handleUpdateBranch(i, val)}
              onDelete={() => handleDeleteBranch(i)}
            />
          ))}
        </Flex>
      )}

      <Flex gap="2" align="center" style={{ marginLeft: 16 }}>
        <IconButton onClick={handleAddBranch} size="1" variant="ghost" color="gray">
          <PlusIcon />
        </IconButton>
      </Flex>
    </Flex>
  );
};

const CustomNodeComponent = ({ data, id }: NodeProps<AppFlowNode>) => {
  const deleteNode = useMutation(api.nodes.deleteNode);
  const updateNode = useMutation(api.nodes.updateNode);
  const updateNodeInternals = useUpdateNodeInternals();

  useEffect(() => {
    updateNodeInternals(id);
  }, [data.node.numHandles, data.node.nodeType, id, updateNodeInternals]);


  if (!data) return null;

  const renderCount = useRef(0);
  renderCount.current++;

  console.log('ACTUAL RENDER:', renderCount.current, data.node._id);

  const isSwitch = data.node.nodeType === 'LOGICAL_SWITCH' || data.node.nodeType === 'AGENTIC_SWITCH';

  // Standard Node Defaults
  let SPACING = 24;
  let BASE_OFFSET = 50;
  let LEFT_HANDLE_OFFSET: number | undefined = undefined;

  // Switch Node Overrides
  // Container Padding (12) + MarginTop (38) + Instruction Height (32) + Gap (8) = 90px (Top of first branch)
  // Center of first branch = 90 + 16 = 106px
  // Spacing = Height (32) + Gap (8) = 40px
  // Center of Instruction = 12 + 38 + 16 = 66px
  if (isSwitch) {
    SPACING = 40;
    BASE_OFFSET = 106;
    LEFT_HANDLE_OFFSET = 66;
  }

  return (
    <div
      style={{
        background: '#222222',
        borderRadius: 16,
        padding: 12,
        minWidth: 200,
        minHeight: 80,
      }}
    >
      <Box position="absolute" top="8px" left="8px">
        <Flex direction="row" gap="4px" align="center">
          <Badge color={'gray'} size="2">
            {'N' + data.node.iid}
          </Badge>
          <Badge color={data.node.color} size="2">
            {data.node.label}
          </Badge>
        </Flex>
      </Box>

      <Box position="absolute" top="8px" right="8px">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger>
            <IconButton variant="soft" size="1" color="gray" style={{ pointerEvents: 'auto', background: 'none' }}>
              <DotsHorizontalIcon />
            </IconButton>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content onCloseAutoFocus={e => e.preventDefault()}>
            <DropdownMenu.Sub>
              <DropdownMenu.SubTrigger>{'Connect To...'}</DropdownMenu.SubTrigger>
              <DropdownMenu.SubContent>
                <DropdownMenu.Item key={1}></DropdownMenu.Item>
              </DropdownMenu.SubContent>
            </DropdownMenu.Sub>
            <DropdownMenu.Item onClick={() => deleteNode({ nodeId: data.node._id })}>
              {'Delete'}
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      </Box>

      {data.node.nodeType === 'LOGICAL_SWITCH' || data.node.nodeType === 'AGENTIC_SWITCH' ? (
        <Flex direction="column" gap="3" style={{ marginTop: 38 }}>
          <SwitchNodeContent
            nodeId={data.node._id}
            inputValue={data.node.inputValue}
            updateNode={updateNode}
          />
        </Flex>
      ) : (
        <div style={{ marginTop: 40 }}>{'Instructions'}</div>
      )}

      <Handle
        type="target"
        position={Position.Left}
        style={LEFT_HANDLE_OFFSET ? { top: LEFT_HANDLE_OFFSET } : {}}
      />

      {Array.from({ length: data.node.numHandles }).map((_, i) => (
        <Handle
          key={i}
          id={String(i)}
          type="source"
          position={Position.Right}
          style={{
            top: BASE_OFFSET + i * SPACING,
          }}
        />
      ))}
    </div>
  );
};

export const CustomNode = memo(CustomNodeComponent, (prev, next) => {
  return prev.data === next.data;
});
