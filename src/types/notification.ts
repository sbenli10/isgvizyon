export type NotificationType = 'error' | 'warning' | 'info' | 'success';
export type NotificationCategory = 
  | 'risk' 
  | 'finding' 
  | 'plan' 
  | 'employee' 
  | 'training' 
  | 'legal' 
  | 'general';
export type NotificationPriority = 'low' | 'normal' | 'high' | 'critical';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  message: string;
  action_url: string | null;
  action_label: string;
  related_id: string | null;
  related_table: string | null;
  is_read: boolean;
  read_at: string | null;
  priority: NotificationPriority;
  created_at: string;
  expires_at: string | null;
  metadata: Record<string, any>;
}