# Web Development Quiz - 개발 과정 보고서 (WORKFLOW)

본 문서는 웹 개발 상식 퀴즈 웹사이트의 구현 완료 내역, 기술적 핵심 세부 사항, 수동 검증 결과 및 실행 가이드를 정리한 보고서입니다.

---

## 1. 구현 개요
외부 라이브러리(Bootstrap, Tailwind, React, jQuery 등)를 배제하고 오직 순수 바닐라 HTML/CSS/JavaScript 만을 활용하여 반응형 및 인터랙티브 웹사이트를 성공적으로 구현했습니다.

- **작성 파일**:
  - [index.html](file:///home/user/work/kosa-ict-genai-2026-1st/src/exercise/chikaboomGit/day34/pollev/index.html): 구조 설계 및 SEO 최적화 메타데이터 적용
  - [style.css](file:///home/user/work/kosa-ict-genai-2026-1st/src/exercise/chikaboomGit/day34/pollev/style.css): 레이아웃, 다크/라이트 테마 변수, 글래스모피즘 및 애니메이션
  - [app.js](file:///home/user/work/kosa-ict-genai-2026-1st/src/exercise/chikaboomGit/day34/pollev/app.js): 퀴즈 상태 머신, 실시간 SVG 타이머 렌더링, 퀴즈 10문항 제어
  - [PLAN.md](file:///home/user/work/kosa-ict-genai-2026-1st/src/exercise/chikaboomGit/day34/pollev/PLAN.md): 설계 계획서
  - [SUPABASE.md](file:///home/user/work/kosa-ict-genai-2026-1st/src/exercise/chikaboomGit/day34/pollev/SUPABASE.md): Supabase 이메일 인증 및 퀴즈 결과 적재 백엔드 이관 가이드

---

## 2. 구현 특징 및 기술적 세부사항

### 2.1. 세련된 비주얼 & 디자인 (Rich Aesthetics)
- **배경 이펙트**: 뒷배경에 다이내믹하게 위치한 두 개의 원형 빛 구체(`.glow-sphere`)에 초강력 블러(`filter: blur(120px)`)를 주어 몽환적인 입체감을 제공합니다.
- **글래스모피즘(Glassmorphism)**: 퀴즈 카드에 반투명 배경색(`rgba(17, 24, 39, 0.7)`)과 백드롭 필터(`backdrop-filter: blur(16px)`)를 조합하여 현대적이고 고급스러운 UI를 연출했습니다.
- **다크 / 라이트 테마 변환**: CSS variables(`--bg-app`, `--card-bg` 등)를 이용해 유연한 테마 변경을 지원합니다. 브라우저의 `localStorage`를 연동하여 사용자가 마지막에 선택한 테마 설정을 새로고침 후에도 유지합니다.

### 2.2. 역동적인 UX & 기능성
- **프로그레스 바**: 현재 진행 상태를 부드러운 CSS 너비 트랜지션으로 시각화합니다.
- **SVG 타이머 링**: 
  - 각 문제마다 15초의 제한시간을 제공하며, SVG `circle`의 `stroke-dashoffset`을 제어하여 부드럽게 감소하는 원형 바를 구현했습니다.
  - 남은 시간에 따라 초록색(여유) -> 주황색(경고) -> 빨간색(임박)으로 테두리 색상이 변경됩니다.
- **점수 및 보너스 시스템**: 기본 100점에 남은 시간 $\times$ 10점의 보너스를 더해 정답 제출 시 신속한 풀이를 유도하는 게임성 요소를 가미했습니다.
- **정오답 피드백**: 보기 선택 즉시 맞으면 초록(체크), 틀리면 빨강(X) 아이콘과 함께 틀린 보기의 좌우 흔들림(Shake) 애니메이션이 활성화되고 동시에 정답인 보기가 하이라이트됩니다.
- **결과 & 오답노트 아코디언**: 
  - 퀴즈 완료 시 점수에 따른 4가지 등급(웹 마스터, 시니어 아키텍트 등)과 맞춤형 뱃지를 부여합니다.
  - 하단에 10문항에 대한 내 답변과 실제 정답, 그리고 상세 해설을 아코디언 형태로 탭하여 가볍게 펼치고 닫을 수 있습니다.

---

## 3. 검증 결과 (Verification)

### 3.1. 구문 검사 및 안전성 검증
- **JavaScript 문법 검사**:
  - `node -c app.js`를 통해 문법상 구문 에러가 없음을 최종 확인했습니다.
- **보안성(XSS 예방)**:
  - 질문 보기 텍스트 렌더링 시 브라우저 내장 이스케이프 처리를 위해 `textContent` API를 명시적으로 사용함으로써 임의의 HTML/JS 코드 삽입 공격(XSS)을 사전 차단하였습니다.
- **유효성 검사 (Form Validation)**:
  - 웰컴 화면의 이름 입력은 공백 제외 2자 이상 15자 이하만 허용되며, 조건을 어길 시 부드러운 흔들림 효과와 에러 문구를 표시하고 시작을 방지합니다.

### 3.2. 화면 및 반응형 검증 (모바일 반응형 최적화 완료)
- 모바일 크롬, 사파리 등의 다양한 디바이스 환경을 모방한 미디어 쿼리(`@media (max-width: 600px)`) 설정을 아래와 같이 강화했습니다:
  - **터치 영역 확장(Ergonomics)**: 보기 항목 버튼(`.option-btn`)의 최소 높이를 `52px`로 확장하고 패딩을 조절하여 모바일 기기 터치가 매우 편리하도록 설계했습니다.
  - **울트라 모바일 대응**: 가로폭이 극히 좁은 모바일 기기(360px 이하)에서 점수와 정답률을 보여주는 카드(`score-board-card`)가 깨지지 않도록 `flex-direction: column`으로 자동 전환되며 구분선 또한 가로선으로 변환됩니다.
  - **GPU 가속 및 성능 최적화**: 모바일의 상대적으로 낮은 렌더링 성능을 고려해 배경 네온 구체(`.glow-sphere`)의 크기와 블러 직경을 낮추어 스크롤 렉 및 버벅임을 방지했습니다.
  - **UI/UX 폴리싱**: 디바이스 터치 시 발생하는 파란색 하이라이트 잔상을 차단하기 위해 `-webkit-tap-highlight-color: transparent` 설정을 적용했습니다.

### 3.3. Supabase 이메일 가입 RLS 정책 극복 (Trigger & Metadata 연동)
- **발생한 이슈**: 이메일 가입 승인 대기 단계에서 사용자는 세션을 획득하지 못해 임시 익명(Anonymous) 상태가 됩니다. 이때 클라이언트가 직접 `profiles` 테이블에 닉네임을 삽입하려고 하면 RLS 정책(`auth.uid() = id`) 위반으로 가입 진행이 차단되는 현상이 있었습니다.
- **해결책**:
  1. 클라이언트(JS) 단에서 회원가입 호출 시 닉네임을 Auth User Metadata (`options.data.username`)로 함께 전송하도록 개선했습니다.
  2. 데이터베이스 측에 자동 가입 트리거(`on_auth_user_created`) 및 전용 함수(`handle_new_user`)를 배치하여, 인증 여부와 무관하게 가입 즉시 서버 권한(`security definer`)으로 안전하게 `profiles`에 레코드가 자동 추가되도록 조치했습니다.
  3. 이 방식을 적용하여 가입 시 RLS 차단 에러를 완전히 해소하고 안정적으로 이메일 확인 메일 발송 단계로 이행시켰습니다.

---

## 4. 로컬 구동 및 사용 방법

파일 분리형 구조(`index.html`, `style.css`, `app.js`)를 로컬 웹 서버로 구동합니다.

### 방법 A. Python 내장 서버 구동
```bash
python3 -m http.server 8000
```
서버가 실행되면 브라우저를 열고 `http://localhost:8000` 주소로 접속합니다.

### 방법 B. Node.js `http-server` 패키지 구동
```bash
npx http-server -p 8000
```
동일하게 브라우저로 `http://localhost:8000` 주소로 접근합니다.
