import { FlowNodeLogicRow } from './FlowNodeLogicRow.tsx';
import { EditableList } from './shared/EditableList.tsx';

interface LogicAssignmentsBodyProps {
  assignments: string[];
  onAssignmentsChange: (newAssignments: string[]) => void;
}

export const FlowNodeLogicBody = ({ assignments, onAssignmentsChange }: LogicAssignmentsBodyProps) => {
  return (
    <EditableList<string>
      items={assignments}
      onItemsChange={onAssignmentsChange}
      createNewItem={() => ''}
      renderItem={(assignment, index, { onUpdate, onDelete }) => (
        <FlowNodeLogicRow
          key={index}
          value={assignment}
          onChange={onUpdate}
          onDelete={onDelete}
        />
      )}
    />
  );
};
