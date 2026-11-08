export interface AiTalkCategory {
  code: string;
  parent_code: string | null;
  name: string;
  position: number;
}

export interface AiTalkMission {
  code: string;
  text: string;
}

export interface AiTalkScenario {
  id: string;
  category: string | null;
  title: string;
  situation: string;
  missions: string | AiTalkMission[];
  ai_role: string;
  user_role: string;
  ai_prompt: string;
  first_message: string;
  max_turns: number;
}

export interface ChatMessageFeedback {
  accuracy?: {
    is_correct: boolean;
    issue?: string;
  };
  relevance?: {
    level: 'on_topic' | 'slight_off_topic' | 'completely_off_topic' | 'intentional_off_topic';
    penalty: number;
    note?: string;
  };
  naturalness?: {
    suggestion?: string;
  };
  praise?: string;
  grammar?: string;
  suggestion?: string;
}

export interface ChatMessage {
  role: 'assistant' | 'user';
  content: string;
  timestamp: number;
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
  messages: string | ChatMessage[];
  feedback: string | null;
  created_at: number;
  updated_at: number;
}
