export interface TaskData {
  id: string;
  title: string;
  importance: number;
  deadline: number;
  created_at: number;
  completed: boolean;
  depends_on: string | null;
  repeat_type: 'none' | 'daily' | 'weekly';
  isUnlocked?: boolean;
}
