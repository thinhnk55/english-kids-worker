# AI Talk – Đặc tả tính năng

## 1. Ý tưởng sản phẩm

AI Talk giúp người học luyện giao tiếp tiếng Anh thông qua các nhiệm vụ thực tế. AI nhập vai, trò chuyện tự nhiên và hướng dẫn người học hoàn thành mục tiêu.

**Nguyên tắc:** Tự do hội thoại trong phạm vi nhiệm vụ, không sử dụng kịch bản cố định.

## 2. Cơ chế nhiệm vụ (Mission)

Mỗi nhiệm vụ gồm:

- **Scenario:** Bối cảnh và vai trò của AI/người học.
- **Goals:** Danh sách mục tiêu cần hoàn thành.
- **Focus Score:** Điểm duy trì sự tập trung vào nhiệm vụ.

### Ví dụ: Ordering Pizza 🍕

**Bối cảnh:** Bạn bước vào một nhà hàng pizza. AI đóng vai nhân viên phục vụ.

**Mục tiêu:**
- [ ] Gọi một chiếc pizza.
- [ ] Chọn loại và kích cỡ.
- [ ] Xác nhận đơn hàng.

Nhiệm vụ thành công khi hoàn thành tất cả mục tiêu, không bắt buộc theo thứ tự.

## 3. Feedback – Đánh giá từng câu

| Tiêu chí | Nội dung |
|---|---|
| Accuracy | Chính tả, ngữ pháp, từ vựng |
| Relevance | Mức độ liên quan đến tình huống và mục tiêu |
| Naturalness | Cách diễn đạt tự nhiên trong giao tiếp |

**Quy tắc:** Chỉ hiển thị lỗi hoặc gợi ý thực sự hữu ích. Không cần nhận xét dài khi câu đã tốt.

### Ví dụ

**User:** "I want pizza big."

**Feedback:**
- Accuracy: Sai trật tự từ.
- Relevance: Đúng chủ đề.
- Naturalness: Nên nói "I'd like a large pizza, please."

**AI:** "Sure! Would you like cheese or pepperoni?"

## 4. Focus Score – Kiểm soát lạc đề

Mỗi nhiệm vụ bắt đầu với **100 điểm**.

| Hành vi | Điểm |
|---|---:|
| Đúng chủ đề | 0 |
| Lạc đề nhẹ | -10 |
| Lạc đề hoàn toàn | -25 |
| Tiếp tục cố tình lạc đề | -35 |

- Không trừ điểm vì lỗi tiếng Anh.
- AI chủ động đưa hội thoại trở lại nhiệm vụ.
- Điểm về 0 → nhiệm vụ thất bại.
- Hoàn thành Goals trước khi hết điểm → thành công.

*Mức trừ điểm là cấu hình ban đầu, cần kiểm chứng qua sử dụng thực tế.*

## 5. Ví dụ một phiên hội thoại

**AI:** "Hello! What would you like to order?"

**User:** "I'd like a pizza, please."

✅ Đúng cả 3 tiêu chí.

🎯 Goal: Gọi pizza — Hoàn thành.

**AI:** "What kind of pizza would you like?"

**User:** "Are you a boy?"

⚠️ Relevance: Lạc đề.

**Focus Score:** 100 → 75

**AI:** "I'm your waiter! Would you like cheese or pepperoni pizza?"

**User:** "Cheese pizza, please. A large one."

✅ Câu đúng và tự nhiên.

🎯 Goal: Chọn loại và kích cỡ — Hoàn thành.

**AI:** "One large cheese pizza. Is that correct?"

**User:** "Yes, that's right. Thank you!"

🎯 Goal: Xác nhận đơn hàng — Hoàn thành.

**Kết quả:** Mission Completed — Focus Score: 75/100.

## 6. Nguyên tắc xử lý AI

Mỗi lượt người học gửi một câu, hệ thống gọi LLM **một lần** để:

1. Đánh giá 3 tiêu chí feedback.
2. Xác định mục tiêu nào đã hoàn thành.
3. Đánh giá mức độ lạc đề.
4. Sinh câu trả lời tiếp theo.

Backend kiểm tra kết quả, tính Focus Score và lưu trạng thái.

**Bộ nhớ:** Chỉ gửi Lesson Policy, mục tiêu đã đạt, Focus Score và một số lượt hội thoại gần nhất.

**Công nghệ:** Cloudflare Workers + D1 + LLM Gateway (OpenAI/Gemini/Groq).

---

**Triết lý sản phẩm:** Nhiệm vụ tạo động lực để người học nói. Feedback giúp họ nói tốt hơn. Focus Score giữ cuộc trò chuyện đi đúng hướng.
