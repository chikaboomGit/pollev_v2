/**
 * One Quiz App - Pure Vanilla JS
 */

// Supabase Configuration Constants
// 실시간 사용자 인증 및 결과 기록을 위해 본인의 Supabase URL과 Anon Key로 변경해주세요.
const SUPABASE_URL = "https://vpllraplvsxwdwlvfrkr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_KMpiw8hI4KZT7draEbEn2w_91pBOz5-";

let supabaseClient = null;

// 1. Quiz Data Model (10 frontend-focused trivia questions)
const quizData = [
  {
    id: 1,
    question: "JavaScript에서 'typeof null'의 결과는 무엇인가요?",
    options: ["\"null\"", "\"undefined\"", "\"object\"", "\"function\""],
    answer: 2,
    explanation: "JavaScript의 오래된 역사적 버그로 인해 `typeof null`은 `'object'`를 반환합니다. 이는 하위 호환성을 위해 수정되지 않고 표준으로 유지되고 있습니다."
  },
  {
    id: 2,
    question: "HTML5의 시맨틱(Semantic) 태그가 아닌 것은 무엇인가요?",
    options: ["<section>", "<div>", "<article>", "<header>"],
    answer: 1,
    explanation: "`<div>`와 `<span>`은 의미를 갖지 않는(non-semantic) 대표적인 태그로, 순수하게 스타일링이나 레이아웃 구분을 위해 사용됩니다. 반면 `<section>`, `<article>`, `<header>` 등은 문서 구조에 명확한 의미를 부여합니다."
  },
  {
    id: 3,
    question: "CSS 박스 모델(Box Model)에서 테두리(Border)와 콘텐츠(Content) 사이의 여백은 무엇인가요?",
    options: ["Margin", "Padding", "Outline", "Spacing"],
    answer: 1,
    explanation: "콘텐츠와 테두리(Border) 사이의 안쪽 여백은 `Padding`이며, 테두리 바깥쪽의 다른 요소와의 여백은 `Margin`입니다."
  },
  {
    id: 4,
    question: "JavaScript에서 동등(==) 연산자와 일치(===) 연산자의 차이점은 무엇인가요?",
    options: [
      "차이점이 없으며 서로 대체 가능합니다.",
      "==는 값만 비교하고, ===는 값과 데이터 타입(Type)을 모두 비교합니다.",
      "===는 값만 비교하고, ==는 값과 데이터 타입을 모두 비교합니다.",
      "==는 객체만 비교할 수 있고, ===는 원시 값만 비교할 수 있습니다."
    ],
    answer: 1,
    explanation: "`==`(동등 연산자)는 비교 전 암묵적 타입 변환(Type Coercion)을 거쳐 값만 비교하지만, `===`(일치 연산자)는 타입 변환 없이 값과 타입이 모두 같아야 참(`true`)을 반환하므로 더 권장됩니다."
  },
  {
    id: 5,
    question: "브라우저 저장소 중 세션이 종료(창을 닫음)되어도 데이터가 사라지지 않고, 도메인당 약 5MB의 용량을 제공하는 것은 무엇인가요?",
    options: ["SessionStorage", "Cookie", "LocalStorage", "Cache API"],
    answer: 2,
    explanation: "`LocalStorage`는 수동으로 지우지 않는 한 만료 기한 없이 브라우저에 데이터를 영구 보존하며 도메인별 약 5MB의 용량을 제공합니다. 반면 `SessionStorage`는 창을 닫으면 소멸됩니다."
  },
  {
    id: 6,
    question: "Flexbox 레이아웃에서 주축(Main Axis)과 교차축(Cross Axis) 모두에서 아이템을 정중앙에 정렬하기 위한 올바른 속성 조합은?",
    options: [
      "justify-content: center; align-content: center;",
      "text-align: center; vertical-align: middle;",
      "align-items: center; align-content: center;",
      "justify-content: center; align-items: center;"
    ],
    answer: 3,
    explanation: "Flex 컨테이너에서 `justify-content: center`는 주축(가로) 정렬을, `align-items: center`는 교차축(세로) 정렬을 중앙으로 지정하여 요소를 화면 정중앙에 배치합니다."
  },
  {
    id: 7,
    question: "JavaScript에서 이벤트 버블링(상위 요소로 이벤트가 전파되는 것)을 명시적으로 중단시키는 메서드는 무엇인가요?",
    options: ["event.preventDefault()", "event.stopPropagation()", "event.stopImmediatePropagation()", "event.releaseEvents()"],
    answer: 1,
    explanation: "`event.stopPropagation()`은 현재 이벤트가 캡처링/버블링 단계에서 더 이상 다른 DOM 요소를 타고 전파되지 않도록 차단합니다. 참고로 `preventDefault()`는 브라우저의 기본 동작(예: 링크 이동)을 방지합니다."
  },
  {
    id: 8,
    question: "HTTP 응답 상태 코드 중에서 '403 Forbidden'이 의미하는 바는 무엇인가요?",
    options: [
      "요청한 리소스를 찾을 수 없음 (Not Found)",
      "서버 내부 오류가 발생함 (Internal Server Error)",
      "클라이언트가 누구인지 인증되지 않음 (Unauthorized)",
      "서버가 요청을 이해했으나 권한이 없어 승인을 거부함 (Forbidden)"
    ],
    answer: 3,
    explanation: "403 Forbidden은 서버가 요청을 이해했지만, 해당 클라이언트가 콘텐츠에 접근할 권한이 없음을 뜻합니다. 401 Unauthorized는 인증(Authentication) 자체가 실패했을 때 주로 발생합니다."
  },
  {
    id: 9,
    question: "CSS에서 'position: absolute'로 선언된 요소의 배치 기준(Containing Block)이 되는 조상은 무엇인가요?",
    options: [
      "언제나 최상위 브라우저 뷰포트(Viewport)",
      "position 속성이 static이 아닌(relative, absolute, fixed 등) 가장 가까운 조상 요소",
      "직계 부모(Parent) 요소",
      "display 속성이 block인 가장 가까운 조상 요소"
    ],
    answer: 1,
    explanation: "`position: absolute`는 조상 요소들 중 `position` 속성이 `static`이 아닌(즉, `relative`, `absolute`, `fixed` 등) 가장 가까운 조상 요소를 기준으로 배치됩니다. 만약 해당하는 조상이 없다면 최상위 `html` 요소를 기준으로 삼습니다."
  },
  {
    id: 10,
    question: "JavaScript에서 비동기 작업의 최종 완료 또는 실패와 그 결과값을 나타내는, Pending / Fulfilled / Rejected 상태를 가지는 객체는?",
    options: ["Callback", "Observable", "Promise", "Generator"],
    answer: 2,
    explanation: "`Promise` 객체는 비동기 연산의 현재 상태(대기: Pending, 이행: Fulfilled, 거부: Rejected)를 캡슐화하여 비동기 흐름을 체계적으로 다룰 수 있게 해주는 ES6 표준 객체입니다."
  }
];

// 2. Application State Variables
let state = {
  session: null,
  username: "",
  currentQuestionIdx: 0,
  score: 0,
  answers: [], // Stores index of selected options, -1 for timeout
  timeLeft: 15,
  timerInterval: null,
  isAnswered: false,
  isSignUpMode: false // Toggle between Login and Signup mode
};

// SVG Dash offset variables for Timer Circle (radius r = 26, circumference = ~163.36)
const TIMER_LIMIT = 15;
const CIRCUMFERENCE = 163.36;

// 3. DOM Elements Cache
const elements = {
  themeToggleBtn: document.getElementById("theme-toggle-btn"),
  
  // Screens
  welcomeScreen: document.getElementById("welcome-screen"),
  quizScreen: document.getElementById("quiz-screen"),
  resultScreen: document.getElementById("result-screen"),
  
  // Welcome & Auth Containers
  authContainer: document.getElementById("auth-container"),
  startContainer: document.getElementById("start-container"),
  authForm: document.getElementById("auth-form"),
  authTitle: document.getElementById("auth-title"),
  authSubtitle: document.getElementById("auth-subtitle"),
  authUsernameGroup: document.getElementById("auth-username-group"),
  authUsernameInput: document.getElementById("auth-username"),
  authUsernameError: document.getElementById("auth-username-error"),
  authEmailInput: document.getElementById("auth-email"),
  authEmailError: document.getElementById("auth-email-error"),
  authPasswordInput: document.getElementById("auth-password"),
  authPasswordError: document.getElementById("auth-password-error"),
  authSubmitBtn: document.getElementById("auth-submit-btn"),
  authToggleBtn: document.getElementById("auth-toggle-btn"),
  authToggleText: document.getElementById("auth-toggle-text"),
  
  // Start Container (Lobby)
  userNickname: document.getElementById("user-nickname"),
  startBtn: document.getElementById("start-btn"),
  logoutBtn: document.getElementById("logout-btn"),
  withdrawBtn: document.getElementById("withdraw-btn"),
  
  // Quiz Screen Elements
  currentQuestionIdxText: document.getElementById("current-question-idx"),
  totalQuestionsCntText: document.getElementById("total-questions-cnt"),
  currentScoreText: document.getElementById("current-score"),
  progressBar: document.getElementById("progress-bar"),
  timerText: document.getElementById("timer-text"),
  timerProgress: document.getElementById("timer-progress"),
  questionText: document.getElementById("question-text"),
  optionsContainer: document.getElementById("options-container"),
  nextBtn: document.getElementById("next-btn"),
  
  // Result Screen Elements
  resultGreeting: document.getElementById("result-greeting"),
  finalScoreText: document.getElementById("final-score"),
  correctRatioText: document.getElementById("correct-ratio"),
  rankTitleText: document.getElementById("rank-title"),
  rankDescText: document.getElementById("rank-desc"),
  reviewList: document.getElementById("review-list"),
  retryBtn: document.getElementById("retry-btn")
};

// 4. Initializer Function
function init() {
  // Bind Events
  elements.authForm.addEventListener("submit", handleAuthSubmit);
  elements.authToggleBtn.addEventListener("click", toggleAuthMode);
  elements.startBtn.addEventListener("click", handleStartQuiz);
  elements.logoutBtn.addEventListener("click", handleLogout);
  elements.withdrawBtn.addEventListener("click", handleWithdraw);
  elements.nextBtn.addEventListener("click", handleNextQuestion);
  elements.retryBtn.addEventListener("click", resetQuiz);
  elements.themeToggleBtn.addEventListener("click", toggleTheme);
  
  // Restore Theme Preferences from localStorage
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "light") {
    document.body.classList.remove("dark-theme");
    document.body.classList.add("light-theme");
  } else {
    document.body.classList.add("dark-theme");
    document.body.classList.remove("light-theme");
  }

  // Set total count UI
  elements.totalQuestionsCntText.textContent = quizData.length;

  // Supabase Setup
  const isSupabaseReady = setupSupabase();
  if (isSupabaseReady) {
    // Listen for Auth changes
    supabaseClient.auth.onAuthStateChange(async (event, session) => {
      state.session = session;
      if (session) {
        // User logged in
        // DB 조회가 완료될 때까지 기다리지 않고 화면 전환을 먼저 처리하여 UI가 "로그인 중..."에 멈추는 현상을 방지합니다.
        elements.authContainer.style.display = "none";
        elements.startContainer.style.display = "block";
        elements.withdrawBtn.style.display = "inline-block"; // 회원 탈퇴 버튼 노출
        
        fetchUserProfile(session.user.id);
      } else {
        // User logged out
        state.username = "";
        elements.userNickname.textContent = "";
        elements.authContainer.style.display = "block";
        elements.startContainer.style.display = "none";
        elements.withdrawBtn.style.display = "none"; // 회원 탈퇴 버튼 숨김
        elements.withdrawBtn.disabled = false;        // 탈퇴 버튼 상태 초기화
        elements.withdrawBtn.textContent = "회원 탈퇴"; // 탈퇴 버튼 텍스트 초기화
        
        // 로그아웃 시 로그인 폼 상태를 '로그인 모드'로 리셋
        if (state.isSignUpMode) {
          toggleAuthMode();
        }
      }
    });
  } else {
    // Supabase가 없을 경우 로컬 대체 처리 (오프라인 모드)
    setupOfflineMode();
  }
}

// 5. Offline Fallback Mode Setup
function setupOfflineMode() {
  elements.authTitle.textContent = "오프라인 도전자 등록";
  elements.authSubtitle.textContent = "Supabase API Key가 감지되지 않아 로컬 저장 모드로 진행합니다.";
  elements.authUsernameGroup.style.display = "block";
  elements.authUsernameInput.required = true;
  
  // Hide Email and Password for offline simplicity
  elements.authForm.querySelector("#auth-email-group").style.display = "none";
  elements.authForm.querySelector("#auth-password-group").style.display = "none";
  elements.authSubmitBtn.textContent = "도전 등록하기";
  elements.authForm.querySelector(".auth-toggle-box").style.display = "none";
}

// Supabase Init Checker
function setupSupabase() {
  if (SUPABASE_URL === "YOUR_SUPABASE_URL" || SUPABASE_ANON_KEY === "YOUR_SUPABASE_ANON_KEY") {
    console.warn("Supabase URL 및 API Key가 기본값입니다. 로컬 오프라인 모드로 자동 전환합니다.");
    
    const notice = document.createElement("div");
    notice.style.background = "rgba(239, 68, 68, 0.15)";
    notice.style.border = "1px solid var(--error)";
    notice.style.color = "var(--error)";
    notice.style.padding = "12px";
    notice.style.borderRadius = "8px";
    notice.style.marginBottom = "16px";
    notice.style.fontSize = "0.85rem";
    notice.innerHTML = `<strong>⚠️ Supabase 연동 필요</strong><br>app.js 파일의 최상단에서 SUPABASE_URL과 SUPABASE_ANON_KEY 변수를 실제 키로 수정하시면 실시간 가입과 결과 적재가 시작됩니다.`;
    elements.authContainer.insertBefore(notice, elements.authForm);
    return false;
  }
  
  try {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return true;
  } catch (err) {
    console.error("Supabase 초기화 실패:", err);
    return false;
  }
}

// Fetch Profile Username
async function fetchUserProfile(uuid) {
  try {
    const { data, error } = await supabaseClient
      .from('profiles')
      .select('username')
      .eq('id', uuid)
      .single();
    
    if (error) throw error;
    state.username = data.username || "도전자";
    elements.userNickname.textContent = state.username;
  } catch (err) {
    console.error("사용자 정보 가져오기 실패:", err);
    // session과 user 객체가 존재하는지 안전하게 체크
    if (state.session && state.session.user && state.session.user.email) {
      state.username = state.session.user.email.split("@")[0];
    } else {
      state.username = "도전자";
    }
    elements.userNickname.textContent = state.username;
  }
}

// 6. Authentication Handlers
async function handleAuthSubmit(e) {
  e.preventDefault();
  
  // Offline fallback submit
  if (!supabaseClient) {
    const offlineName = elements.authUsernameInput.value.trim();
    if (offlineName.length < 2 || offlineName.length > 15) {
      elements.authUsernameGroup.classList.add("invalid");
      elements.authUsernameError.style.display = "block";
      return;
    }
    state.username = offlineName;
    elements.userNickname.textContent = offlineName;
    elements.authContainer.style.display = "none";
    elements.startContainer.style.display = "block";
    return;
  }
  
  const email = elements.authEmailInput.value.trim();
  const password = elements.authPasswordInput.value;
  
  // Clean validation styles
  clearInputErrors();
  
  if (state.isSignUpMode) {
    const username = elements.authUsernameInput.value.trim();
    if (username.length < 2 || username.length > 15) {
      elements.authUsernameGroup.classList.add("invalid");
      elements.authUsernameError.textContent = "닉네임은 2자 이상 15자 이하로 입력해주세요.";
      elements.authUsernameError.style.display = "block";
      alert("닉네임은 2자 이상 15자 이하로 입력해주세요.");
      return;
    }
    if (!validateEmail(email)) {
      document.getElementById("auth-email-group").classList.add("invalid");
      elements.authEmailError.style.display = "block";
      alert("올바른 이메일 형식을 입력해주세요 (예: user@example.com).");
      return;
    }
    if (password.length < 6) {
      document.getElementById("auth-password-group").classList.add("invalid");
      elements.authPasswordError.style.display = "block";
      alert("비밀번호는 최소 6자 이상 입력해야 합니다.");
      return;
    }
    
    // Trigger SignUp
    elements.authSubmitBtn.disabled = true;
    elements.authSubmitBtn.textContent = "회원가입 중...";
    
    try {
      // 닉네임 중복 체크 (Supabase가 사용 가능한 경우)
      if (supabaseClient) {
        const { data: isTaken, error: checkError } = await supabaseClient.rpc('check_username_exists', {
          username_to_check: username
        });
        
        if (checkError) {
          console.error("닉네임 중복 체크 실패:", checkError.message);
        } else if (isTaken) {
          elements.authUsernameGroup.classList.add("invalid");
          elements.authUsernameError.textContent = "이미 사용 중인 닉네임입니다.";
          elements.authUsernameError.style.display = "block";
          alert("이미 사용 중인 닉네임입니다. 다른 닉네임을 입력해주세요.");
          return;
        }
      }

      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: username
          }
        }
      });
      
      if (error) {
        console.error("회원가입 실패 상세 정보:", error);
        let userMessage = "회원가입 실패: " + error.message;
        
        // Supabase Auth 트리거에서 unique 제약 조건 위반 시 발생하는 에러 메시지 매핑
        if (error.message.includes("Database error saving user profile") || 
            error.message.includes("profiles_username") || 
            error.message.includes("unique constraint")) {
          userMessage = "닉네임 중복으로 회원가입이 되지 않았습니다. 다른 닉네임을 입력해주세요.";
          elements.authUsernameGroup.classList.add("invalid");
          elements.authUsernameError.textContent = "이미 사용 중인 닉네임입니다.";
          elements.authUsernameError.style.display = "block";
        }
        
        alert(userMessage);
      } else if (data.user) {
        alert("회원가입 승인 메일이 전송되었습니다! 이메일 링크를 확인하시면 로그인이 승인됩니다.");
        toggleAuthMode(); // Reset to login
      }
    } catch (signUpErr) {
      console.error("회원가입 예외 발생:", signUpErr);
      alert("회원가입 중 예상치 못한 오류가 발생했습니다: " + signUpErr.message);
    } finally {
      elements.authSubmitBtn.disabled = false;
      elements.authSubmitBtn.textContent = "가입하기";
    }
  } else {
    // Trigger Signin
    if (!validateEmail(email)) {
      document.getElementById("auth-email-group").classList.add("invalid");
      elements.authEmailError.style.display = "block";
      alert("올바른 이메일 형식을 입력해주세요 (예: user@example.com).");
      return;
    }
    if (password.length < 6) {
      document.getElementById("auth-password-group").classList.add("invalid");
      elements.authPasswordError.style.display = "block";
      alert("비밀번호는 최소 6자 이상 입력해야 합니다.");
      return;
    }
    
    elements.authSubmitBtn.disabled = true;
    elements.authSubmitBtn.textContent = "로그인 중...";
    
    try {
      const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) {
        console.error("로그인 실패 상세 정보:", error);
        alert("로그인 실패: " + error.message);
      }
    } catch (signInErr) {
      console.error("로그인 예외 발생:", signInErr);
      alert("로그인 중 예상치 못한 오류가 발생했습니다: " + signInErr.message);
    } finally {
      elements.authSubmitBtn.disabled = false;
      elements.authSubmitBtn.textContent = "로그인하기";
    }
  }
}

function toggleAuthMode() {
  state.isSignUpMode = !state.isSignUpMode;
  clearInputErrors();
  
  if (state.isSignUpMode) {
    elements.authTitle.textContent = "회원가입";
    elements.authSubtitle.textContent = "계정을 생성하여 기록을 데이터베이스에 영구 보존하세요.";
    elements.authUsernameGroup.style.display = "block";
    elements.authUsernameInput.required = true;
    elements.authSubmitBtn.textContent = "가입하기";
    elements.authToggleText.textContent = "이미 계정이 있으신가요?";
    elements.authToggleBtn.textContent = "로그인";
  } else {
    elements.authTitle.textContent = "로그인";
    elements.authSubtitle.textContent = "퀴즈를 풀고 결과를 기록하려면 로그인이 필요합니다.";
    elements.authUsernameGroup.style.display = "none";
    elements.authUsernameInput.required = false;
    elements.authSubmitBtn.textContent = "로그인하기";
    elements.authToggleText.textContent = "계정이 없으신가요?";
    elements.authToggleBtn.textContent = "회원가입";
  }
}

async function handleLogout() {
  if (supabaseClient) {
    const { error } = await supabaseClient.auth.signOut();
    if (error) console.error("로그아웃 오류:", error.message);
  } else {
    // Offline mode logout
    state.username = "";
    elements.authContainer.style.display = "block";
    elements.startContainer.style.display = "none";
    elements.authUsernameInput.value = "";
  }
}

async function handleWithdraw() {
  if (!supabaseClient || !state.session) return;
  
  const confirmDelete = confirm("정말로 회원 탈퇴를 진행하시겠습니까?\n탈퇴 시 회원 정보와 모든 퀴즈 기록이 영구 삭제되며 복구할 수 없습니다.");
  if (!confirmDelete) return;
  
  elements.withdrawBtn.disabled = true;
  elements.withdrawBtn.textContent = "탈퇴 중...";
  
  try {
    const { error } = await supabaseClient.rpc('delete_user_account');
    if (error) throw error;
    
    alert("회원 탈퇴가 완료되었습니다. 이용해 주셔서 감사합니다.");
    await supabaseClient.auth.signOut();
  } catch (err) {
    console.error("회원 탈퇴 오류:", err);
    alert("회원 탈퇴 처리 중 오류가 발생했습니다: " + err.message);
    elements.withdrawBtn.disabled = false;
    elements.withdrawBtn.textContent = "회원 탈퇴";
  }
}

function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

function clearInputErrors() {
  elements.authUsernameGroup.classList.remove("invalid");
  elements.authUsernameError.style.display = "none";
  elements.authUsernameError.textContent = "닉네임은 2자 이상 15자 이하로 입력해주세요.";
  document.getElementById("auth-email-group").classList.remove("invalid");
  elements.authEmailError.style.display = "none";
  document.getElementById("auth-password-group").classList.remove("invalid");
  elements.authPasswordError.style.display = "none";
}

// 7. Theme Toggle Logic
function toggleTheme() {
  const isDark = document.body.classList.contains("dark-theme");
  if (isDark) {
    document.body.classList.remove("dark-theme");
    document.body.classList.add("light-theme");
    localStorage.setItem("theme", "light");
  } else {
    document.body.classList.add("dark-theme");
    document.body.classList.remove("light-theme");
    localStorage.setItem("theme", "dark");
  }
}

// 8. Navigation: Switch Screens
function switchScreen(targetScreen) {
  const screens = [elements.welcomeScreen, elements.quizScreen, elements.resultScreen];
  screens.forEach(screen => {
    screen.classList.remove("active");
  });
  targetScreen.classList.add("active");
}

// 9. Start Quiz Action
function handleStartQuiz() {
  switchScreen(elements.quizScreen);
  loadQuestion(0);
}

// 10. Quiz Render & Timer Engine
function loadQuestion(index) {
  state.currentQuestionIdx = index;
  state.isAnswered = false;
  state.timeLeft = TIMER_LIMIT;
  
  const currentQuestion = quizData[index];
  
  // Update Header progress
  elements.currentQuestionIdxText.textContent = index + 1;
  const progressPercent = ((index + 1) / quizData.length) * 100;
  elements.progressBar.style.width = `${progressPercent}%`;
  elements.currentScoreText.textContent = state.score;
  
  // Render Question Text
  elements.questionText.textContent = currentQuestion.question;
  
  // Render Options
  elements.optionsContainer.innerHTML = "";
  currentQuestion.options.forEach((option, optIdx) => {
    const optionBtn = document.createElement("button");
    optionBtn.className = "option-btn";
    optionBtn.innerHTML = `
      <span class="option-marker">${String.fromCharCode(65 + optIdx)}</span>
      <span class="option-text"></span>
      <span class="option-status-icon"></span>
    `;
    // Safe text injection to prevent XSS
    optionBtn.querySelector(".option-text").textContent = option;
    
    // Add Click listener
    optionBtn.addEventListener("click", () => handleSelectOption(optIdx, optionBtn));
    
    elements.optionsContainer.appendChild(optionBtn);
  });
  
  // Disable next button initially
  elements.nextBtn.disabled = true;
  
  // Start countdown timer
  resetTimerProgressCircle();
  startTimer();
}

function startTimer() {
  clearInterval(state.timerInterval);
  updateTimerUI();
  
  state.timerInterval = setInterval(() => {
    state.timeLeft--;
    updateTimerUI();
    
    if (state.timeLeft <= 0) {
      clearInterval(state.timerInterval);
      handleTimeout();
    }
  }, 1000);
}

function updateTimerUI() {
  elements.timerText.textContent = state.timeLeft;
  
  // Dash offset calculations
  const offset = CIRCUMFERENCE * (1 - state.timeLeft / TIMER_LIMIT);
  elements.timerProgress.style.strokeDashoffset = offset;
  
  // Change ring color dynamically depending on time left
  if (state.timeLeft > 7) {
    elements.timerProgress.style.stroke = "#34d399"; // Mint green
  } else if (state.timeLeft > 3) {
    elements.timerProgress.style.stroke = "#fb923c"; // Orange
  } else {
    elements.timerProgress.style.stroke = "#f87171"; // Coral red
  }
}

function resetTimerProgressCircle() {
  elements.timerProgress.style.strokeDashoffset = 0;
  elements.timerProgress.style.stroke = "#34d399";
}

// 11. Interactive Answers Verification
function handleSelectOption(selectedIdx, selectedBtn) {
  if (state.isAnswered) return;
  state.isAnswered = true;
  clearInterval(state.timerInterval);
  
  state.answers.push(selectedIdx);
  
  const currentQuestion = quizData[state.currentQuestionIdx];
  const isCorrect = selectedIdx === currentQuestion.answer;
  const optionButtons = elements.optionsContainer.querySelectorAll(".option-btn");
  
  if (isCorrect) {
    // Add success styling
    selectedBtn.classList.add("correct");
    selectedBtn.querySelector(".option-status-icon").innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
      </svg>
    `;
    
    // Score calculation: 100 points base + (timeLeft * 10 points bonus)
    const baseScore = 100;
    const bonusScore = state.timeLeft * 10;
    state.score += baseScore + bonusScore;
    elements.currentScoreText.textContent = state.score;
  } else {
    // Add wrong styling
    selectedBtn.classList.add("wrong");
    selectedBtn.querySelector(".option-status-icon").innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
      </svg>
    `;
    
    // Highlight the correct answer
    const correctBtn = optionButtons[currentQuestion.answer];
    correctBtn.classList.add("correct");
    correctBtn.querySelector(".option-status-icon").innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
      </svg>
    `;
  }
  
  // Disable all options
  optionButtons.forEach(btn => btn.disabled = true);
  
  // Enable next button
  elements.nextBtn.disabled = false;
}

// 12. Handle Timeout
function handleTimeout() {
  state.isAnswered = true;
  state.answers.push(-1); // -1 indicates timeout
  
  const currentQuestion = quizData[state.currentQuestionIdx];
  const optionButtons = elements.optionsContainer.querySelectorAll(".option-btn");
  
  // Highlight the correct option
  const correctBtn = optionButtons[currentQuestion.answer];
  correctBtn.classList.add("correct");
  correctBtn.querySelector(".option-status-icon").innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
    </svg>
  `;
  
  // Mark all buttons disabled
  optionButtons.forEach(btn => btn.disabled = true);
  
  // Flash red glow on timer as alert
  elements.timerText.textContent = "⏱️";
  
  // Enable next button
  elements.nextBtn.disabled = false;
}

// 13. Screen flow navigation
function handleNextQuestion() {
  const nextIdx = state.currentQuestionIdx + 1;
  
  if (nextIdx < quizData.length) {
    loadQuestion(nextIdx);
  } else {
    showResults();
  }
}

// 14. Show Results Screen & Trigger Database Upload
async function showResults() {
  switchScreen(elements.resultScreen);
  
  // Math Correct ratio
  let correctCount = 0;
  state.answers.forEach((ans, idx) => {
    if (ans === quizData[idx].answer) {
      correctCount++;
    }
  });
  
  // Set UI
  elements.resultGreeting.textContent = `${state.username} 도전자님의 최종 성적표입니다.`;
  elements.finalScoreText.textContent = state.score.toLocaleString();
  elements.correctRatioText.textContent = `${correctCount} / ${quizData.length}`;
  
  // Determine user rank & badges
  let rankTitle = "";
  let rankDesc = "";
  let badgeIcon = "";
  
  if (correctCount >= 9) {
    rankTitle = "웹 마스터 (Web Master)";
    rankDesc = "완벽합니다! 프론트엔드 및 브라우저 명세를 꿰뚫고 있는 진정한 전문가이시군요.";
    badgeIcon = "👑";
  } else if (correctCount >= 7) {
    rankTitle = "시니어 아키텍트 (Senior Architect)";
    rankDesc = "훌륭합니다! 프론트엔드 코어 지식에 대해 매우 단단한 기반을 가지고 계시네요.";
    badgeIcon = "🏆";
  } else if (correctCount >= 4) {
    rankTitle = "주니어 개발자 (Junior Developer)";
    rankDesc = "좋은 시도였습니다! 지식 보강을 통해 더욱 훌륭한 엔지니어로 거듭날 수 있습니다.";
    badgeIcon = "💻";
  } else {
    rankTitle = "코딩 입문자 (Beginner Coder)";
    rankDesc = "괜찮습니다! 배움에는 끝이 없습니다. 오답 노트를 꼼꼼히 확인하고 다시 한번 도전해 보세요.";
    badgeIcon = "🌱";
  }
  
  elements.rankTitleText.textContent = rankTitle;
  elements.rankDescText.textContent = rankDesc;
  elements.rankBadgeBox = document.querySelector(".rank-badge-box");
  elements.rankBadgeBox.querySelector(".badge-icon").textContent = badgeIcon;
  
  // Populate Explanations Accordion
  renderReviewList();

  // Save results to Supabase DB if logged in
  if (supabaseClient && state.session) {
    await saveQuizResult(state.score, correctCount);
  }
}

async function saveQuizResult(score, correctCount) {
  try {
    const { error } = await supabaseClient
      .from('quiz_results')
      .insert([
        {
          user_id: state.session.user.id,
          score: score,
          correct_ratio: `${correctCount} / ${quizData.length}`,
          answers: state.answers
        }
      ]);
    
    if (error) throw error;
    console.log("퀴즈 결과가 Supabase Database에 성공적으로 저장되었습니다!");

    // 실시간 DB 데이터 검증 조회 실행
    const { data: dbRows, error: selectError } = await supabaseClient
      .from('quiz_results')
      .select('*')
      .eq('user_id', state.session.user.id);
    
    if (selectError) {
      console.warn("DB 데이터 검증 조회 실패:", selectError.message);
    } else {
      console.log("현재 DB에 누적 저장되어 있는 사용자 퀴즈 기록:", dbRows);
    }
  } catch (err) {
    console.error("퀴즈 결과 DB 업로드 실패:", err.message);
  }
}

// Render dynamic collapsible explanations
function renderReviewList() {
  elements.reviewList.innerHTML = "";
  
  quizData.forEach((q, idx) => {
    const userAnswerIdx = state.answers[idx];
    const isCorrect = userAnswerIdx === q.answer;
    
    // Status text
    let statusText = "오답";
    if (isCorrect) statusText = "정답";
    else if (userAnswerIdx === -1) statusText = "시간 초과";
    
    // User response text
    const userSelectedText = userAnswerIdx === -1 ? "선택하지 않음" : q.options[userAnswerIdx];
    const correctText = q.options[q.answer];
    
    const item = document.createElement("div");
    item.className = "review-item";
    
    item.innerHTML = `
      <div class="review-header">
        <div class="review-header-title">
          <span class="review-status-badge ${isCorrect ? 'correct' : 'wrong'}">${statusText}</span>
          <span>Q${idx + 1}. ${q.question.substring(0, 30)}...</span>
        </div>
        <div class="review-toggle-icon">▼</div>
      </div>
      <div class="review-body">
        <p><strong>질문:</strong> ${q.question}</p>
        <p><strong>본인의 선택:</strong> <span style="color: ${isCorrect ? 'var(--success)' : 'var(--error)'}">${userSelectedText}</span></p>
        <p><strong>정답:</strong> <span style="color: var(--success)">${correctText}</span></p>
        <div class="explanation-box">
          <strong>해설:</strong> ${q.explanation}
        </div>
      </div>
    `;
    
    // Bind toggle effect
    item.querySelector(".review-header").addEventListener("click", () => {
      item.classList.toggle("expanded");
    });
    
    elements.reviewList.appendChild(item);
  });
}

// 15. Restart Logic (Returns to Lobby startContainer while keeping login session)
function resetQuiz() {
  // Clear State
  state.currentQuestionIdx = 0;
  state.score = 0;
  state.answers = [];
  state.timeLeft = TIMER_LIMIT;
  clearInterval(state.timerInterval);
  state.timerInterval = null;
  state.isAnswered = false;
  
  // Switch back to Welcome Screen
  switchScreen(elements.welcomeScreen);
}

// Start application when DOM is ready
document.addEventListener("DOMContentLoaded", init);
