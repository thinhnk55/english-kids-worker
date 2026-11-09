export interface AiTalkCategory {
  code: string;
  parent_code: string | null;
  name: string;
  position: number;
}

export interface AiTalkMission {
  id?: string;
  code?: string;
  goal?: string;
  text?: string;
  hints?: string[];
}

export interface AiTalkScenario {
  id: string;
  category?: string | null;
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
  // 1 lần sai ngữ pháp chính tả trừ 10 điểm
  has_accuracy_error: boolean;
  accuracy_issue?: string;

  // 1 lần chưa tự nhiên trừ 5 điểm
  is_unnatural: boolean;
  naturalness_suggestion?: string;

  // 1 lần nội dung không liên quan chủ đề trừ 10 điểm
  is_off_topic: boolean;
  off_topic_reason?: string;
  off_topic_severity?: 'slight' | 'complete' | 'intentional';

  // Tổng điểm năng lực bị trừ ở lượt này (mắc đồng thời nhiều lỗi thì cộng dồn)
  turn_deduction: number;
  deductions: Array<{
    rule: string;
    points: number;
    detail?: string;
  }>;

  // Trừ vào thanh năng lượng Focus (xanh - vàng - đỏ) chống lạc đề (0, -10, -25, -35)
  focus_penalty: number;

  praise?: string;

  // Tương thích ngược
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
  scenario_snapshot?: string | null;
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
