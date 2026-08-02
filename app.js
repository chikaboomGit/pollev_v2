/**
 * One Quiz App - Pure Vanilla JS
 */

// Supabase Configuration Constants
// 실시간 사용자 인증 및 결과 기록을 위해 본인의 Supabase URL과 Anon Key로 변경해주세요.
const SUPABASE_URL = "https://vpllraplvsxwdwlvfrkr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_KMpiw8hI4KZT7draEbEn2w_91pBOz5-";

let supabaseClient = null;

// 1. Offline Demo Questions (Supabase 미설정 시에만 사용되는 로컬 데모 문제)
// 라이브 모드에서는 관리자가 DB(questions 테이블)에 직접 등록한 문제를 사용합니다.
const OFFLINE_DEMO_QUESTIONS = [
  {
    id: "offline-1",
    question_type: "MULTIPLE",
    question_text: "JavaScript에서 'typeof null'의 결과는 무엇인가요?",
    options: ["\"null\"", "\"undefined\"", "\"object\"", "\"function\""],
    correct_option: 2,
    points: 100,
    explanation: "JavaScript의 오래된 역사적 버그로 인해 `typeof null`은 `'object'`를 반환합니다."
  },
  {
    id: "offline-2",
    question_type: "OX",
    question_text: "CSS의 'position: absolute'는 항상 브라우저 뷰포트를 기준으로 배치된다.",
    options: ["O", "X"],
    correct_option: 1,
    points: 100,
    explanation: "position: absolute는 static이 아닌 가장 가까운 조상 요소를 기준으로 배치됩니다. 해당 조상이 없다면 최상위 html 요소가 기준이 됩니다."
  },
  {
    id: "offline-3",
    question_type: "MULTIPLE",
    question_text: "JavaScript에서 비동기 작업의 상태(Pending/Fulfilled/Rejected)를 나타내는 객체는?",
    options: ["Callback", "Observable", "Promise", "Generator"],
    correct_option: 2,
    points: 100,
    explanation: "Promise 객체는 비동기 연산의 현재 상태를 캡슐화합니다."
  }
];

// 2. Application State Variables
let state = {
  session: null,
  username: "",
  currentQuestion: null, // 현재 화면에 렌더링된 문제 객체 (DB row 또는 오프라인 데모 문제)
  offlineIdx: 0, // 오프라인 모드 전용 순차 진행 인덱스
  score: 0,
  answers: [], // Stores index of selected options, -1 for timeout (오프라인 모드 전용)
  timeLeft: 15,
  timerInterval: null,
  isAnswered: false,
  isSignUpMode: false, // Toggle between Login and Signup mode

  // Live Quiz (Admin Mode) 관련 상태
  isAdmin: false,
  activeQuestionId: null, // 현재 관리자가 활성화한 문제의 questions.id (null이면 비활성)
  activeQuestionActivatedAt: null, // 현재 활성 문제의 quiz_state.updated_at 스냅샷 (소요시간 채점 기준)
  answeredQuestionIds: new Set(), // 이미 응답을 제출한 문제 id 집합
  quizStateChannel: null,
  answerDistributionChannel: null,
  answerTally: {}, // { optionIdx: count } — 현재 활성 문제의 실시간 답안 분포
  questionList: [] // 관리자 패널에 표시할 등록된 문제 목록 캐시
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

  // Forgot Password Container
  forgotPasswordBox: document.getElementById("forgot-password-box"),
  forgotPasswordBtn: document.getElementById("forgot-password-btn"),
  forgotPasswordContainer: document.getElementById("forgot-password-container"),
  forgotPasswordForm: document.getElementById("forgot-password-form"),
  forgotEmailInput: document.getElementById("forgot-email"),
  forgotEmailError: document.getElementById("forgot-email-error"),
  forgotInfoMessage: document.getElementById("forgot-info-message"),
  forgotSubmitBtn: document.getElementById("forgot-submit-btn"),
  forgotBackBtn: document.getElementById("forgot-back-btn"),

  // Recovery Container (Set New Password)
  recoveryContainer: document.getElementById("recovery-container"),
  recoveryForm: document.getElementById("recovery-form"),
  recoveryPasswordInput: document.getElementById("recovery-password"),
  recoveryPasswordError: document.getElementById("recovery-password-error"),
  recoverySubmitBtn: document.getElementById("recovery-submit-btn"),

  // Start Container (Lobby)
  userNickname: document.getElementById("user-nickname"),
  logoutBtn: document.getElementById("logout-btn"),
  withdrawBtn: document.getElementById("withdraw-btn"),

  // Waiting Panel (참가자)
  waitingPanel: document.getElementById("waiting-panel"),
  waitingMessage: document.getElementById("waiting-message"),

  // Admin Panel (관리자)
  adminPanel: document.getElementById("admin-panel"),
  adminQuestionList: document.getElementById("admin-question-list"),
  adminDeactivateBtn: document.getElementById("admin-deactivate-btn"),
  adminAnswerDistribution: document.getElementById("admin-answer-distribution"),

  // 문제 등록 폼 (관리자)
  questionForm: document.getElementById("question-form"),
  questionTextInput: document.getElementById("question-text-input"),
  questionOptionsFields: document.getElementById("question-options-fields"),
  questionPointsInput: document.getElementById("question-points-input"),
  questionSubmitBtn: document.getElementById("question-submit-btn"),

  // 리더보드 (참가자 대기 화면)
  leaderboardList: document.getElementById("leaderboard-list"),

  quizFooterMessage: document.getElementById("quiz-footer-message"),

  // Quiz Screen Elements
  questionPointsBadge: document.getElementById("question-points-badge"),
  currentScoreText: document.getElementById("current-score"),
  timerText: document.getElementById("timer-text"),
  timerProgress: document.getElementById("timer-progress"),
  questionText: document.getElementById("question-text"),
  optionsContainer: document.getElementById("options-container"),
  answerDistribution: document.getElementById("answer-distribution"),

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
  elements.logoutBtn.addEventListener("click", handleLogout);
  elements.withdrawBtn.addEventListener("click", handleWithdraw);
  elements.forgotPasswordBtn.addEventListener("click", showForgotPasswordView);
  elements.forgotBackBtn.addEventListener("click", showLoginView);
  elements.forgotPasswordForm.addEventListener("submit", handleForgotPasswordSubmit);
  elements.recoveryForm.addEventListener("submit", handleRecoverySubmit);
  elements.adminDeactivateBtn.addEventListener("click", () => activateQuestion(null));
  elements.retryBtn.addEventListener("click", resetQuiz);
  elements.themeToggleBtn.addEventListener("click", toggleTheme);
  elements.questionForm.addEventListener("submit", handleCreateQuestion);
  elements.questionForm.querySelectorAll('input[name="question-type"]').forEach((radio) => {
    radio.addEventListener("change", renderQuestionOptionFields);
  });

  // Restore Theme Preferences from localStorage
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "light") {
    document.body.classList.remove("dark-theme");
    document.body.classList.add("light-theme");
  } else {
    document.body.classList.add("dark-theme");
    document.body.classList.remove("light-theme");
  }

  // 문제 등록 폼 초기 렌더 (기본 선택: OX)
  renderQuestionOptionFields();

  // Supabase Setup
  const isSupabaseReady = setupSupabase();
  if (isSupabaseReady) {
    // Listen for Auth changes
    supabaseClient.auth.onAuthStateChange(async (event, session) => {
      const hadSessionBefore = !!state.session;
      state.session = session;

      if (event === "PASSWORD_RECOVERY") {
        // 이메일 재설정 링크로 진입한 경우 새 비밀번호 설정 화면만 노출
        elements.authContainer.style.display = "none";
        elements.forgotPasswordContainer.style.display = "none";
        elements.startContainer.style.display = "none";
        elements.recoveryContainer.style.display = "block";
        return;
      }

      // 토큰 자동 갱신(TOKEN_REFRESHED)/유저 정보 갱신(USER_UPDATED)은 세션 객체만 최신화하고,
      // 이미 로그인된 상태에서 문제를 풀고 있는 화면을 강제로 초기화하지 않습니다.
      if ((event === "TOKEN_REFRESHED" || event === "USER_UPDATED") && hadSessionBefore) {
        return;
      }

      if (session) {
        // User logged in
        // DB 조회가 완료될 때까지 기다리지 않고 화면 전환을 먼저 처리하여 UI가 "로그인 중..."에 멈추는 현상을 방지합니다.
        elements.authContainer.style.display = "none";
        elements.forgotPasswordContainer.style.display = "none";
        elements.recoveryContainer.style.display = "none";
        elements.startContainer.style.display = "block";
        elements.withdrawBtn.style.display = "inline-block"; // 회원 탈퇴 버튼 노출
        switchScreen(elements.welcomeScreen);

        await fetchUserProfile(session.user.id);

        if (state.isAdmin) {
          elements.waitingPanel.style.display = "none";
          elements.adminPanel.style.display = "block";
          await loadQuestionList();
        } else {
          elements.adminPanel.style.display = "none";
          elements.waitingPanel.style.display = "block";
          await loadAnsweredQuestionIds(session.user.id);
          await loadLeaderboard();
        }

        await subscribeToQuizState();
      } else {
        // User logged out
        state.username = "";
        state.isAdmin = false;
        state.activeQuestionId = null;
        state.activeQuestionActivatedAt = null;
        state.answeredQuestionIds = new Set();
        state.questionList = [];
        elements.userNickname.textContent = "";
        elements.authContainer.style.display = "block";
        elements.startContainer.style.display = "none";
        elements.withdrawBtn.style.display = "none"; // 회원 탈퇴 버튼 숨김
        elements.withdrawBtn.disabled = false;        // 탈퇴 버튼 상태 초기화
        elements.withdrawBtn.textContent = "회원 탈퇴"; // 탈퇴 버튼 텍스트 초기화

        if (state.quizStateChannel) {
          supabaseClient.removeChannel(state.quizStateChannel);
          state.quizStateChannel = null;
        }
        if (state.answerDistributionChannel) {
          supabaseClient.removeChannel(state.answerDistributionChannel);
          state.answerDistributionChannel = null;
        }

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
  elements.forgotPasswordBox.style.display = "none";
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
      .select('username, is_admin')
      .eq('id', uuid)
      .single();

    if (error) throw error;
    state.username = data.username || "도전자";
    state.isAdmin = !!data.is_admin;
    elements.userNickname.textContent = state.username;
  } catch (err) {
    console.error("사용자 정보 가져오기 실패:", err);
    // session과 user 객체가 존재하는지 안전하게 체크
    if (state.session && state.session.user && state.session.user.email) {
      state.username = state.session.user.email.split("@")[0];
    } else {
      state.username = "도전자";
    }
    state.isAdmin = false;
    elements.userNickname.textContent = state.username;
  }
}

// 새로고침/재접속 시 이미 응답한 문제 목록을 DB와 동기화합니다.
// (state.answeredQuestionIds는 메모리에만 있어 새로고침하면 비워지므로, 그대로 두면
//  이미 답변한 문제를 다시 풀 수 있는 화면이 떠버립니다 — 이를 방지하기 위한 보정 로직입니다.)
async function loadAnsweredQuestionIds(uuid) {
  try {
    const { data, error } = await supabaseClient
      .from('quiz_answers')
      .select('question_id')
      .eq('user_id', uuid);

    if (error) throw error;
    state.answeredQuestionIds = new Set((data || []).map(row => row.question_id));
  } catch (err) {
    console.error("응답 이력 조회 실패:", err.message);
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
    // 오프라인 모드에는 관리자 개념이 없으므로 곧바로 퀴즈를 시작합니다.
    handleStartQuiz();
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
    elements.forgotPasswordBox.style.display = "none";
  } else {
    elements.authTitle.textContent = "로그인";
    elements.authSubtitle.textContent = "퀴즈를 풀고 결과를 기록하려면 로그인이 필요합니다.";
    elements.authUsernameGroup.style.display = "none";
    elements.authUsernameInput.required = false;
    elements.authSubmitBtn.textContent = "로그인하기";
    elements.authToggleText.textContent = "계정이 없으신가요?";
    elements.authToggleBtn.textContent = "회원가입";
    elements.forgotPasswordBox.style.display = "block";
  }
}

// 비밀번호 재설정 화면 전환
function showForgotPasswordView() {
  elements.authContainer.style.display = "none";
  elements.forgotPasswordContainer.style.display = "block";
  elements.forgotInfoMessage.style.display = "none";
  document.getElementById("forgot-email-group").classList.remove("invalid");
  elements.forgotEmailError.style.display = "none";
  elements.forgotEmailInput.value = "";
}

function showLoginView() {
  elements.forgotPasswordContainer.style.display = "none";
  elements.authContainer.style.display = "block";
}

// 비밀번호 재설정 이메일 전송
async function handleForgotPasswordSubmit(e) {
  e.preventDefault();

  const email = elements.forgotEmailInput.value.trim();
  document.getElementById("forgot-email-group").classList.remove("invalid");
  elements.forgotEmailError.style.display = "none";

  if (!validateEmail(email)) {
    document.getElementById("forgot-email-group").classList.add("invalid");
    elements.forgotEmailError.style.display = "block";
    return;
  }

  elements.forgotSubmitBtn.disabled = true;
  elements.forgotSubmitBtn.textContent = "전송 중...";

  try {
    await supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname
    });
  } catch (err) {
    console.error("비밀번호 재설정 요청 오류:", err);
  } finally {
    // 이메일 존재 여부를 노출하지 않기 위해 성공/실패와 무관하게 동일한 안내 메시지를 표시
    elements.forgotInfoMessage.textContent = "입력하신 이메일 주소로 비밀번호 재설정 링크를 전송했습니다. 메일함을 확인해주세요.";
    elements.forgotInfoMessage.style.display = "block";
    elements.forgotSubmitBtn.disabled = false;
    elements.forgotSubmitBtn.textContent = "재설정 링크 보내기";
  }
}

// 새 비밀번호 설정 (이메일 재설정 링크로 진입한 경우)
async function handleRecoverySubmit(e) {
  e.preventDefault();

  const newPassword = elements.recoveryPasswordInput.value;
  document.getElementById("recovery-password-group").classList.remove("invalid");
  elements.recoveryPasswordError.style.display = "none";

  if (newPassword.length < 6) {
    document.getElementById("recovery-password-group").classList.add("invalid");
    elements.recoveryPasswordError.style.display = "block";
    return;
  }

  elements.recoverySubmitBtn.disabled = true;
  elements.recoverySubmitBtn.textContent = "변경 중...";

  try {
    const { error } = await supabaseClient.auth.updateUser({ password: newPassword });
    if (error) throw error;

    alert("비밀번호가 성공적으로 변경되었습니다.");
    elements.recoveryContainer.style.display = "none";
    elements.startContainer.style.display = "block";
    if (state.session) {
      fetchUserProfile(state.session.user.id);
    }
  } catch (err) {
    console.error("비밀번호 변경 오류:", err);
    alert("비밀번호 변경 중 오류가 발생했습니다: " + err.message);
  } finally {
    elements.recoverySubmitBtn.disabled = false;
    elements.recoverySubmitBtn.textContent = "비밀번호 변경하기";
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

// 9. Start Quiz Action (오프라인 모드 전용: 관리자 개념 없이 바로 순차 진행)
function handleStartQuiz() {
  state.offlineIdx = 0;
  switchScreen(elements.quizScreen);
  loadQuestion(OFFLINE_DEMO_QUESTIONS[0]);
}

// 9.1 Live Quiz: 현재 활성 문제 상태 구독 및 초기 조회
async function subscribeToQuizState() {
  if (!supabaseClient || state.quizStateChannel) return;

  // 최초 진입 시 현재 활성 문제 상태를 1회 조회
  const { data, error } = await supabaseClient
    .from('quiz_state')
    .select('active_question_id, updated_at')
    .eq('id', 1)
    .single();

  if (!error && data) {
    handleActiveQuestionChange(data.active_question_id, data.updated_at);
  }

  state.quizStateChannel = supabaseClient
    .channel('quiz_state_changes')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'quiz_state' },
      (payload) => handleActiveQuestionChange(payload.new.active_question_id, payload.new.updated_at))
    .subscribe();
}

// 9.2 활성 문제 변경 처리 (참가자 화면 전환 + 관리자 패널 갱신 담당)
async function handleActiveQuestionChange(questionId, activatedAt) {
  state.activeQuestionId = questionId;
  state.activeQuestionActivatedAt = activatedAt || null;

  if (state.isAdmin) {
    renderAdminPanel();
    if (questionId !== null && questionId !== undefined) {
      subscribeToAnswerDistribution(questionId);
    } else if (state.answerDistributionChannel) {
      supabaseClient.removeChannel(state.answerDistributionChannel);
      state.answerDistributionChannel = null;
      elements.adminAnswerDistribution.style.display = "none";
    }
    return;
  }

  if (questionId === null || questionId === undefined) {
    elements.waitingMessage.textContent = "관리자가 문제를 활성화하면 자동으로 화면이 전환됩니다. 잠시만 기다려주세요...";
    switchScreen(elements.welcomeScreen);
    await loadLeaderboard();
    return;
  }

  if (state.answeredQuestionIds.has(questionId)) {
    elements.waitingMessage.textContent = "이미 응답을 제출한 문제입니다. 다음 문제를 기다려주세요.";
    switchScreen(elements.welcomeScreen);
    return;
  }

  const { data: questionRow, error } = await supabaseClient
    .from('questions')
    .select('*')
    .eq('id', questionId)
    .single();

  if (error || !questionRow) {
    console.error("문제 조회 실패:", error && error.message);
    return;
  }

  switchScreen(elements.quizScreen);
  loadQuestion(questionRow);
  subscribeToAnswerDistribution(questionId);
}

// 9.3 관리자: 문제 등록 폼 — 유형(OX/4지선다)에 따라 보기/정답 입력 필드를 동적으로 생성
function renderQuestionOptionFields() {
  const type = elements.questionForm.querySelector('input[name="question-type"]:checked').value;
  const optionLabels = type === "OX" ? ["O", "X"] : ["", "", "", ""];

  elements.questionOptionsFields.innerHTML = "";
  optionLabels.forEach((presetValue, idx) => {
    const row = document.createElement("div");
    row.className = "question-option-row";
    row.innerHTML = `
      <input type="radio" name="question-correct" value="${idx}" ${idx === 0 ? "checked" : ""}>
      <input type="text" class="question-option-input" placeholder="보기 ${idx + 1}" value="${presetValue}" ${type === "OX" ? "readonly" : ""} required>
    `;
    elements.questionOptionsFields.appendChild(row);
  });
}

// 9.4 관리자: 문제 등록
async function handleCreateQuestion(e) {
  e.preventDefault();

  const type = elements.questionForm.querySelector('input[name="question-type"]:checked').value;
  const questionText = elements.questionTextInput.value.trim();
  const optionInputs = Array.from(elements.questionOptionsFields.querySelectorAll(".question-option-input"));
  const options = optionInputs.map(input => input.value.trim());
  const correctRadio = elements.questionForm.querySelector('input[name="question-correct"]:checked');
  const points = parseInt(elements.questionPointsInput.value, 10);

  if (!questionText) {
    alert("문제 내용을 입력해주세요.");
    return;
  }
  if (options.some(opt => !opt)) {
    alert("모든 보기를 입력해주세요.");
    return;
  }
  if (!correctRadio) {
    alert("정답을 선택해주세요.");
    return;
  }
  if (!points || points <= 0) {
    alert("배점은 1 이상의 숫자여야 합니다.");
    return;
  }

  elements.questionSubmitBtn.disabled = true;
  elements.questionSubmitBtn.textContent = "등록 중...";

  try {
    const { error } = await supabaseClient
      .from('questions')
      .insert([{
        question_type: type,
        question_text: questionText,
        options: options,
        correct_option: parseInt(correctRadio.value, 10),
        points: points,
        created_by: state.session.user.id
      }]);

    if (error) throw error;

    elements.questionTextInput.value = "";
    renderQuestionOptionFields();
    elements.questionPointsInput.value = "100";
    await loadQuestionList();
  } catch (err) {
    console.error("문제 등록 실패:", err);
    alert("문제 등록에 실패했습니다: " + err.message);
  } finally {
    elements.questionSubmitBtn.disabled = false;
    elements.questionSubmitBtn.textContent = "문제 등록하기";
  }
}

// 9.5 관리자: 등록된 문제 목록 조회 및 렌더
async function loadQuestionList() {
  const { data, error } = await supabaseClient
    .from('questions')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error("문제 목록 조회 실패:", error.message);
    return;
  }

  state.questionList = data || [];
  renderAdminPanel();
}

// 9.6 관리자 패널 렌더링 (DB에 등록된 문제 목록 기준)
function renderAdminPanel() {
  elements.adminQuestionList.innerHTML = "";

  if (state.questionList.length === 0) {
    elements.adminQuestionList.innerHTML = "<p>등록된 문제가 없습니다. 위 폼에서 문제를 먼저 등록해주세요.</p>";
    return;
  }

  state.questionList.forEach((q) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-secondary admin-question-btn";
    btn.textContent = `[${q.question_type === "OX" ? "OX" : "4지선다"} / ${q.points}점] ${q.question_text}`;
    if (state.activeQuestionId === q.id) {
      btn.classList.add("active-question");
      btn.textContent += " (활성 중)";
    }
    btn.addEventListener("click", () => activateQuestion(q.id));
    elements.adminQuestionList.appendChild(btn);
  });
}

// 9.7 관리자: 문제 활성화/비활성화 (활성화 전, 직전 문제가 있었다면 5분위 채점을 먼저 마감)
async function activateQuestion(questionId) {
  try {
    if (state.activeQuestionId) {
      const { error: finalizeError } = await supabaseClient.rpc('finalize_question_scoring', {
        target_question_id: state.activeQuestionId
      });
      if (finalizeError) console.error("채점 마감 실패:", finalizeError.message);
    }

    const { error } = await supabaseClient
      .from('quiz_state')
      .update({ active_question_id: questionId, updated_at: new Date().toISOString() })
      .eq('id', 1);

    if (error) throw error;
  } catch (err) {
    alert("문제 활성화 실패: " + err.message);
  }
}

// 9.8 참가자 응답을 quiz_answers 테이블에 기록
async function submitAnswer(questionId, selectedOption, isCorrect) {
  state.answeredQuestionIds.add(questionId);

  if (!supabaseClient || !state.session) return;

  try {
    const { error } = await supabaseClient
      .from('quiz_answers')
      .insert([
        {
          user_id: state.session.user.id,
          question_id: questionId,
          selected_option: selectedOption,
          is_correct: isCorrect,
          activated_at: state.activeQuestionActivatedAt
        }
      ]);
    if (error) throw error;
  } catch (err) {
    console.error("응답 기록 실패:", err.message);
  }
}

// 9.9 실시간 답안 분포 구독 (참가자/관리자 화면 공용)
async function subscribeToAnswerDistribution(questionId) {
  if (state.answerDistributionChannel) {
    supabaseClient.removeChannel(state.answerDistributionChannel);
    state.answerDistributionChannel = null;
  }

  state.answerTally = {};

  const { data, error } = await supabaseClient
    .from('quiz_answers')
    .select('selected_option')
    .eq('question_id', questionId);

  if (!error && data) {
    data.forEach(row => {
      state.answerTally[row.selected_option] = (state.answerTally[row.selected_option] || 0) + 1;
    });
  }

  renderAnswerDistribution();

  state.answerDistributionChannel = supabaseClient
    .channel(`answer_distribution_${questionId}`)
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'quiz_answers', filter: `question_id=eq.${questionId}`
    }, (payload) => {
      const opt = payload.new.selected_option;
      state.answerTally[opt] = (state.answerTally[opt] || 0) + 1;
      renderAnswerDistribution();
    })
    .subscribe();
}

// 9.10 답안 분포 바 렌더 (참가자 화면 + 관리자 화면 동시 갱신)
function renderAnswerDistribution() {
  if (!state.currentQuestion && state.questionList.length === 0) return;

  const question = state.currentQuestion ||
    state.questionList.find(q => q.id === state.activeQuestionId);
  if (!question) return;

  const totalCount = Object.values(state.answerTally).reduce((a, b) => a + b, 0);

  const html = question.options.map((optionText, idx) => {
    const count = state.answerTally[idx] || 0;
    const percent = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;
    return `
      <div class="distribution-row">
        <span class="distribution-label">${String.fromCharCode(65 + idx)}. ${optionText}</span>
        <div class="distribution-bar-track">
          <div class="distribution-bar-fill" style="width: ${percent}%;"></div>
        </div>
        <span class="distribution-count">${count}명</span>
      </div>
    `;
  }).join("");

  if (elements.answerDistribution) {
    elements.answerDistribution.innerHTML = html;
  }
  if (elements.adminAnswerDistribution) {
    elements.adminAnswerDistribution.style.display = "block";
    elements.adminAnswerDistribution.innerHTML = html;
  }
}

// 9.11 리더보드 조회 및 렌더 (누적 점수 기준 내림차순)
async function loadLeaderboard() {
  if (!supabaseClient) return;

  const { data, error } = await supabaseClient
    .from('leaderboard')
    .select('*')
    .order('total_score', { ascending: false })
    .limit(20);

  if (error) {
    console.error("리더보드 조회 실패:", error.message);
    return;
  }

  elements.leaderboardList.innerHTML = "";
  (data || []).forEach((row, idx) => {
    const li = document.createElement("li");
    li.className = "leaderboard-item";
    if (state.session && row.user_id === state.session.user.id) {
      li.classList.add("is-me");
    }
    li.innerHTML = `<span class="leaderboard-rank">${idx + 1}</span><span class="leaderboard-name">${row.username || "도전자"}</span><span class="leaderboard-score">${row.total_score}점</span>`;
    elements.leaderboardList.appendChild(li);
  });
}

// 10. Quiz Render & Timer Engine
function loadQuestion(questionRow) {
  state.currentQuestion = questionRow;
  state.isAnswered = false;

  // 라이브 모드에서는 문제가 실제로 활성화된 시각(activated_at) 기준으로 남은 시간을 계산합니다.
  // 새로고침/재접속으로 이 화면에 다시 진입해도 타이머가 매번 15초로 리셋되지 않도록 하기 위함입니다.
  let initialTimeLeft = TIMER_LIMIT;
  if (supabaseClient && state.session && state.activeQuestionActivatedAt) {
    const elapsedSeconds = (Date.now() - new Date(state.activeQuestionActivatedAt).getTime()) / 1000;
    initialTimeLeft = Math.max(0, Math.ceil(TIMER_LIMIT - elapsedSeconds));
  }
  state.timeLeft = initialTimeLeft;

  // Update Header
  elements.questionPointsBadge.textContent = questionRow.points;
  elements.currentScoreText.textContent = state.score;

  // Render Question Text
  elements.questionText.textContent = questionRow.question_text;

  // Render Options
  elements.optionsContainer.innerHTML = "";
  questionRow.options.forEach((option, optIdx) => {
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

  elements.answerDistribution.innerHTML = "";
  elements.quizFooterMessage.textContent = "";

  resetTimerProgressCircle();

  if (initialTimeLeft <= 0) {
    // 재접속 시점에 이미 제한시간이 지나버린 경우: 바로 시간초과 처리
    handleTimeout();
    return;
  }

  // Start countdown timer
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

  const currentQuestion = state.currentQuestion;
  const isCorrect = selectedIdx === currentQuestion.correct_option;
  const optionButtons = elements.optionsContainer.querySelectorAll(".option-btn");
  const isLiveMode = !!(supabaseClient && state.session);

  if (isCorrect) {
    // Add success styling
    selectedBtn.classList.add("correct");
    selectedBtn.querySelector(".option-status-icon").innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
      </svg>
    `;

    if (!isLiveMode) {
      // 오프라인 모드 전용: 로컬 점수 산정 (100점 기본 + 남은 시간 보너스)
      const baseScore = 100;
      const bonusScore = state.timeLeft * 10;
      state.score += baseScore + bonusScore;
      elements.currentScoreText.textContent = state.score;
    }
  } else {
    // Add wrong styling
    selectedBtn.classList.add("wrong");
    selectedBtn.querySelector(".option-status-icon").innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
      </svg>
    `;

    // Highlight the correct answer
    const correctBtn = optionButtons[currentQuestion.correct_option];
    correctBtn.classList.add("correct");
    correctBtn.querySelector(".option-status-icon").innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
      </svg>
    `;
  }

  // Disable all options
  optionButtons.forEach(btn => btn.disabled = true);

  finishAnswering(currentQuestion.id, selectedIdx, isCorrect);
}

// 12. Handle Timeout
function handleTimeout() {
  state.isAnswered = true;
  state.answers.push(-1); // -1 indicates timeout

  const currentQuestion = state.currentQuestion;
  const optionButtons = elements.optionsContainer.querySelectorAll(".option-btn");

  // Highlight the correct option
  const correctBtn = optionButtons[currentQuestion.correct_option];
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

  finishAnswering(currentQuestion.id, -1, false);
}

// 13. 응답 완료 후 흐름 분기 (라이브 모드: 대기 화면 복귀 / 오프라인 모드: 다음 문제로 자동 진행)
function finishAnswering(questionId, selectedOption, isCorrect) {
  if (supabaseClient && state.session) {
    elements.quizFooterMessage.textContent = "응답이 제출되었습니다. 관리자가 다음 문제를 활성화할 때까지 기다려주세요...";
    submitAnswer(questionId, selectedOption, isCorrect);
    setTimeout(async () => {
      elements.waitingMessage.textContent = "응답을 제출했습니다. 관리자가 다음 문제를 활성화하면 자동으로 화면이 전환됩니다.";
      switchScreen(elements.welcomeScreen);
      await loadLeaderboard();
    }, 1800);
  } else {
    // 오프라인 모드: 기존 순차 진행 방식 유지
    setTimeout(handleNextQuestion, 1800);
  }
}

function handleNextQuestion() {
  const nextIdx = state.offlineIdx + 1;

  if (nextIdx < OFFLINE_DEMO_QUESTIONS.length) {
    state.offlineIdx = nextIdx;
    loadQuestion(OFFLINE_DEMO_QUESTIONS[nextIdx]);
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
    if (ans === OFFLINE_DEMO_QUESTIONS[idx].correct_option) {
      correctCount++;
    }
  });

  // Set UI
  elements.resultGreeting.textContent = `${state.username} 도전자님의 최종 성적표입니다.`;
  elements.finalScoreText.textContent = state.score.toLocaleString();
  elements.correctRatioText.textContent = `${correctCount} / ${OFFLINE_DEMO_QUESTIONS.length}`;
  
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
          correct_ratio: `${correctCount} / ${OFFLINE_DEMO_QUESTIONS.length}`,
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
  
  OFFLINE_DEMO_QUESTIONS.forEach((q, idx) => {
    const userAnswerIdx = state.answers[idx];
    const isCorrect = userAnswerIdx === q.correct_option;

    // Status text
    let statusText = "오답";
    if (isCorrect) statusText = "정답";
    else if (userAnswerIdx === -1) statusText = "시간 초과";

    // User response text
    const userSelectedText = userAnswerIdx === -1 ? "선택하지 않음" : q.options[userAnswerIdx];
    const correctText = q.options[q.correct_option];

    const item = document.createElement("div");
    item.className = "review-item";

    item.innerHTML = `
      <div class="review-header">
        <div class="review-header-title">
          <span class="review-status-badge ${isCorrect ? 'correct' : 'wrong'}">${statusText}</span>
          <span>Q${idx + 1}. ${q.question_text.substring(0, 30)}...</span>
        </div>
        <div class="review-toggle-icon">▼</div>
      </div>
      <div class="review-body">
        <p><strong>질문:</strong> ${q.question_text}</p>
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
  state.offlineIdx = 0;
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
