import { LogicAssignmentRow } from './LogicAssignmentRow.tsx';
import { EditableList } from './shared/EditableList.tsx';

interface LogicAssignmentsBodyProps {
  assignments: string[];
  onAssignmentsChange: (newAssignments: string[]) => void;
}

export const LogicAssignmentsBody = ({ assignments, onAssignmentsChange }: LogicAssignmentsBodyProps) => {
  return (
    <EditableList
      items={assignments}
      onItemsChange={onAssignmentsChange}
      renderItem={(assignment, index, { onUpdate, onDelete }) => (
        <LogicAssignmentRow
          key={index}
          value={assignment}
          onChange={onUpdate}
          onDelete={onDelete}
        />
      )}
    />
  );
};
