export interface AiTalkCategory {
  code: string;
  parent_code: string | null;
  name: string;
  position: number;
}

export interface AiTalkScenarioRow {
  code: string;
  name: string;
  category: string;
  credit_cost: number;
  max_turns: number;
  created_at: number;
  updated_at: number;
}

export interface ChatMessageFeedback {
  has_accuracy_error?: boolean;
  accuracy_issue?: string;
  is_unnatural?: boolean;
  naturalness_suggestion?: string;
  is_off_topic?: boolean;
  off_topic_reason?: string;
  off_topic_severity?: 'slight' | 'complete' | 'intentional';
  turn_deduction?: number;
  deductions?: Array<{
    rule: string;
    points: number;
    detail?: string;
  }>;
  focus_penalty?: number;
  praise?: string;
}

export interface ChatMessage {
  role: 'assistant' | 'user' | 'system';
  content: string;
  timestamp?: number;
  feedback?: ChatMessageFeedback;
}

export interface AiTalkSession {
  id: number;
  user_id: number;
  profile_id: number | null;
  scenario_id: string;
  status: 'in_progress' | 'completed' | 'failed' | 'abandoned';
  turns_count: number;
  max_turns: number;
  completed_missions: string | string[];
  score: number | null;
  focus_score: number | null;
  messages: string | ChatMessage[];
  feedback: string | null;
  created_at: number;
  updated_at: number;
}
