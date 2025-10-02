export enum MessageRole { USER = 'user', MODEL = 'model' }

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  sources?: { uri: string; title: string }[];
}

export type GroundingSource = { uri: string; title: string };
