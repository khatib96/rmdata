import HistoryTab from '../../shared/HistoryTab';

interface EmployeeHistoryProps {
  employeeId: number;
  employeeName: string;
}

export default function EmployeeHistory({ employeeId, employeeName }: EmployeeHistoryProps) {
  return <HistoryTab entityType="employee" entityId={employeeId} entityName={employeeName} />;
}
