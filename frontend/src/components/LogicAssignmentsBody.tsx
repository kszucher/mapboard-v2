import { PlusIcon } from '@radix-ui/react-icons';
import { Flex, IconButton } from '@radix-ui/themes';

import { LogicAssignmentRow } from './LogicAssignmentRow.tsx';

interface LogicAssignmentsBodyProps {
  assignments: string[];
  onAssignmentsChange: (newAssignments: string[]) => void;
}

export const LogicAssignmentsBody = ({ assignments, onAssignmentsChange }: LogicAssignmentsBodyProps) => {
  const handleAddAssignment = () => {
    const newAssignments = [...assignments, ''];
    onAssignmentsChange(newAssignments);
  };

  const handleUpdateAssignment = (index: number, newValue: string) => {
    const newAssignments = [...assignments];
    newAssignments[index] = newValue;
    onAssignmentsChange(newAssignments);
  };

  const handleDeleteAssignment = (index: number) => {
    const newAssignments = assignments.filter((_, i) => i !== index);
    onAssignmentsChange(newAssignments);
  };

  return (
    <Flex direction="column" gap="2">
      {assignments.length > 0 && (
        <Flex direction="column" gap="2">
          {assignments.map((assignment, i) => (
            <LogicAssignmentRow
              key={i}
              value={assignment}
              onChange={newValue => handleUpdateAssignment(i, newValue)}
              onDelete={() => handleDeleteAssignment(i)}
            />
          ))}
        </Flex>
      )}

      <Flex gap="2" align="center" style={{ marginLeft: 16, height: 32 }}>
        <IconButton onClick={handleAddAssignment} size="1" variant="ghost" color="gray">
          <PlusIcon />
        </IconButton>
      </Flex>
    </Flex>
  );
};
