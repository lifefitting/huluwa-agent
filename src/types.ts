export type MailItem = {
  id: string;
  threadId?: string;
  from?: string;
  subject?: string;
  date?: string;
  snippet?: string;
  labels?: string[];
};
