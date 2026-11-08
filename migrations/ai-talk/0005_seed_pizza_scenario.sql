-- 5. Seed mẫu tình huống: Ordering Pizza 🍕
INSERT INTO ai_talk_scenarios (
  id, slug, title, description, ai_role, user_role, initial_prompt, first_message, level, max_turns, initial_focus_score, created_at, updated_at
) VALUES (
  1,
  'ordering-pizza',
  'Ordering Pizza 🍕',
  'Bạn bước vào một nhà hàng pizza. AI đóng vai nhân viên phục vụ, hãy gọi món và hoàn thành đơn hàng.',
  'Pizza restaurant waiter',
  'Customer ordering pizza',
  'You are a friendly, enthusiastic waiter at Pizza Palace. Speak in simple, clear English suitable for learners. Guide the customer to complete their order without being rigid. If the customer goes off topic, politely steer them back to their pizza order.',
  'Hello! Welcome to Pizza Palace! What would you like to order today?',
  'Starter',
  20,
  100,
  1794118000000,
  1794118000000
);

-- Seed các nhiệm vụ cho tình huống Ordering Pizza
INSERT INTO ai_talk_scenario_goals (scenario_id, code, title, prompt_instruction, order_index, created_at) VALUES
  (1, 'order_pizza', 'Gọi một chiếc pizza', 'The user explicitly states they want to order a pizza.', 1, 1794118000000),
  (1, 'choose_type_and_size', 'Chọn loại và kích cỡ', 'The user specifies both the type of pizza (e.g. cheese, pepperoni) and the size (e.g. small, medium, large).', 2, 1794118000000),
  (1, 'confirm_order', 'Xác nhận đơn hàng', 'The user confirms that their order details are correct (e.g. replying yes / that is right).', 3, 1794118000000);
