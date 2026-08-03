# Web Development Quiz - 설계 계획서 (PLAN)

본 문서는 외부 라이브러리 없이 바닐라 HTML/CSS/Javascript 만을 사용하여 구축하는 **웹 개발 상식 퀴즈 웹사이트**의 설계 및 개발 계획서입니다.

---

## 1. 개요
- **목적**: 프론트엔드 및 웹 개발 관련 지식을 테스트할 수 있는 매력적이고 동적인 퀴즈 웹사이트 구축
- **기술 스택**: HTML5, CSS3 (Vanilla), JavaScript (ES6+, Vanilla)
- **핵심 목표**: 
  - 세련된 비주얼 (다크 모드 기본, 글래스모피즘, 네온 그라디언트, 미세 애니메이션)
  - 매끄러운 상태 전환 및 생동감 있는 인터랙션
  - 외부 라이브러리 의존성 없음 (순수 바닐라 JS)

---

## 2. 기능 요구사항

### 2.1. 웰컴 화면 (Welcome Screen)
- 사용자 이름 입력 필드 (유효성 검사 포함)
- 퀴즈 규칙 소개 및 시작 버튼
- 다크/라이트 테마 토글 버튼

### 2.2. 퀴즈 진행 화면 (Quiz Screen)
- **상태 바 (Status Bar)**: 
  - 현재 진행률 (프로그레스 바) 및 문항 번호 표시 (예: "질문 3 / 10")
  - 현재 획득 점수 실시간 표시
- **타이머 (Timer)**: 
  - 문항당 15초 시간 제한
  - 시간이 줄어들면서 색상이 변하는 시각 효과 (초록 -> 주황 -> 빨강)
  - 시간 초과 시 오답 처리 후 다음 문항으로 자동 전환 또는 해설 표시 후 대기
- **질문 및 보기 영역**:
  - 질문 텍스트
  - 4개의 선다형 보기 (Hover 시 네온 하이라이팅 효과)
  - 정답 선택 시 즉각적인 시각적 피드백 (정답: Green, 오답: Red와 함께 정답 하이라이트)

### 2.3. 결과 및 검토 화면 (Result & Review Screen)
- **결과 카드**:
  - 최종 점수 및 맞힌 개수 요약
  - 사용자 맞춤형 칭호 제공 (예: 0~3개 "초보 코더", 4~7개 "실력파 개발자", 8~10개 "웹의 지배자")
- **오답 노트/해설 세션**:
  - 전체 문항에 대해 사용자가 선택한 답안, 정답 여부, 그리고 자세한 해설(Explanation) 확인 가능
- **재시도 버튼**:
  - 퀴즈 상태를 초기화하고 웰컴 화면으로 복귀

---

## 3. 디자인 시스템 (Design System)

- **테마**: Neon Cyber Dark Mode (기본) & Clean Light Mode
- **글꼴**: Google Fonts의 `Outfit` 및 `Inter`
- **색상 팔레트 (Dark Mode)**:
  - Background: `#0f172a` (Deep Slate Blue)
  - Card/Container: `rgba(30, 41, 59, 0.7)` with Blur (Glassmorphism)
  - Primary Neon: `#818cf8` (Indigo)
  - Secondary Neon: `#c084fc` (Purple Accent)
  - Success/Correct: `#34d399` (Mint Green)
  - Danger/Wrong: `#f87171` (Coral Red)
  - Text Main: `#f8fafc`
- **애니메이션 효과**:
  - 카드 페이드인: `@keyframes fadeInUp`
  - 시간 경과에 따른 타이머 애니메이션
  - 정오답 선택 시의 Bounce/Shake 효과

---

## 4. 파일 구조
```
pollev/
├── index.html          # 웹사이트 뼈대 및 SEO 메타태그
├── style.css           # 디자인 시스템, 테마 및 애니메이션
├── app.js              # 상태 제어, 타이머 및 퀴즈 로직 (바닐라 JS)
├── PLAN.md             # 설계 계획서 (본 문서)
├── WORKFLOW.md         # 개발 과정 및 검증 보고서 (완료 후 작성 예정)
└── SUPABASE.md         # Supabase 백엔드 마이그레이션 가이드 문서
```

---

## 5. 데이터 모델 (퀴즈 문항 구성)
퀴즈는 총 10문항으로 구성하며, 프론트엔드 및 웹 기본 지식(HTML, CSS, JS, HTTP 등)을 다룹니다.
```javascript
{
  id: 1,
  question: "JavaScript에서 'null'의 타입(typeof null)은 무엇인가요?",
  options: ["null", "undefined", "object", "string"],
  answer: 2, // 'object'
  explanation: "JavaScript의 역사적인 설계 오류로 인해 `typeof null`은 `'object'`를 반환합니다."
}
```

---

## 6. 개발 로드맵
1. **[Step 1]** `index.html` 구조 설계 및 SEO 기본 설정
2. **[Step 2]** `style.css` 핵심 디자인 스타일 및 테마 정의
3. **[Step 3]** `app.js` 상태 관리 설계 및 퀴즈 데이터 구현
4. **[Step 4]** 타이머 및 화면 전환(Welcome -> Quiz -> Result) 연동
5. **[Step 5]** 정답 체크 기능 및 정오답 시각적 연출 추가
6. **[Step 6]** 결과 화면 및 상세 해설 목록 렌더링 구현
7. **[Step 7]** 테마 변경 기능 및 세부 UI/UX 폴리싱
8. **[Step 8]** 최종 검증 및 `WORKFLOW.md` 작성
