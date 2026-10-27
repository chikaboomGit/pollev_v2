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
    correct_options: [2],
    points: 100,
    time_limit: 15,
    explanation: "JavaScript의 오래된 역사적 버그로 인해 `typeof null`은 `'object'`를 반환합니다."
  },
  {
    id: "offline-2",
    question_type: "OX",
    question_text: "CSS의 'position: absolute'는 항상 브라우저 뷰포트를 기준으로 배치된다.",
    options: ["O", "X"],
    correct_options: [1],
    points: 100,
    time_limit: 15,
    explanation: "position: absolute는 static이 아닌 가장 가까운 조상 요소를 기준으로 배치됩니다. 해당 조상이 없다면 최상위 html 요소가 기준이 됩니다."
  },
  {
    id: "offline-3",
    question_type: "MULTIPLE",
    question_text: "JavaScript에서 비동기 작업의 상태(Pending/Fulfilled/Rejected)를 나타내는 객체는?",
    options: ["Callback", "Observable", "Promise", "Generator"],
    correct_options: [2],
    points: 100,
    time_limit: 15,
    explanation: "Promise 객체는 비동기 연산의 현재 상태를 캡슐화합니다."
  }
];

// SVG Dash offset variables for Timer Circle (radius r = 26, circumference = ~163.36)
const TIMER_LIMIT = 15; // 기본 제한시간(초) — 문제별 time_limit이 없을 때(오프라인 데모 등) 사용되는 기본값
const CIRCUMFERENCE = 163.36;

// 2. Application State Variables
let state = {
  session: null,
  username: "",
  currentQuestion: null, // 현재 화면에 렌더링된 문제 객체 (DB row 또는 오프라인 데모 문제)
  currentTimeLimit: TIMER_LIMIT, // 현재 문제의 제한시간(초) — 문제별로 가변
  selectedOptionIndices: [], // 제출 전 사용자가 선택해둔 옵션들 (제출 버튼을 눌러야 확정됨, 복수 선택 가능)
  offlineIdx: 0, // 오프라인 모드 전용 순차 진행 인덱스
  score: 0,
  answers: [], // Stores arrays of selected option indices, [] for timeout/무응답 (오프라인 모드 전용)
  timeLeft: 15,
  timerInterval: null,
  isAnswered: false,
  audioCtx: null, // 타이머 비프/Gong 사운드용 Web Audio Context (지연 생성)
  isMuted: false,
  clockOffsetMs: 0, // (DB 서버 시각 - 이 기기의 로컬 시각). 참가자 타이머 계산 시 기기 간 시계 오차를 보정하는 데 사용됩니다.
  isSignUpMode: false, // Toggle between Login and Signup mode

  // Live Quiz (Admin Mode) 관련 상태
  isAdmin: false,
  activeQuestionId: null, // 현재 관리자가 활성화한 문제의 questions.id (null이면 비활성)
  activeQuestionActivatedAt: null, // 현재 활성 문제의 quiz_state.updated_at 스냅샷 (소요시간 채점 기준)
  editingQuestionId: null, // 관리자가 현재 수정 중인 문제 id (null이면 신규 등록 모드)
  quizStateChannel: null,
  answerDistributionChannel: null,
  answerTally: {}, // { optionIdx: count } — 현재 활성 문제의 실시간 답안 분포
  questionList: [], // 관리자 패널에 표시할 등록된 문제 목록 캐시
  folderList: [], // 관리자 패널의 문제 폴더 목록 캐시 (sort_order 순)
  collapsedFolders: {}, // { folderKey: true } — 접힌 폴더 그룹 (localStorage에 저장, 미분류는 "none")
  answerCounts: {}, // { question_id: 참여자 수 } — 관리자 패널의 초기화 버튼에 표시
  opinionCounts: {}, // { question_id: 의견 수 } — 관리자 패널의 의견수렴 문항에 표시
  adminCountdownInterval: null, // 관리자 패널의 활성 문제 남은시간 표시 + 자동 비활성화 타이머
  adminOpinionQuestionId: null, // 관리자 패널에서 의견 피드를 보고 있는 의견수렴 문항 id

  // 의견수렴 관련 상태
  opinionChannel: null, // opinions/opinion_votes/questions 변경 구독 채널 (로그인 시 1회)
  reviewOpinionQuestionId: null, // 대기 화면 "최근 문제 리뷰"에 의견 피드로 표시 중인 문항 id

  // 참가자 대기 화면의 "마지막 문제 리뷰" 관련 상태
  lastQuestionId: null, // 마지막으로 활성화됐던 문제 id (비활성화 이후에도 유지됨)
  lastActivatedAt: null,
  reviewDistributionChannel: null,
  reviewTally: {} // { optionIdx: count } — 리뷰 카드에 표시할 실시간 선택 분포
};

// 3. DOM Elements Cache
const elements = {
  appLoading: document.getElementById("app-loading"),
  appContainer: document.getElementById("app-container"),
  themeToggleBtn: document.getElementById("theme-toggle-btn"),
  muteToggleBtn: document.getElementById("mute-toggle-btn"),

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
  welcomeSubtitleText: document.getElementById("welcome-subtitle-text"),
  logoutBtn: document.getElementById("logout-btn"),
  withdrawBtn: document.getElementById("withdraw-btn"),

  // Waiting Panel (참가자)
  waitingPanel: document.getElementById("waiting-panel"),
  waitingMessage: document.getElementById("waiting-message"),

  // Admin Panel (관리자)
  adminPanel: document.getElementById("admin-panel"),
  adminQuestionList: document.getElementById("admin-question-list"),
  adminDeactivateBtn: document.getElementById("admin-deactivate-btn"),
  adminClearLastQuestionBtn: document.getElementById("admin-clear-last-question-btn"),
  adminClearLastOpinionBtn: document.getElementById("admin-clear-last-opinion-btn"),
  adminAnswerDistribution: document.getElementById("admin-answer-distribution"),
  adminOpinionPanel: document.getElementById("admin-opinion-panel"),
  adminOpinionTitle: document.getElementById("admin-opinion-title"),
  adminOpinionCloseBtn: document.getElementById("admin-opinion-close-btn"),
  adminOpinionFeed: document.getElementById("admin-opinion-feed"),

  // 폴더 추가 폼 (관리자)
  folderForm: document.getElementById("folder-form"),
  folderNameInput: document.getElementById("folder-name-input"),
  folderSubmitBtn: document.getElementById("folder-submit-btn"),

  // 환영 문구 수정 폼 (관리자)
  welcomeMessageForm: document.getElementById("welcome-message-form"),
  welcomeMessageInput: document.getElementById("welcome-message-input"),
  welcomeMessageSubmitBtn: document.getElementById("welcome-message-submit-btn"),

  // 문제 등록/수정 폼 (관리자)
  questionForm: document.getElementById("question-form"),
  questionTextInput: document.getElementById("question-text-input"),
  questionOptionsFields: document.getElementById("question-options-fields"),
  questionFolderSelect: document.getElementById("question-folder-select"),
  questionAnonymousGroup: document.getElementById("question-anonymous-group"),
  questionAnonymousInput: document.getElementById("question-anonymous-input"),
  questionPointsLabel: document.getElementById("question-points-label"),
  questionPointsInput: document.getElementById("question-points-input"),
  questionTimeLimitInput: document.getElementById("question-time-limit-input"),
  questionSubmitBtn: document.getElementById("question-submit-btn"),
  questionCancelEditBtn: document.getElementById("question-cancel-edit-btn"),
  questionDeleteBtn: document.getElementById("question-delete-btn"),

  // 리더보드 (참가자 대기 화면)
  leaderboardList: document.getElementById("leaderboard-list"),

  // 진행 중인 의견수렴 보드 (참가자 대기 화면)
  opinionBoardBox: document.getElementById("opinion-board-box"),
  opinionBoardList: document.getElementById("opinion-board-list"),

  // 마지막 문제 리뷰 (참가자 대기 화면)
  quizReviewEmpty: document.getElementById("quiz-review-empty"),
  quizReviewContent: document.getElementById("quiz-review-content"),
  quizReviewQuestionText: document.getElementById("quiz-review-question-text"),
  quizReviewOptions: document.getElementById("quiz-review-options"),

  quizFooterMessage: document.getElementById("quiz-footer-message"),

  // Quiz Screen Elements
  questionPointsBadge: document.getElementById("question-points-badge"),
  currentScoreText: document.getElementById("current-score"),
  timerText: document.getElementById("timer-text"),
  timerProgress: document.getElementById("timer-progress"),
  questionText: document.getElementById("question-text"),
  optionsContainer: document.getElementById("options-container"),
  submitAnswerBox: document.getElementById("submit-answer-box"),
  submitAnswerBtn: document.getElementById("submit-answer-btn"),
  answerDistribution: document.getElementById("answer-distribution"),

  // 의견수렴 문항 (참가자 퀴즈 화면)
  opinionContainer: document.getElementById("opinion-container"),
  opinionInput: document.getElementById("opinion-input"),
  opinionCharCount: document.getElementById("opinion-char-count"),
  opinionSubmitBtn: document.getElementById("opinion-submit-btn"),
  opinionFeed: document.getElementById("opinion-feed"),

  // Result Screen Elements
  resultGreeting: document.getElementById("result-greeting"),
  finalScoreText: document.getElementById("final-score"),
  correctRatioText: document.getElementById("correct-ratio"),
  rankTitleText: document.getElementById("rank-title"),
  rankDescText: document.getElementById("rank-desc"),
  reviewList: document.getElementById("review-list"),
  retryBtn: document.getElementById("retry-btn")
};

// 세션 복원 확인이 끝나면 로딩 오버레이를 숨기고 앱 화면을 노출합니다. (최초 1회만 동작)
let appRevealed = false;
function revealApp() {
  if (appRevealed) return;
  appRevealed = true;
  elements.appLoading.style.display = "none";
  elements.appContainer.style.display = "block";
}

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
  elements.adminClearLastQuestionBtn.addEventListener("click", clearLastQuestionReveal);
  elements.adminClearLastOpinionBtn.addEventListener("click", clearLastOpinionReveal);
  elements.retryBtn.addEventListener("click", resetQuiz);
  elements.themeToggleBtn.addEventListener("click", toggleTheme);
  elements.muteToggleBtn.addEventListener("click", toggleMute);
  elements.questionForm.addEventListener("submit", handleQuestionFormSubmit);
  elements.questionCancelEditBtn.addEventListener("click", cancelEditQuestion);
  elements.questionDeleteBtn.addEventListener("click", handleDeleteQuestion);
  elements.questionForm.querySelectorAll('input[name="question-type"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      // 의견수렴은 의견 작성·추천에 시간이 더 필요하므로, 제한시간이 기본값 그대로라면 120초로 바꿔 제안합니다.
      if (radio.value === "OPINION" && elements.questionTimeLimitInput.value === "15") {
        elements.questionTimeLimitInput.value = "120";
      } else if (radio.value !== "OPINION" && elements.questionTimeLimitInput.value === "120") {
        elements.questionTimeLimitInput.value = "15";
      }
      renderQuestionOptionFields();
    });
  });
  elements.submitAnswerBtn.addEventListener("click", handleSubmitAnswer);
  elements.welcomeMessageForm.addEventListener("submit", handleWelcomeMessageSubmit);
  elements.folderForm.addEventListener("submit", handleFolderFormSubmit);
  elements.adminOpinionCloseBtn.addEventListener("click", () => {
    state.adminOpinionQuestionId = null;
    elements.adminOpinionPanel.style.display = "none";
  });
  elements.opinionSubmitBtn.addEventListener("click", handleSubmitOpinion);
  elements.opinionInput.addEventListener("input", updateOpinionCharCount);

  // Restore collapsed folder groups from localStorage
  try {
    state.collapsedFolders = JSON.parse(localStorage.getItem("collapsedFolders") || "{}");
  } catch (err) {
    state.collapsedFolders = {};
  }

  // Restore Theme Preferences from localStorage
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "light") {
    document.body.classList.remove("dark-theme");
    document.body.classList.add("light-theme");
  } else {
    document.body.classList.add("dark-theme");
    document.body.classList.remove("light-theme");
  }

  // Restore Mute Preference from localStorage
  state.isMuted = localStorage.getItem("muted") === "true";
  elements.muteToggleBtn.classList.toggle("muted", state.isMuted);
  bgmAudio.muted = state.isMuted;

  // 문제 등록 폼 초기 렌더 (기본 선택: OX)
  renderQuestionOptionFields();

  // Supabase Setup
  const isSupabaseReady = setupSupabase();
  if (isSupabaseReady) {
    syncClockOffset();

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
        revealApp();
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
        await loadWelcomeMessage();

        if (state.isAdmin) {
          elements.waitingPanel.style.display = "none";
          elements.adminPanel.style.display = "block";
          await loadQuestionList();
        } else {
          elements.adminPanel.style.display = "none";
          elements.waitingPanel.style.display = "block";
          await loadLeaderboard();
        }

        await subscribeToQuizState();
        subscribeToOpinionChanges();
      } else {
        // User logged out
        state.username = "";
        state.isAdmin = false;
        state.activeQuestionId = null;
        state.activeQuestionActivatedAt = null;
        state.questionList = [];
        state.folderList = [];
        state.adminOpinionQuestionId = null;
        state.reviewOpinionQuestionId = null;
        elements.adminOpinionPanel.style.display = "none";
        elements.opinionBoardBox.style.display = "none";
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
        if (state.reviewDistributionChannel) {
          supabaseClient.removeChannel(state.reviewDistributionChannel);
          state.reviewDistributionChannel = null;
        }
        if (state.opinionChannel) {
          supabaseClient.removeChannel(state.opinionChannel);
          state.opinionChannel = null;
        }
        clearInterval(state.adminCountdownInterval);
        state.adminCountdownInterval = null;
        state.lastQuestionId = null;
        state.lastActivatedAt = null;

        // 로그아웃 시 로그인 폼 상태를 '로그인 모드'로 리셋
        if (state.isSignUpMode) {
          toggleAuthMode();
        }
      }

      // 세션 복원 확인(최초 1회) 결과가 나온 뒤에야 화면을 노출합니다.
      // 이 시점 이전에 로그인 폼이 잠깐 보였다가 사라지는 깜빡임을 방지하기 위함입니다.
      revealApp();
    });
  } else {
    // Supabase가 없을 경우 로컬 대체 처리 (오프라인 모드) — 세션 확인이 필요 없으므로 즉시 노출
    setupOfflineMode();
    revealApp();
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

// 이 기기의 시계와 DB 서버 시계 사이의 오차를 계산해 캐시합니다.
// (관리자가 문제를 활성화한 시각과 참가자 기기의 현재 시각을 비교해 남은 시간을 계산하는 로직이
// 있는데, 두 기기의 로컬 시계가 어긋나 있으면 남은 시간이 실제보다 많거나 적게 표시될 수 있습니다.
// get_server_time() RPC로 서버 시각을 1회 조회해 오차를 보정합니다.)
async function syncClockOffset() {
  try {
    const { data, error } = await supabaseClient.rpc('get_server_time');
    if (error || !data) return;
    state.clockOffsetMs = new Date(data).getTime() - Date.now();
  } catch (err) {
    console.error("서버 시각 동기화 실패:", err.message);
  }
}

// 기기 시계 오차가 보정된 "현재 시각". quiz_state의 서버 타임스탬프와 비교할 때 사용합니다.
function getServerNow() {
  return Date.now() + state.clockOffsetMs;
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

// 참가자가 특정 문제에 이미 응답했는지 DB 기준으로 확인합니다.
// 로그인 시 한 번만 캐시하는 방식 대신 문제 진입 시마다 직접 조회함으로써,
// 관리자가 응답을 초기화한 경우에도 즉시 정확하게 반영되도록 합니다.
async function hasAnsweredQuestion(uuid, questionId) {
  try {
    const { data, error } = await supabaseClient
      .from('quiz_answers')
      .select('id')
      .eq('user_id', uuid)
      .eq('question_id', questionId)
      .maybeSingle();

    if (error) throw error;
    return !!data;
  } catch (err) {
    console.error("응답 여부 확인 실패:", err.message);
    return false;
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

// 7b. Mute Toggle Logic
function toggleMute() {
  state.isMuted = !state.isMuted;
  localStorage.setItem("muted", state.isMuted ? "true" : "false");
  elements.muteToggleBtn.classList.toggle("muted", state.isMuted);
  bgmAudio.muted = state.isMuted;
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
// Supabase가 초기 세션 복원 시 onAuthStateChange 콜백을 짧은 간격으로 두 번 호출하는 경우가 있어,
// await 이전에 동기적으로 잠금 플래그를 세워 같은 채널을 중복 구독(subscribe 이후 on 호출 에러)하지 않도록 합니다.
let isSubscribingToQuizState = false;
async function subscribeToQuizState() {
  if (!supabaseClient || state.quizStateChannel || isSubscribingToQuizState) return;
  isSubscribingToQuizState = true;

  try {
    // 최초 진입 시 현재 활성 문제 상태를 1회 조회
    const { data, error } = await supabaseClient
      .from('quiz_state')
      .select('active_question_id, updated_at, last_question_id, last_activated_at')
      .eq('id', 1)
      .single();

    if (!error && data) {
      state.lastQuestionId = data.last_question_id;
      state.lastActivatedAt = data.last_activated_at;
      await handleActiveQuestionChange(data.active_question_id, data.updated_at);
    }

    if (!state.quizStateChannel) {
      state.quizStateChannel = supabaseClient
        .channel('quiz_state_changes')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'quiz_state' },
          (payload) => {
            state.lastQuestionId = payload.new.last_question_id;
            state.lastActivatedAt = payload.new.last_activated_at;
            handleActiveQuestionChange(payload.new.active_question_id, payload.new.updated_at);
          })
        .subscribe();
    }
  } finally {
    isSubscribingToQuizState = false;
  }
}

// 9.2 활성 문제 변경 처리 (참가자 화면 전환 + 관리자 패널 갱신 담당)
async function handleActiveQuestionChange(questionId, activatedAt) {
  state.activeQuestionId = questionId;
  state.activeQuestionActivatedAt = activatedAt || null;

  if (state.isAdmin) {
    // 활성 문제가 바뀔 때마다(특히 비활성화 시) 문제별 참여자 수를 최신 상태로 반영합니다.
    await loadQuestionList();
    startAdminCountdown();
    const activeQuestion = state.questionList.find(q => q.id === questionId);
    if (activeQuestion && !isOpinionQuestion(activeQuestion)) {
      subscribeToAnswerDistribution(questionId);
    } else {
      if (state.answerDistributionChannel) {
        supabaseClient.removeChannel(state.answerDistributionChannel);
        state.answerDistributionChannel = null;
      }
      elements.adminAnswerDistribution.style.display = "none";
      // 의견수렴 문항이 활성화되면 답안 분포 대신 의견 피드를 자동으로 띄웁니다.
      if (activeQuestion) {
        state.adminOpinionQuestionId = activeQuestion.id;
        await renderAdminOpinionFeed();
      }
    }
    return;
  }

  if (questionId === null || questionId === undefined) {
    // 참가자가 아직 답을 제출하지 못한 상태에서 관리자가 문제를 비활성화한 경우,
    // 화면 전환만으로는 타이머/BGM이 멈추지 않으므로 여기서 명시적으로 정리합니다.
    if (!state.isAnswered) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
      stopBgm();
    }
    elements.waitingMessage.textContent = "관리자가 문제를 활성화 하거나 설문조사를 요청하면 자동으로 화면이 전환됩니다. 잠시만 기다려주세요...";
    switchScreen(elements.welcomeScreen);
    await loadLeaderboard();
    await loadQuizReview();
    await loadOpinionBoard();
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

  // 의견수렴 문항은 여러 개 제출할 수 있으므로 "이미 응답함" 검사 없이 바로 진입합니다.
  if (isOpinionQuestion(questionRow)) {
    switchScreen(elements.quizScreen);
    loadOpinionQuestion(questionRow);
    return;
  }

  const alreadyAnswered = await hasAnsweredQuestion(state.session.user.id, questionId);
  if (alreadyAnswered) {
    elements.waitingMessage.textContent = "이미 응답을 제출한 문제입니다. 다음 문제를 기다려주세요.";
    switchScreen(elements.welcomeScreen);
    await loadQuizReview();
    await loadOpinionBoard();
    return;
  }

  switchScreen(elements.quizScreen);
  loadQuestion(questionRow);
  subscribeToAnswerDistribution(questionId);
}

// 9.3 관리자: 문제 등록 폼 — 유형(OX/4지선다)에 따라 보기/정답 입력 필드를 동적으로 생성
// prefill이 주어지면(수정 모드) 기존 보기/정답 값을 채워 넣습니다.
function renderQuestionOptionFields(prefill) {
  const type = elements.questionForm.querySelector('input[name="question-type"]:checked').value;

  // 의견수렴은 보기/정답이 없고, 대신 익명 처리 옵션을 노출합니다.
  const isOpinion = type === "OPINION";
  elements.questionOptionsFields.style.display = isOpinion ? "none" : "flex";
  elements.questionAnonymousGroup.style.display = isOpinion ? "block" : "none";
  elements.questionPointsLabel.textContent = isOpinion ? "1위 그룹 배점" : "배점";
  if (isOpinion) {
    elements.questionOptionsFields.innerHTML = "";
    return;
  }

  const optionCount = type === "OX" ? 2 : 4;
  const presetOptions = prefill && prefill.options.length === optionCount
    ? prefill.options
    : (type === "OX" ? ["O", "X"] : ["", "", "", ""]);
  const correctIndices = prefill ? prefill.correct_options : [0];

  elements.questionOptionsFields.innerHTML = "";
  presetOptions.forEach((presetValue, idx) => {
    const row = document.createElement("div");
    row.className = "question-option-row";
    row.innerHTML = `
      <input type="checkbox" name="question-correct" value="${idx}" ${correctIndices.includes(idx) ? "checked" : ""}>
      <input type="text" class="question-option-input" placeholder="보기 ${idx + 1}" value="${presetValue}" ${type === "OX" ? "readonly" : ""} required>
    `;
    elements.questionOptionsFields.appendChild(row);
  });
}

// 9.4 관리자: 문제 등록/수정 (state.editingQuestionId 유무로 분기)
async function handleQuestionFormSubmit(e) {
  e.preventDefault();

  const type = elements.questionForm.querySelector('input[name="question-type"]:checked').value;
  const questionText = elements.questionTextInput.value.trim();
  const optionInputs = Array.from(elements.questionOptionsFields.querySelectorAll(".question-option-input"));
  const options = optionInputs.map(input => input.value.trim());
  const correctCheckboxes = Array.from(elements.questionForm.querySelectorAll('input[name="question-correct"]:checked'));
  const points = parseInt(elements.questionPointsInput.value, 10);
  const timeLimit = parseInt(elements.questionTimeLimitInput.value, 10);

  const isOpinion = type === "OPINION";
  const folderId = elements.questionFolderSelect.value ? parseInt(elements.questionFolderSelect.value, 10) : null;

  if (!questionText) {
    alert("문제 내용을 입력해주세요.");
    return;
  }
  if (!isOpinion && options.some(opt => !opt)) {
    alert("모든 보기를 입력해주세요.");
    return;
  }
  if (!isOpinion && correctCheckboxes.length === 0) {
    alert("정답을 최소 1개 선택해주세요.");
    return;
  }
  if (isNaN(points) || points < 0) {
    alert("배점은 0 이상의 숫자여야 합니다.");
    return;
  }
  if (!timeLimit || timeLimit <= 0) {
    alert("제한시간은 1 이상의 숫자여야 합니다.");
    return;
  }

  const isEditing = state.editingQuestionId !== null;

  if (isEditing && state.editingQuestionId === state.activeQuestionId) {
    const proceed = confirm("지금 활성화되어 참가자들이 풀고 있는 문제입니다. 수정하면 참가자 화면과 내용이 달라질 수 있습니다. 계속하시겠습니까?");
    if (!proceed) return;
  }

  elements.questionSubmitBtn.disabled = true;
  elements.questionSubmitBtn.textContent = isEditing ? "수정 중..." : "등록 중...";

  const payload = {
    question_type: type,
    question_text: questionText,
    options: isOpinion ? [] : options,
    correct_options: isOpinion ? [] : correctCheckboxes.map(cb => parseInt(cb.value, 10)),
    points: points,
    time_limit: timeLimit,
    is_anonymous: isOpinion && elements.questionAnonymousInput.checked,
    folder_id: folderId
  };

  // 새로 등록하거나 다른 폴더로 옮기는 문제는 해당 폴더(또는 미분류)의 맨 끝에 배치합니다.
  const editingQuestion = isEditing ? state.questionList.find(q => q.id === state.editingQuestionId) : null;
  if (!editingQuestion || (editingQuestion.folder_id || null) !== folderId) {
    payload.sort_order = getNextSortOrder(folderId);
  }

  try {
    if (isEditing) {
      const { error } = await supabaseClient
        .from('questions')
        .update(payload)
        .eq('id', state.editingQuestionId);
      if (error) throw error;
    } else {
      const { error } = await supabaseClient
        .from('questions')
        .insert([{ ...payload, created_by: state.session.user.id }]);
      if (error) throw error;
    }

    cancelEditQuestion();
    await loadQuestionList();
  } catch (err) {
    console.error("문제 저장 실패:", err);
    alert("문제 저장에 실패했습니다: " + err.message);
  } finally {
    elements.questionSubmitBtn.disabled = false;
    elements.questionSubmitBtn.textContent = state.editingQuestionId ? "수정 완료" : "문제 등록하기";
  }
}

// 9.4b 관리자: 문제 수정 모드 진입 — 폼에 기존 값 채우기
function startEditQuestion(question) {
  state.editingQuestionId = question.id;

  elements.questionForm.querySelector(`input[name="question-type"][value="${question.question_type}"]`).checked = true;
  elements.questionTextInput.value = question.question_text;
  renderQuestionOptionFields(question);
  elements.questionPointsInput.value = question.points;
  elements.questionTimeLimitInput.value = question.time_limit;
  elements.questionFolderSelect.value = question.folder_id || "";
  elements.questionAnonymousInput.checked = !!question.is_anonymous;

  elements.questionSubmitBtn.textContent = "수정 완료";
  elements.questionCancelEditBtn.style.display = "inline-block";
  elements.questionDeleteBtn.style.display = "inline-block";
  elements.questionForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

// 9.4c 관리자: 문제 수정 모드 취소 → 등록 모드로 복귀
function cancelEditQuestion() {
  state.editingQuestionId = null;
  elements.questionTextInput.value = "";
  elements.questionPointsInput.value = "100";
  elements.questionTimeLimitInput.value = isOpinionTypeSelected() ? "120" : "15";
  elements.questionAnonymousInput.checked = false;
  // 폴더 선택은 유지해, 같은 폴더에 문제를 연속으로 등록하기 편하게 합니다.
  renderQuestionOptionFields();
  elements.questionSubmitBtn.textContent = "문제 등록하기";
  elements.questionCancelEditBtn.style.display = "none";
  elements.questionDeleteBtn.style.display = "none";
}

// 9.4d 관리자: 수정 중인 문제를 삭제
async function handleDeleteQuestion() {
  if (!state.editingQuestionId) return;

  const isActive = state.editingQuestionId === state.activeQuestionId;
  const confirmMessage = isActive
    ? "지금 활성화되어 참가자들이 풀고 있는 문제입니다. 삭제하면 참가자 화면에 영향을 줄 수 있습니다. 정말 삭제하시겠습니까?"
    : "이 문제와 관련된 모든 응답 기록이 함께 삭제됩니다. 정말 삭제하시겠습니까?";
  if (!confirm(confirmMessage)) return;

  elements.questionDeleteBtn.disabled = true;
  try {
    const { error } = await supabaseClient
      .from('questions')
      .delete()
      .eq('id', state.editingQuestionId);
    if (error) throw error;

    cancelEditQuestion();
    await loadQuestionList();
    alert("문제가 삭제되었습니다.");
  } catch (err) {
    console.error("문제 삭제 실패:", err);
    alert("문제 삭제에 실패했습니다: " + err.message);
  } finally {
    elements.questionDeleteBtn.disabled = false;
  }
}

// 9.4d 참가자/관리자 공용: 대기 화면에 표시할 환영 문구 조회
async function loadWelcomeMessage() {
  try {
    const { data, error } = await supabaseClient
      .from('app_settings')
      .select('welcome_message')
      .eq('id', 1)
      .single();

    if (error) throw error;
    if (data && data.welcome_message) {
      elements.welcomeSubtitleText.textContent = data.welcome_message;
      document.title = data.welcome_message;
      if (state.isAdmin) {
        elements.welcomeMessageInput.value = data.welcome_message;
      }
    }
  } catch (err) {
    console.error("환영 문구 조회 실패:", err.message);
  }
}

// 9.4e 관리자: 환영 문구 저장
async function handleWelcomeMessageSubmit(e) {
  e.preventDefault();

  const message = elements.welcomeMessageInput.value.trim();
  if (!message) {
    alert("문구를 입력해주세요.");
    return;
  }

  elements.welcomeMessageSubmitBtn.disabled = true;
  elements.welcomeMessageSubmitBtn.textContent = "저장 중...";

  try {
    const { error } = await supabaseClient
      .from('app_settings')
      .update({ welcome_message: message, updated_at: new Date().toISOString() })
      .eq('id', 1);
    if (error) throw error;

    elements.welcomeSubtitleText.textContent = message;
    document.title = message;
    alert("환영 문구가 저장되었습니다.");
  } catch (err) {
    console.error("환영 문구 저장 실패:", err);
    alert("환영 문구 저장에 실패했습니다: " + err.message);
  } finally {
    elements.welcomeMessageSubmitBtn.disabled = false;
    elements.welcomeMessageSubmitBtn.textContent = "문구 저장하기";
  }
}

// 9.5 관리자: 등록된 문제·폴더 목록 조회 및 렌더 (문제별 참여자 수/의견 수도 함께 집계)
async function loadQuestionList() {
  const [questionResult, folderResult, answerResult, opinionResult] = await Promise.all([
    supabaseClient.from('questions').select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    supabaseClient.from('question_folders').select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    supabaseClient.from('quiz_answers').select('question_id'),
    supabaseClient.from('opinions').select('question_id')
  ]);

  if (questionResult.error) {
    console.error("문제 목록 조회 실패:", questionResult.error.message);
    return;
  }

  state.questionList = questionResult.data || [];

  if (folderResult.error) {
    console.error("폴더 목록 조회 실패:", folderResult.error.message);
    state.folderList = [];
  } else {
    state.folderList = folderResult.data || [];
  }

  state.answerCounts = {};
  if (answerResult.error) {
    console.error("참여자 수 집계 실패:", answerResult.error.message);
  } else {
    (answerResult.data || []).forEach(row => {
      state.answerCounts[row.question_id] = (state.answerCounts[row.question_id] || 0) + 1;
    });
  }

  state.opinionCounts = {};
  if (opinionResult.error) {
    console.error("의견 수 집계 실패:", opinionResult.error.message);
  } else {
    (opinionResult.data || []).forEach(row => {
      state.opinionCounts[row.question_id] = (state.opinionCounts[row.question_id] || 0) + 1;
    });
  }

  renderAdminPanel();
}

// 문제 등록 폼의 폴더 선택 목록을 최신 폴더 목록으로 갱신 (선택값은 유지)
function renderFolderSelect() {
  const currentValue = elements.questionFolderSelect.value;
  elements.questionFolderSelect.innerHTML = '<option value="">미분류</option>';
  state.folderList.forEach(folder => {
    const option = document.createElement("option");
    option.value = folder.id;
    option.textContent = folder.name;
    elements.questionFolderSelect.appendChild(option);
  });
  const stillExists = state.folderList.some(folder => String(folder.id) === currentValue);
  elements.questionFolderSelect.value = stillExists ? currentValue : "";
}

// 폴더별로 문제를 묶습니다. 폴더 순서대로 나열하고 "미분류" 그룹은 항상 마지막에 둡니다.
function getQuestionGroups() {
  const folderIds = new Set(state.folderList.map(folder => folder.id));
  const groups = state.folderList.map(folder => ({
    folder,
    questions: state.questionList.filter(q => q.folder_id === folder.id)
  }));
  groups.push({
    folder: null,
    questions: state.questionList.filter(q => !q.folder_id || !folderIds.has(q.folder_id))
  });
  return groups;
}

// 해당 폴더(null이면 미분류)의 맨 끝에 배치할 sort_order 값
function getNextSortOrder(folderId) {
  const group = getQuestionGroups().find(g => (g.folder ? g.folder.id : null) === folderId);
  const orders = group ? group.questions.map(q => q.sort_order || 0) : [];
  return orders.length > 0 ? Math.max(...orders) + 1 : 1;
}

function isOpinionQuestion(question) {
  return !!question && question.question_type === "OPINION";
}

function isOpinionTypeSelected() {
  return elements.questionForm.querySelector('input[name="question-type"]:checked').value === "OPINION";
}

// 9.6 관리자 패널 렌더링 (폴더 그룹 → 그룹 안의 문제 목록)
function renderAdminPanel() {
  elements.adminQuestionList.innerHTML = "";
  renderFolderSelect();

  if (state.questionList.length === 0 && state.folderList.length === 0) {
    elements.adminQuestionList.innerHTML = "<p>등록된 문제가 없습니다. 위 폼에서 문제를 먼저 등록해주세요.</p>";
    return;
  }

  const groups = getQuestionGroups();
  const folderGroupCount = groups.length - 1; // 마지막 미분류 그룹 제외
  groups.forEach((group, groupIdx) => {
    elements.adminQuestionList.appendChild(buildFolderGroup(group, groupIdx, folderGroupCount));
  });
}

function buildFolderGroup(group, groupIdx, folderGroupCount) {
  const { folder, questions } = group;
  const folderKey = folder ? String(folder.id) : "none";
  // 활성 문제가 들어있는 폴더는 남은 시간 표시가 보이도록 항상 펼칩니다.
  const hasActive = questions.some(q => q.id === state.activeQuestionId);
  const isCollapsed = !!state.collapsedFolders[folderKey] && !hasActive;

  const groupEl = document.createElement("div");
  groupEl.className = "folder-group";
  if (isCollapsed) groupEl.classList.add("collapsed");

  const header = document.createElement("div");
  header.className = "folder-header";

  const toggleBtn = document.createElement("button");
  toggleBtn.type = "button";
  toggleBtn.className = "folder-toggle-btn";
  toggleBtn.textContent = `${isCollapsed ? "▶" : "▼"} ${folder ? "📁" : "📂"} ${folder ? folder.name : "미분류"} (${questions.length})`;
  toggleBtn.addEventListener("click", () => {
    if (state.collapsedFolders[folderKey]) {
      delete state.collapsedFolders[folderKey];
    } else {
      state.collapsedFolders[folderKey] = true;
    }
    localStorage.setItem("collapsedFolders", JSON.stringify(state.collapsedFolders));
    renderAdminPanel();
  });
  header.appendChild(toggleBtn);

  // 미분류 그룹은 이동/이름변경/삭제할 수 없습니다.
  if (folder) {
    const actions = document.createElement("div");
    actions.className = "folder-actions";
    actions.appendChild(buildMoveButton("▲", "폴더를 위로", groupIdx === 0, () => moveFolder(groupIdx, -1)));
    actions.appendChild(buildMoveButton("▼", "폴더를 아래로", groupIdx === folderGroupCount - 1, () => moveFolder(groupIdx, 1)));

    const renameBtn = document.createElement("button");
    renameBtn.type = "button";
    renameBtn.className = "btn btn-secondary folder-action-btn";
    renameBtn.textContent = "이름변경";
    renameBtn.addEventListener("click", () => renameFolder(folder));
    actions.appendChild(renameBtn);

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "btn btn-danger folder-action-btn";
    deleteBtn.textContent = "삭제";
    deleteBtn.addEventListener("click", () => deleteFolder(folder));
    actions.appendChild(deleteBtn);

    header.appendChild(actions);
  }
  groupEl.appendChild(header);

  const body = document.createElement("div");
  body.className = "folder-body";
  if (questions.length === 0) {
    const empty = document.createElement("p");
    empty.className = "folder-empty";
    empty.textContent = "문제가 없습니다.";
    body.appendChild(empty);
  }
  questions.forEach((q, idx) => {
    body.appendChild(buildQuestionRow(q, idx, questions));
  });
  groupEl.appendChild(body);

  return groupEl;
}

function buildMoveButton(label, title, disabled, onClick) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn btn-secondary move-btn";
  btn.textContent = label;
  btn.title = title;
  btn.setAttribute("aria-label", title);
  btn.disabled = disabled;
  btn.addEventListener("click", onClick);
  return btn;
}

function buildQuestionRow(q, idx, groupQuestions) {
  const row = document.createElement("div");
  row.className = "admin-question-row";

  const isActive = state.activeQuestionId === q.id;
  const isOpinion = isOpinionQuestion(q);

  const moveBox = document.createElement("div");
  moveBox.className = "move-btns";
  moveBox.appendChild(buildMoveButton("▲", "위로 이동", idx === 0, () => moveQuestion(groupQuestions, idx, -1)));
  moveBox.appendChild(buildMoveButton("▼", "아래로 이동", idx === groupQuestions.length - 1, () => moveQuestion(groupQuestions, idx, 1)));

  const activateBtn = document.createElement("button");
  activateBtn.type = "button";
  activateBtn.className = "btn btn-secondary admin-question-btn";
  if (isOpinion) {
    const opinionStatus = !q.opinion_opened_at ? "미진행" : (q.opinion_closed_at ? "마감" : "추천 진행중");
    activateBtn.textContent = `[의견수렴 / ${q.points}점 / ${q.time_limit}초${q.is_anonymous ? " / 익명" : ""}] ${q.question_text} (의견 ${state.opinionCounts[q.id] || 0}개 · ${opinionStatus}${q.opinion_hidden ? " · 숨김" : ""})`;
  } else {
    activateBtn.textContent = `[${q.question_type === "OX" ? "OX" : "4지선다"} / ${q.points}점 / ${q.time_limit}초] ${q.question_text}`;
  }
  if (isActive) {
    activateBtn.classList.add("active-question");
    activateBtn.textContent += " (활성 중 — 다시 누르면 비활성화)";
  }
  // 이미 활성화된 문제를 다시 누르면 비활성화되도록 토글 처리 (관리자 진행 편의)
  activateBtn.addEventListener("click", () => activateQuestion(isActive ? null : q.id));

  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.className = "btn btn-secondary admin-question-action-btn";
  editBtn.textContent = "수정";
  editBtn.addEventListener("click", () => startEditQuestion(q));

  row.appendChild(moveBox);
  row.appendChild(activateBtn);
  row.appendChild(editBtn);

  if (isOpinion) {
    const viewBtn = document.createElement("button");
    viewBtn.type = "button";
    viewBtn.className = "btn btn-secondary admin-question-action-btn";
    viewBtn.textContent = "의견 보기";
    viewBtn.addEventListener("click", async () => {
      state.adminOpinionQuestionId = q.id;
      await renderAdminOpinionFeed();
      elements.adminOpinionPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    row.appendChild(viewBtn);

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "btn btn-secondary admin-question-action-btn";
    closeBtn.textContent = q.opinion_closed_at ? "마감 해제" : "추천 마감";
    closeBtn.addEventListener("click", () => (q.opinion_closed_at ? reopenOpinion(q) : finalizeOpinion(q)));
    row.appendChild(closeBtn);
  }

  const resetBtn = document.createElement("button");
  resetBtn.type = "button";
  resetBtn.className = "btn btn-danger admin-question-action-btn";
  resetBtn.textContent = isOpinion
    ? `초기화 (의견 ${state.opinionCounts[q.id] || 0}개)`
    : `초기화 (참여 ${state.answerCounts[q.id] || 0}명)`;
  resetBtn.addEventListener("click", () => resetQuestionAnswers(q.id));
  row.appendChild(resetBtn);

  if (isActive) {
    const countdownSpan = document.createElement("span");
    countdownSpan.id = "admin-active-countdown";
    countdownSpan.className = "admin-countdown";
    row.appendChild(countdownSpan);
  }

  return row;
}

// 정렬된 목록 순서대로 sort_order를 1부터 다시 매겨 저장합니다. (값이 달라진 행만 update)
// 이웃 두 행만 교환하지 않고 전체를 재번호하는 이유: 마이그레이션 직후 등 sort_order가 중복된 경우에도 순서가 확실히 반영되도록 하기 위함
async function saveSortOrder(table, orderedItems) {
  const changed = orderedItems
    .map((item, i) => ({ item, order: i + 1 }))
    .filter(({ item, order }) => item.sort_order !== order);
  const results = await Promise.all(changed.map(({ item, order }) =>
    supabaseClient.from(table).update({ sort_order: order }).eq('id', item.id)
  ));
  const failed = results.find(result => result.error);
  if (failed) throw failed.error;
}

// 9.6a 관리자: 같은 폴더 안에서 문제 순서 이동
async function moveQuestion(groupQuestions, idx, direction) {
  const targetIdx = idx + direction;
  if (targetIdx < 0 || targetIdx >= groupQuestions.length) return;

  const reordered = [...groupQuestions];
  [reordered[idx], reordered[targetIdx]] = [reordered[targetIdx], reordered[idx]];

  try {
    await saveSortOrder('questions', reordered);
  } catch (err) {
    console.error("문제 순서 변경 실패:", err);
    alert("문제 순서 변경에 실패했습니다: " + err.message);
  }
  await loadQuestionList();
}

// 9.6a 관리자: 폴더 순서 이동
async function moveFolder(idx, direction) {
  const targetIdx = idx + direction;
  if (targetIdx < 0 || targetIdx >= state.folderList.length) return;

  const reordered = [...state.folderList];
  [reordered[idx], reordered[targetIdx]] = [reordered[targetIdx], reordered[idx]];

  try {
    await saveSortOrder('question_folders', reordered);
  } catch (err) {
    console.error("폴더 순서 변경 실패:", err);
    alert("폴더 순서 변경에 실패했습니다: " + err.message);
  }
  await loadQuestionList();
}

// 9.6a 관리자: 폴더 추가 (맨 끝에 배치)
async function handleFolderFormSubmit(e) {
  e.preventDefault();

  const name = elements.folderNameInput.value.trim();
  if (!name) {
    alert("폴더 이름을 입력해주세요.");
    return;
  }

  elements.folderSubmitBtn.disabled = true;
  try {
    const nextOrder = state.folderList.length > 0
      ? Math.max(...state.folderList.map(folder => folder.sort_order || 0)) + 1
      : 1;
    const { error } = await supabaseClient
      .from('question_folders')
      .insert([{ name, sort_order: nextOrder }]);
    if (error) throw error;

    elements.folderNameInput.value = "";
    await loadQuestionList();
  } catch (err) {
    console.error("폴더 추가 실패:", err);
    alert("폴더 추가에 실패했습니다: " + err.message);
  } finally {
    elements.folderSubmitBtn.disabled = false;
  }
}

async function renameFolder(folder) {
  const input = prompt("새 폴더 이름을 입력하세요.", folder.name);
  if (input === null) return;
  const name = input.trim();
  if (!name || name.length > 50) {
    alert("폴더 이름은 1자 이상 50자 이하로 입력해주세요.");
    return;
  }

  try {
    const { error } = await supabaseClient
      .from('question_folders')
      .update({ name })
      .eq('id', folder.id);
    if (error) throw error;
    await loadQuestionList();
  } catch (err) {
    console.error("폴더 이름 변경 실패:", err);
    alert("폴더 이름 변경에 실패했습니다: " + err.message);
  }
}

// 폴더를 삭제하면 안에 있던 문제는 DB의 on delete set null에 의해 미분류로 이동합니다.
async function deleteFolder(folder) {
  if (!confirm(`'${folder.name}' 폴더를 삭제합니다. 폴더 안의 문제는 삭제되지 않고 미분류로 이동합니다. 계속하시겠습니까?`)) return;

  try {
    const { error } = await supabaseClient
      .from('question_folders')
      .delete()
      .eq('id', folder.id);
    if (error) throw error;

    delete state.collapsedFolders[String(folder.id)];
    localStorage.setItem("collapsedFolders", JSON.stringify(state.collapsedFolders));
    await loadQuestionList();
  } catch (err) {
    console.error("폴더 삭제 실패:", err);
    alert("폴더 삭제에 실패했습니다: " + err.message);
  }
}

// 9.6b 관리자: 특정 문제에 쌓인 참가자 응답을 전부 삭제 (다시 풀 수 있는 상태로 초기화)
async function resetQuestionAnswers(questionId) {
  const isOpinion = isOpinionQuestion(state.questionList.find(q => q.id === questionId));
  const proceed = confirm(isOpinion
    ? "이 문항의 모든 의견과 추천 기록을 삭제하고, 추천 마감도 해제합니다. 계속하시겠습니까?"
    : "이 문제에 대한 모든 참가자의 응답 기록을 삭제합니다. 계속하시겠습니까?");
  if (!proceed) return;

  try {
    if (isOpinion) {
      // 의견을 지우면 추천 기록은 FK on delete cascade로 함께 삭제됩니다.
      const { error } = await supabaseClient
        .from('opinions')
        .delete()
        .eq('question_id', questionId);
      if (error) throw error;
      const { error: reopenError } = await supabaseClient.rpc('reopen_opinion', { target_question_id: questionId });
      if (reopenError) throw reopenError;
    } else {
      const { error } = await supabaseClient
        .from('quiz_answers')
        .delete()
        .eq('question_id', questionId);
      if (error) throw error;
    }

    // 지금 진행 중인 문제를 초기화한 경우, quiz_state를 다시 갱신해 모든 참가자에게
    // "새로 풀 수 있는 상태"로 재브로드캐스트합니다 (타이머도 새 시각 기준으로 재시작됨).
    if (questionId === state.activeQuestionId) {
      const nowIso = new Date().toISOString();
      const { error: restateError } = await supabaseClient
        .from('quiz_state')
        .update({
          active_question_id: questionId,
          updated_at: nowIso,
          last_question_id: questionId,
          last_activated_at: nowIso
        })
        .eq('id', 1);
      if (restateError) throw restateError;
      if (!isOpinion) {
        await subscribeToAnswerDistribution(questionId);
      }
    } else {
      // 비활성 문제를 초기화한 경우엔 quiz_state 변경이 없어 목록을 직접 새로고침해야
      // "초기화" 버튼의 참여자 수 표시가 즉시 0명으로 갱신됩니다.
      await loadQuestionList();
    }

    alert("응답 기록이 초기화되었습니다.");
  } catch (err) {
    console.error("응답 초기화 실패:", err);
    alert("응답 초기화에 실패했습니다: " + err.message);
  }
}

// 9.6c 관리자: 활성 문제의 남은 시간을 표시하고, 제한시간이 다 되면 자동으로 비활성화합니다.
// (서버 측 스케줄러 없이 순수 클라이언트로 동작하므로, 관리자 화면이 열려있는 동안에만 자동 비활성화가 작동합니다.)
function startAdminCountdown() {
  clearInterval(state.adminCountdownInterval);
  state.adminCountdownInterval = null;

  if (!state.activeQuestionId || !state.activeQuestionActivatedAt) return;

  const activeQuestion = state.questionList.find(q => q.id === state.activeQuestionId);
  if (!activeQuestion) return;

  const timeLimit = activeQuestion.time_limit || TIMER_LIMIT;
  const activatedAtMs = new Date(state.activeQuestionActivatedAt).getTime();
  let autoDeactivating = false;

  const tick = () => {
    const elapsedSeconds = (getServerNow() - activatedAtMs) / 1000;
    const remaining = Math.max(0, Math.ceil(timeLimit - elapsedSeconds));

    const countdownEl = document.getElementById("admin-active-countdown");
    if (countdownEl) {
      countdownEl.textContent = `남은 시간: ${remaining}초`;
    }

    if (remaining <= 0 && !autoDeactivating) {
      autoDeactivating = true;
      clearInterval(state.adminCountdownInterval);
      state.adminCountdownInterval = null;
      // 제한시간 종료 → 자동으로 비활성화 (5분위 채점 마감 포함)
      activateQuestion(null);
    }
  };

  tick();
  state.adminCountdownInterval = setInterval(tick, 1000);
}

// 9.7 관리자: 문제 활성화/비활성화 (활성화 전, 직전 문제가 있었다면 5분위 채점을 먼저 마감)
async function activateQuestion(questionId) {
  try {
    const nextQuestion = state.questionList.find(q => q.id === questionId);
    if (isOpinionQuestion(nextQuestion) && nextQuestion.opinion_closed_at) {
      // 마감된 의견수렴은 의견 제출/추천이 막혀 있으므로, 다시 진행하려면 마감을 먼저 해제해야 합니다.
      if (!confirm("이미 추천이 마감된 의견수렴입니다. 마감을 해제(확정 점수 0점으로 초기화)하고 다시 진행하시겠습니까?")) return;
      const { error: reopenError } = await supabaseClient.rpc('reopen_opinion', { target_question_id: questionId });
      if (reopenError) throw reopenError;
    }
    if (isOpinionQuestion(nextQuestion) && (!nextQuestion.opinion_opened_at || nextQuestion.opinion_hidden)) {
      // 처음 활성화되는 의견수렴은 진행 시작 시각을 기록해, 비활성화 이후에도 참가자 대기 화면에서 추천을 계속할 수 있게 합니다.
      // "마지막 의견 수렴 공개 초기화"로 숨겨졌던 문항은 다시 활성화하면 대기 화면에 다시 표시합니다.
      const openPayload = { opinion_hidden: false };
      if (!nextQuestion.opinion_opened_at) openPayload.opinion_opened_at = new Date().toISOString();
      const { error: openError } = await supabaseClient
        .from('questions')
        .update(openPayload)
        .eq('id', questionId);
      if (openError) throw openError;
    }

    // 의견수렴 문항은 관리자가 별도로 "추천 마감"할 때 채점하므로, 퀴즈 5분위 채점 마감은 건너뜁니다.
    const prevQuestion = state.questionList.find(q => q.id === state.activeQuestionId);
    if (state.activeQuestionId && !isOpinionQuestion(prevQuestion)) {
      const { error: finalizeError } = await supabaseClient.rpc('finalize_question_scoring', {
        target_question_id: state.activeQuestionId
      });
      if (finalizeError) console.error("채점 마감 실패:", finalizeError.message);
    }

    const updatePayload = { active_question_id: questionId, updated_at: new Date().toISOString() };
    if (questionId !== null && questionId !== undefined) {
      // 비활성화 시에는 last_question_id/last_activated_at을 건드리지 않아,
      // 대기 화면에서 "마지막 문제 리뷰"로 계속 참조할 수 있도록 합니다.
      updatePayload.last_question_id = questionId;
      updatePayload.last_activated_at = updatePayload.updated_at;
    }

    const { error } = await supabaseClient
      .from('quiz_state')
      .update(updatePayload)
      .eq('id', 1);

    if (error) throw error;
  } catch (err) {
    alert("문제 활성화 실패: " + err.message);
  }
}

// 9.7b 관리자: "마지막 문제 리뷰"용 DB 값을 초기화해, 참가자 대기 화면에서
// 마지막으로 풀었던 문제와 정답 공개가 더 이상 노출되지 않도록 합니다.
async function clearLastQuestionReveal() {
  const proceed = confirm("마지막으로 공개됐던 문제와 정답을 참가자 화면에서 더 이상 볼 수 없도록 초기화합니다. 계속하시겠습니까?");
  if (!proceed) return;

  try {
    const { error } = await supabaseClient
      .from('quiz_state')
      .update({ last_question_id: null, last_activated_at: null })
      .eq('id', 1);

    if (error) throw error;

    state.lastQuestionId = null;
    state.lastActivatedAt = null;
    alert("마지막 문제 공개가 초기화되었습니다.");
  } catch (err) {
    console.error("마지막 문제 초기화 실패:", err);
    alert("초기화에 실패했습니다: " + err.message);
  }
}

// 9.7b-2 관리자: 참가자 대기 화면에 표시되는 의견수렴("최근 문제 리뷰"·"진행 중인 의견수렴")을 모두 숨깁니다.
// 지금 진행 중인 문항은 제외하며, 숨긴 문항은 다시 활성화하면 다시 표시됩니다. (추천 마감/점수에는 영향 없음)
async function clearLastOpinionReveal() {
  const proceed = confirm("참가자 대기 화면에 표시된 의견수렴(최근 리뷰·진행 중 목록)을 모두 숨깁니다. 숨긴 문항은 다시 활성화하면 다시 표시됩니다. 계속하시겠습니까?");
  if (!proceed) return;

  try {
    let query = supabaseClient
      .from('questions')
      .update({ opinion_hidden: true })
      .eq('question_type', 'OPINION')
      .eq('opinion_hidden', false);
    if (state.activeQuestionId) query = query.neq('id', state.activeQuestionId);
    const { error } = await query;

    if (error) throw error;

    await loadQuestionList();
    alert("마지막 의견 수렴 공개가 초기화되었습니다.");
  } catch (err) {
    console.error("마지막 의견 수렴 초기화 실패:", err);
    alert("초기화에 실패했습니다: " + err.message);
  }
}

// 9.7c 관리자: 의견수렴 추천 마감 → 추천 순위 5분위로 점수 확정
async function finalizeOpinion(question) {
  if (!confirm("추천을 마감하고 추천 순위에 따라 점수를 확정합니다. 마감 후에는 의견 제출과 추천이 불가합니다. 계속하시겠습니까?")) return;

  try {
    const { error } = await supabaseClient.rpc('finalize_opinion_scoring', { target_question_id: question.id });
    if (error) throw error;

    await loadQuestionList();
    await renderAdminOpinionFeed();
    alert("추천이 마감되고 점수가 확정되었습니다.");
  } catch (err) {
    console.error("추천 마감 실패:", err);
    alert("추천 마감에 실패했습니다: " + err.message);
  }
}

// 9.7d 관리자: 추천 마감 해제 (확정 점수는 0점으로 되돌아감)
async function reopenOpinion(question) {
  if (!confirm("마감을 해제하면 확정된 점수가 0점으로 돌아가고 다시 추천을 받을 수 있습니다. 계속하시겠습니까?")) return;

  try {
    const { error } = await supabaseClient.rpc('reopen_opinion', { target_question_id: question.id });
    if (error) throw error;

    await loadQuestionList();
    await renderAdminOpinionFeed();
  } catch (err) {
    console.error("마감 해제 실패:", err);
    alert("마감 해제에 실패했습니다: " + err.message);
  }
}

// 9.7e 관리자: 선택한 의견수렴 문항의 피드 (익명 문항이어도 작성자 닉네임 표시 + 의견 삭제 가능)
async function renderAdminOpinionFeed() {
  const question = state.questionList.find(q => q.id === state.adminOpinionQuestionId);
  if (!question) {
    elements.adminOpinionPanel.style.display = "none";
    return;
  }

  const opinions = await fetchOpinions(question.id);
  if (!opinions || state.adminOpinionQuestionId !== question.id) return;

  const statusText = question.opinion_closed_at ? "마감" : "추천 진행중";
  elements.adminOpinionTitle.textContent = `💬 ${question.question_text} (${statusText}${question.is_anonymous ? " · 익명" : ""})`;
  elements.adminOpinionPanel.style.display = "block";
  renderOpinionFeed(elements.adminOpinionFeed, question, opinions, { canVote: false, adminMode: true });
}

// 의견 목록 조회: 추천수 내림차순 → 먼저 제출된 순으로 정렬
async function fetchOpinions(questionId) {
  const { data, error } = await supabaseClient
    .from('opinions')
    .select('id, content, user_id, created_at, points_awarded, author:profiles!opinions_user_id_fkey(username), opinion_votes(user_id)')
    .eq('question_id', questionId);

  if (error) {
    console.error("의견 조회 실패:", error.message);
    return null;
  }

  const myId = state.session.user.id;
  return (data || []).map(row => ({
    id: row.id,
    content: row.content,
    createdAt: row.created_at,
    pointsAwarded: row.points_awarded,
    authorName: (row.author && row.author.username) || "도전자",
    voteCount: (row.opinion_votes || []).length,
    votedByMe: (row.opinion_votes || []).some(vote => vote.user_id === myId),
    isMine: row.user_id === myId
  })).sort((a, b) => b.voteCount - a.voteCount || new Date(a.createdAt) - new Date(b.createdAt));
}

// 의견 피드 렌더 (참가자 퀴즈 화면 / 대기 화면 / 관리자 패널 공용)
// 의견 내용과 닉네임은 사용자 입력이므로 XSS 방지를 위해 반드시 textContent로만 삽입합니다.
function renderOpinionFeed(container, question, opinions, { canVote, adminMode = false }) {
  container.innerHTML = "";

  if (opinions.length === 0) {
    const empty = document.createElement("p");
    empty.className = "opinion-empty";
    empty.textContent = "아직 제출된 의견이 없습니다.";
    container.appendChild(empty);
    return;
  }

  const isClosed = !!question.opinion_closed_at;
  let rank = 0;
  opinions.forEach((opinion, idx) => {
    // 추천수가 같으면 같은 순위로 표시
    if (idx === 0 || opinion.voteCount !== opinions[idx - 1].voteCount) {
      rank = idx + 1;
    }

    const item = document.createElement("div");
    item.className = "opinion-item";
    if (opinion.isMine) item.classList.add("is-mine");

    const rankEl = document.createElement("span");
    rankEl.className = "opinion-rank";
    rankEl.textContent = rank;

    const body = document.createElement("div");
    body.className = "opinion-body";

    const contentEl = document.createElement("p");
    contentEl.className = "opinion-content";
    contentEl.textContent = opinion.content;

    let authorLabel = opinion.authorName;
    if (opinion.isMine) {
      authorLabel = adminMode ? `${opinion.authorName} (나)` : "나";
    } else if (question.is_anonymous && !adminMode) {
      authorLabel = "익명";
    }
    const metaEl = document.createElement("span");
    metaEl.className = "opinion-meta";
    metaEl.textContent = isClosed && opinion.pointsAwarded > 0
      ? `${authorLabel} · +${opinion.pointsAwarded}점`
      : authorLabel;

    body.appendChild(contentEl);
    body.appendChild(metaEl);

    const voteBtn = document.createElement("button");
    voteBtn.type = "button";
    voteBtn.className = "opinion-vote-btn";
    if (opinion.votedByMe) voteBtn.classList.add("voted");
    voteBtn.textContent = `👍 ${opinion.votedByMe ? "추천함" : "추천"} ${opinion.voteCount}`;
    voteBtn.disabled = !canVote || isClosed || opinion.isMine;
    if (opinion.isMine && canVote) voteBtn.title = "내 의견에는 추천할 수 없습니다.";
    voteBtn.addEventListener("click", () => toggleOpinionVote(question, opinion, voteBtn));

    item.appendChild(rankEl);
    item.appendChild(body);
    item.appendChild(voteBtn);

    if (adminMode || (opinion.isMine && !isClosed)) {
      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "opinion-delete-btn";
      deleteBtn.textContent = "삭제";
      deleteBtn.addEventListener("click", () => deleteOpinion(opinion));
      item.appendChild(deleteBtn);
    }

    container.appendChild(item);
  });
}

// 추천 / 추천 취소 토글
async function toggleOpinionVote(question, opinion, voteBtn) {
  if (question.opinion_closed_at || opinion.isMine) return;
  voteBtn.disabled = true;

  try {
    const myId = state.session.user.id;
    const { error } = opinion.votedByMe
      ? await supabaseClient.from('opinion_votes').delete().eq('opinion_id', opinion.id).eq('user_id', myId)
      : await supabaseClient.from('opinion_votes').insert([{ opinion_id: opinion.id, user_id: myId }]);
    if (error) throw error;
  } catch (err) {
    console.error("추천 처리 실패:", err);
    alert("추천 처리에 실패했습니다. 이미 추천이 마감되었을 수 있습니다.");
  }
  await refreshOpinionViews(false);
}

async function deleteOpinion(opinion) {
  if (!confirm("이 의견을 삭제하시겠습니까? 받은 추천도 함께 삭제됩니다.")) return;

  try {
    const { error } = await supabaseClient.from('opinions').delete().eq('id', opinion.id);
    if (error) throw error;
  } catch (err) {
    console.error("의견 삭제 실패:", err);
    alert("의견 삭제에 실패했습니다: " + err.message);
  }
  await refreshOpinionViews(true);
}

// 의견/추천/문제(마감 상태) 변경을 실시간 구독합니다. (로그인 시 1회)
// opinion_votes의 DELETE 이벤트는 필터를 걸 수 없어 테이블 전체를 구독하고, 변경이 오면 화면에 보이는 피드만 다시 조회합니다.
function subscribeToOpinionChanges() {
  if (!supabaseClient || state.opinionChannel) return;

  state.opinionChannel = supabaseClient
    .channel('opinion_changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'opinions' },
      () => scheduleOpinionRefresh(true))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'opinion_votes' },
      () => scheduleOpinionRefresh(false))
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'questions' },
      (payload) => {
        // 참가자가 보고 있는 의견수렴 문항이 마감/해제되면 캐시된 문제 객체도 갱신해 추천 버튼 상태를 맞춥니다.
        if (isOpinionQuestion(state.currentQuestion) && payload.new && payload.new.id === state.currentQuestion.id) {
          state.currentQuestion = { ...state.currentQuestion, ...payload.new };
        }
        scheduleOpinionRefresh(false);
      })
    .subscribe();
}

// 추천이 몰릴 때 매 이벤트마다 재조회하지 않도록 300ms 디바운스합니다.
let opinionRefreshTimer = null;
let opinionRefreshNeedsList = false;
function scheduleOpinionRefresh(includeList) {
  opinionRefreshNeedsList = opinionRefreshNeedsList || includeList;
  clearTimeout(opinionRefreshTimer);
  opinionRefreshTimer = setTimeout(() => {
    const needsList = opinionRefreshNeedsList;
    opinionRefreshNeedsList = false;
    refreshOpinionViews(needsList);
  }, 300);
}

// 현재 화면에 보이는 의견 피드만 다시 조회/렌더합니다.
// includeList: 관리자 문제 목록의 "의견 N개" 표시도 갱신할지 여부 (의견 추가/삭제 시에만)
async function refreshOpinionViews(includeList) {
  if (!supabaseClient || !state.session) return;

  if (state.isAdmin) {
    if (includeList) await loadQuestionList();
    await renderAdminOpinionFeed();
    return;
  }

  if (elements.quizScreen.classList.contains("active") && isOpinionQuestion(state.currentQuestion)) {
    await renderParticipantOpinionFeed();
  }
  if (elements.welcomeScreen.classList.contains("active")) {
    if (state.reviewOpinionQuestionId) await loadQuizReview();
    await loadOpinionBoard();
  }
}

// 9.12b 참가자 대기 화면: 비활성화됐지만 아직 추천이 마감되지 않은 의견수렴 문항들 (추천만 가능)
// "최근 문제 리뷰"에 이미 표시 중인 문항은 중복되지 않도록 제외합니다.
let isLoadingOpinionBoard = false;
async function loadOpinionBoard() {
  if (!supabaseClient || state.isAdmin || isLoadingOpinionBoard) return;
  isLoadingOpinionBoard = true;

  try {
    const { data, error } = await supabaseClient
      .from('questions')
      .select('*')
      .eq('question_type', 'OPINION')
      .not('opinion_opened_at', 'is', null)
      .is('opinion_closed_at', null)
      .eq('opinion_hidden', false)
      .order('opinion_opened_at', { ascending: false });

    if (error) throw error;

    const questions = (data || []).filter(q => q.id !== state.reviewOpinionQuestionId);
    const feeds = await Promise.all(questions.map(q => fetchOpinions(q.id)));

    elements.opinionBoardList.innerHTML = "";
    elements.opinionBoardBox.style.display = questions.length > 0 ? "block" : "none";

    questions.forEach((question, idx) => {
      const item = document.createElement("div");
      item.className = "opinion-board-item";

      const title = document.createElement("p");
      title.className = "quiz-review-question-text";
      title.textContent = question.is_anonymous ? `${question.question_text} (익명)` : question.question_text;

      const feed = document.createElement("div");
      feed.className = "opinion-feed";
      renderOpinionFeed(feed, question, feeds[idx] || [], { canVote: true });

      item.appendChild(title);
      item.appendChild(feed);
      elements.opinionBoardList.appendChild(item);
    });
  } catch (err) {
    console.error("의견수렴 보드 조회 실패:", err.message);
  } finally {
    isLoadingOpinionBoard = false;
  }
}

// 퀴즈 화면을 선택형(보기/제출/분포) 또는 의견수렴(입력/피드) 모드로 전환
function setQuizMode(mode) {
  const isOpinion = mode === "opinion";
  elements.optionsContainer.style.display = isOpinion ? "none" : "";
  elements.submitAnswerBox.style.display = isOpinion ? "none" : "";
  elements.answerDistribution.style.display = isOpinion ? "none" : "";
  elements.opinionContainer.style.display = isOpinion ? "block" : "none";
}

// 10b. 의견수렴 문항 진입 (참가자) — 타이머 동안 의견을 여러 개 제출하고, 피드에서 추천할 수 있습니다.
function loadOpinionQuestion(questionRow) {
  state.currentQuestion = questionRow;
  state.isAnswered = false;
  state.selectedOptionIndices = [];
  state.currentTimeLimit = questionRow.time_limit || TIMER_LIMIT;

  // 직전 퀴즈 문제의 답안 분포 구독이 남아 있으면 정리합니다.
  if (state.answerDistributionChannel) {
    supabaseClient.removeChannel(state.answerDistributionChannel);
    state.answerDistributionChannel = null;
  }

  const initialTimeLeft = getInitialTimeLeft();
  state.timeLeft = initialTimeLeft;

  setQuizMode("opinion");
  elements.questionPointsBadge.textContent = questionRow.points;
  elements.currentScoreText.textContent = state.score;
  elements.questionText.textContent = questionRow.question_text;
  elements.opinionInput.value = "";
  elements.opinionInput.disabled = false;
  elements.opinionSubmitBtn.disabled = false;
  updateOpinionCharCount();
  elements.quizFooterMessage.textContent = questionRow.is_anonymous
    ? "익명으로 진행되는 의견수렴입니다. 다른 참가자에게 작성자가 표시되지 않습니다."
    : "";
  elements.opinionFeed.innerHTML = "";

  resetTimerProgressCircle();
  renderParticipantOpinionFeed();

  if (initialTimeLeft <= 0) {
    // 재접속 시점에 이미 제한시간이 지난 경우: 제출만 막고 추천은 계속 가능
    handleTimeout();
    return;
  }

  startTimer();
}

async function renderParticipantOpinionFeed() {
  const question = state.currentQuestion;
  if (!isOpinionQuestion(question)) return;

  const opinions = await fetchOpinions(question.id);
  if (!opinions || state.currentQuestion !== question) return;
  renderOpinionFeed(elements.opinionFeed, question, opinions, { canVote: true });
}

function updateOpinionCharCount() {
  elements.opinionCharCount.textContent = `${elements.opinionInput.value.length} / 300`;
}

async function handleSubmitOpinion() {
  const question = state.currentQuestion;
  if (!isOpinionQuestion(question) || state.isAnswered) return;

  const content = elements.opinionInput.value.trim();
  if (!content) {
    alert("의견을 입력해주세요.");
    return;
  }
  if (content.length > 300) {
    alert("의견은 300자 이하로 입력해주세요.");
    return;
  }

  elements.opinionSubmitBtn.disabled = true;
  elements.opinionSubmitBtn.textContent = "제출 중...";

  try {
    const { error } = await supabaseClient
      .from('opinions')
      .insert([{ question_id: question.id, user_id: state.session.user.id, content }]);
    if (error) throw error;

    elements.opinionInput.value = "";
    updateOpinionCharCount();
    await renderParticipantOpinionFeed();
  } catch (err) {
    console.error("의견 제출 실패:", err);
    alert("의견 제출에 실패했습니다. 제출 시간이 끝났을 수 있습니다.");
  } finally {
    elements.opinionSubmitBtn.disabled = state.isAnswered;
    elements.opinionSubmitBtn.textContent = "의견 제출";
  }
}

// 의견수렴 제한시간 종료: 제출만 마감하고, 추천은 관리자가 마감할 때까지 계속 가능합니다.
function closeOpinionSubmission() {
  if (state.isAnswered) return;
  state.isAnswered = true;
  clearInterval(state.timerInterval);
  stopBgm();

  elements.timerText.textContent = "⏱️";
  elements.opinionInput.disabled = true;
  elements.opinionSubmitBtn.disabled = true;
  elements.quizFooterMessage.textContent = "의견 제출이 마감되었습니다. 추천은 관리자가 마감할 때까지 계속할 수 있습니다.";
}

// 9.8 참가자 응답을 quiz_answers 테이블에 기록
async function submitAnswer(questionId, selectedOptions, isCorrect, scoreRatio) {
  if (!supabaseClient || !state.session) return;

  try {
    const { error } = await supabaseClient
      .from('quiz_answers')
      .insert([
        {
          user_id: state.session.user.id,
          question_id: questionId,
          selected_options: selectedOptions,
          is_correct: isCorrect,
          score_ratio: scoreRatio,
          activated_at: state.activeQuestionActivatedAt
        }
      ]);
    if (error) throw error;
  } catch (err) {
    console.error("응답 기록 실패:", err.message);
  }
}

// 9.9 실시간 답안 분포 구독 (참가자/관리자 화면 공용)
// subscribeToQuizState와 동일한 이유로, await 이전에 동기적으로 잠금을 걸어 중복 구독을 방지합니다.
let isSubscribingToAnswerDistribution = false;
async function subscribeToAnswerDistribution(questionId) {
  if (isSubscribingToAnswerDistribution) return;
  isSubscribingToAnswerDistribution = true;

  try {
    if (state.answerDistributionChannel) {
      supabaseClient.removeChannel(state.answerDistributionChannel);
      state.answerDistributionChannel = null;
    }

    state.answerTally = {};

    const { data, error } = await supabaseClient
      .from('quiz_answers')
      .select('selected_options')
      .eq('question_id', questionId);

    if (!error && data) {
      data.forEach(row => {
        (row.selected_options || []).forEach(opt => {
          state.answerTally[opt] = (state.answerTally[opt] || 0) + 1;
        });
      });
    }

    renderAnswerDistribution();

    state.answerDistributionChannel = supabaseClient
      .channel(`answer_distribution_${questionId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'quiz_answers', filter: `question_id=eq.${questionId}`
      }, (payload) => {
        (payload.new.selected_options || []).forEach(opt => {
          state.answerTally[opt] = (state.answerTally[opt] || 0) + 1;
        });
        renderAnswerDistribution();
      })
      .subscribe();
  } finally {
    isSubscribingToAnswerDistribution = false;
  }
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

// 9.12 참가자 대기 화면: 마지막으로 활성화됐던 문제 + 선택지별 응답 수를 리뷰로 표시
// 오늘 활성화된 적이 없으면 "최근 진행된 퀴즈가 없습니다"를 표시합니다.
let isLoadingQuizReview = false;
async function loadQuizReview() {
  if (!supabaseClient || isLoadingQuizReview) return;
  isLoadingQuizReview = true;

  try {
    if (state.reviewDistributionChannel) {
      supabaseClient.removeChannel(state.reviewDistributionChannel);
      state.reviewDistributionChannel = null;
    }
    state.reviewOpinionQuestionId = null;
    elements.quizReviewOptions.classList.remove("opinion-feed");

    const activatedToday = state.lastActivatedAt &&
      new Date(state.lastActivatedAt).toDateString() === new Date().toDateString();

    if (!state.lastQuestionId || !activatedToday) {
      elements.quizReviewEmpty.style.display = "block";
      elements.quizReviewContent.style.display = "none";
      return;
    }

    const { data: questionRow, error } = await supabaseClient
      .from('questions')
      .select('*')
      .eq('id', state.lastQuestionId)
      .single();

    // "마지막 의견 수렴 공개 초기화"로 숨겨진 의견수렴 문항은 리뷰에서도 노출하지 않습니다.
    if (error || !questionRow || (isOpinionQuestion(questionRow) && questionRow.opinion_hidden)) {
      elements.quizReviewEmpty.style.display = "block";
      elements.quizReviewContent.style.display = "none";
      return;
    }

    elements.quizReviewEmpty.style.display = "none";
    elements.quizReviewContent.style.display = "block";
    elements.quizReviewQuestionText.textContent = questionRow.question_text;

    // 의견수렴 문항은 선택지 분포 대신 추천순 의견 피드를 보여줍니다. (마감 전이면 추천 가능, 마감 후엔 획득 점수 표시)
    if (isOpinionQuestion(questionRow)) {
      state.reviewOpinionQuestionId = questionRow.id;
      elements.quizReviewOptions.classList.add("opinion-feed");
      const opinions = await fetchOpinions(questionRow.id);
      renderOpinionFeed(elements.quizReviewOptions, questionRow, opinions || [], { canVote: true });
      return;
    }

    state.reviewTally = {};
    const { data: answerRows, error: countError } = await supabaseClient
      .from('quiz_answers')
      .select('selected_options')
      .eq('question_id', state.lastQuestionId);

    if (!countError && answerRows) {
      answerRows.forEach(row => {
        (row.selected_options || []).forEach(opt => {
          state.reviewTally[opt] = (state.reviewTally[opt] || 0) + 1;
        });
      });
    }

    renderQuizReviewOptions(questionRow);

    const reviewQuestionId = state.lastQuestionId;
    state.reviewDistributionChannel = supabaseClient
      .channel(`quiz_review_${reviewQuestionId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'quiz_answers', filter: `question_id=eq.${reviewQuestionId}`
      }, (payload) => {
        (payload.new.selected_options || []).forEach(opt => {
          state.reviewTally[opt] = (state.reviewTally[opt] || 0) + 1;
        });
        renderQuizReviewOptions(questionRow);
      })
      .subscribe();
  } catch (err) {
    console.error("퀴즈 리뷰 조회 실패:", err.message);
  } finally {
    isLoadingQuizReview = false;
  }
}

// 리뷰 카드의 선택지별 응답 수/비율 렌더 (정답은 별도 표시)
function renderQuizReviewOptions(questionRow) {
  const totalCount = Object.values(state.reviewTally).reduce((a, b) => a + b, 0);

  elements.quizReviewOptions.innerHTML = questionRow.options.map((optionText, idx) => {
    const count = state.reviewTally[idx] || 0;
    const percent = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;
    const isCorrect = questionRow.correct_options.includes(idx);
    return `
      <div class="distribution-row${isCorrect ? ' distribution-row-correct' : ''}">
        <span class="distribution-label">${String.fromCharCode(65 + idx)}. ${optionText}${isCorrect ? ' ✓ 정답' : ''}</span>
        <div class="distribution-bar-track">
          <div class="distribution-bar-fill" style="width: ${percent}%;"></div>
        </div>
        <span class="distribution-count">${count}명</span>
      </div>
    `;
  }).join("");
}

// 9b. Timer Sound Synthesis (Web Audio API — 외부 오디오 파일 없이 톤을 직접 생성)
function getAudioContext() {
  if (!state.audioCtx) {
    state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (state.audioCtx.state === "suspended") {
    state.audioCtx.resume();
  }
  return state.audioCtx;
}

function playTone(frequency, duration, volume = 0.25) {
  if (state.isMuted) return;
  const ctx = getAudioContext();
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = frequency;
  gainNode.gain.setValueAtTime(volume, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
  oscillator.connect(gainNode).connect(ctx.destination);
  oscillator.start();
  oscillator.stop(ctx.currentTime + duration);
}

function playBeep() {
  playTone(880, 0.15, 0.25);
}

function playGong() {
  playTone(220, 1.4, 0.3);
  playTone(330, 1.4, 0.15); // 배음을 살짝 겹쳐 종소리 질감
}

// 9c. Background Music (BGM) — 문제 풀이 중에만 재생
const bgmAudio = new Audio("bgm.m4a");
bgmAudio.loop = true;
bgmAudio.volume = 0.3; // 비프/Gong 효과음보다 낮게, 배경음 성격 유지

// 배점 0점 문제는 긴장감 없이 풀도록 BGM을 재생하지 않습니다. (비프/공 효과음은 타이머 신호라 유지)
function shouldPlayBgm() {
  return !!state.currentQuestion && state.currentQuestion.points > 0;
}

function playBgm() {
  bgmAudio.currentTime = 0;
  bgmAudio.play().catch(() => {}); // 브라우저 자동재생 정책으로 거부돼도 조용히 무시
}

function stopBgm() {
  bgmAudio.pause();
  bgmAudio.currentTime = 0;
}

// 새로고침 직후처럼 사용자 제스처 없이 곧바로 문제 화면(활성 문제 재접속)에 진입하면,
// 브라우저의 자동재생 정책 때문에 AudioContext가 suspended 상태로 남고 bgmAudio.play()도
// 조용히 거부되어 BGM/비프/공 소리가 전혀 나지 않습니다. 페이지에서의 클릭/터치/키 입력을
// 감지해 오디오를 "잠금 해제"함으로써, 이후 사용자 제스처 없이 호출되는 자동 재생도 정상적으로
// 소리가 나도록 합니다. 첫 시도가 아직 이르거나(오디오 파일 로딩 전 등) 실패할 수 있으므로,
// 실제로 재생이 성공할 때까지 이후 입력마다 계속 재시도합니다.
let audioUnlocked = false;
function unlockAudioPlayback() {
  if (audioUnlocked) return;
  getAudioContext();
  bgmAudio.play().then(() => {
    audioUnlocked = true;
    // 지금 재생 중인 문제가 없다면(단순 잠금 해제 목적이었다면) 다시 정지시켜 무음 상태를 유지합니다.
    if (!(state.currentQuestion && !state.isAnswered && shouldPlayBgm())) {
      stopBgm();
    }
    ["click", "keydown", "touchstart"].forEach((eventName) => {
      document.removeEventListener(eventName, unlockAudioPlayback);
    });
  }).catch(() => {}); // 아직 허용되지 않았다면 다음 사용자 입력 때 다시 시도합니다.
}
["click", "keydown", "touchstart"].forEach((eventName) => {
  document.addEventListener(eventName, unlockAudioPlayback);
});

// 10. Quiz Render & Timer Engine
// 라이브 모드에서는 문제가 활성화된 시각 기준으로 남은 시간을 계산합니다. (state.currentTimeLimit이 먼저 설정되어 있어야 함)
function getInitialTimeLeft() {
  // 라이브 모드에서는 문제가 실제로 활성화된 시각(activated_at) 기준으로 남은 시간을 계산합니다.
  // 새로고침/재접속으로 이 화면에 다시 진입해도 타이머가 매번 처음부터 리셋되지 않도록 하기 위함입니다.
  let initialTimeLeft = state.currentTimeLimit;
  if (supabaseClient && state.session && state.activeQuestionActivatedAt) {
    // getServerNow()는 이 기기와 DB 서버 시계 사이의 오차(clockOffsetMs)를 보정한 시각이라,
    // 기기별 로컬 시계가 어긋나 있어도 남은 시간이 정확하게 계산됩니다.
    const elapsedSeconds = (getServerNow() - new Date(state.activeQuestionActivatedAt).getTime()) / 1000;
    // syncClockOffset()이 아직 끝나지 않은 극히 짧은 초기 구간 등 예외 상황에 대비해
    // 문제에 설정된 제한시간을 넘는 값이 표시되지 않도록 상한을 한 번 더 클램프합니다.
    initialTimeLeft = Math.min(state.currentTimeLimit, Math.max(0, Math.ceil(state.currentTimeLimit - elapsedSeconds)));
  }
  return initialTimeLeft;
}

function loadQuestion(questionRow) {
  state.currentQuestion = questionRow;
  state.isAnswered = false;
  state.selectedOptionIndices = [];
  state.currentTimeLimit = questionRow.time_limit || TIMER_LIMIT;

  const initialTimeLeft = getInitialTimeLeft();
  state.timeLeft = initialTimeLeft;

  setQuizMode("choice");

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

  elements.submitAnswerBtn.disabled = true;
  elements.submitAnswerBtn.textContent = "제출하기";
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
  if (shouldPlayBgm()) {
    playBgm();
  }

  state.timerInterval = setInterval(() => {
    state.timeLeft--;
    if (state.timeLeft > 0 && state.timeLeft <= 3) {
      playBeep();
    }
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
  const offset = CIRCUMFERENCE * (1 - state.timeLeft / state.currentTimeLimit);
  elements.timerProgress.style.strokeDashoffset = offset;

  // Change ring color dynamically depending on time left (남은 시간의 비율 기준)
  const ratio = state.timeLeft / state.currentTimeLimit;
  if (ratio > 0.45) {
    elements.timerProgress.style.stroke = "#34d399"; // Mint green
  } else if (ratio > 0.2) {
    elements.timerProgress.style.stroke = "#fb923c"; // Orange
  } else {
    elements.timerProgress.style.stroke = "#f87171"; // Coral red
  }
}

function resetTimerProgressCircle() {
  elements.timerProgress.style.strokeDashoffset = 0;
  elements.timerProgress.style.stroke = "#34d399";
}

// 11. 옵션 선택 (아직 확정 아님 — "제출하기" 버튼을 눌러야 정답 처리됩니다. 복수 선택 가능)
function handleSelectOption(selectedIdx, selectedBtn) {
  if (state.isAnswered) return;

  const alreadySelected = state.selectedOptionIndices.includes(selectedIdx);
  if (alreadySelected) {
    state.selectedOptionIndices = state.selectedOptionIndices.filter(idx => idx !== selectedIdx);
    selectedBtn.classList.remove("selected");
  } else {
    state.selectedOptionIndices.push(selectedIdx);
    selectedBtn.classList.add("selected");
  }

  elements.submitAnswerBtn.disabled = state.selectedOptionIndices.length === 0;
}

// 11b. 제출 버튼 클릭 → 선택된 답을 확정 채점
function handleSubmitAnswer() {
  if (state.isAnswered) return;
  if (state.selectedOptionIndices.length === 0) {
    alert("답을 선택한 후 제출해주세요.");
    return;
  }
  gradeAnswer(state.selectedOptionIndices);
}

// 12. Handle Timeout — 선택해둔 답이 있으면 그대로 자동 제출, 없으면 무응답 처리
function handleTimeout() {
  playGong();
  if (isOpinionQuestion(state.currentQuestion)) {
    closeOpinionSubmission();
    return;
  }
  gradeAnswer(state.selectedOptionIndices);
}

// 13. 채점 확정 (제출 버튼 클릭 또는 시간초과 시 공통으로 호출)
// selectedIndices: 사용자가 선택한 옵션 인덱스 배열 (무응답/시간초과 시 빈 배열)
function gradeAnswer(selectedIndices) {
  if (state.isAnswered) return;
  state.isAnswered = true;
  clearInterval(state.timerInterval);
  stopBgm();

  state.answers.push(selectedIndices);

  const currentQuestion = state.currentQuestion;
  const correctSet = new Set(currentQuestion.correct_options);
  const selectedSet = new Set(selectedIndices);

  // 복수 정답 채점: (맞춘 정답 수 - 잘못 고른 오답 수) / 전체 정답 수, 0~1 사이로 클램프
  // (단일 정답 문제에서는 자연스럽게 0 또는 1이 되어 기존 all-or-nothing 채점과 동일하게 동작합니다.)
  const correctHitCount = [...selectedSet].filter(idx => correctSet.has(idx)).length;
  const wrongHitCount = [...selectedSet].filter(idx => !correctSet.has(idx)).length;
  const scoreRatio = Math.max(0, Math.min(1, (correctHitCount - wrongHitCount) / correctSet.size));
  const isCorrect = scoreRatio > 0;

  const optionButtons = elements.optionsContainer.querySelectorAll(".option-btn");
  const isLiveMode = !!(supabaseClient && state.session);

  const checkIconHtml = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
    </svg>
  `;
  const wrongIconHtml = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
    </svg>
  `;

  if (selectedIndices.length === 0) {
    // 아무것도 선택하지 않은 채 시간초과된 경우
    elements.timerText.textContent = "⏱️";
  } else {
    selectedIndices.forEach(idx => {
      const btn = optionButtons[idx];
      if (correctSet.has(idx)) {
        btn.classList.add("correct");
        btn.querySelector(".option-status-icon").innerHTML = checkIconHtml;
      } else {
        btn.classList.add("wrong");
        btn.querySelector(".option-status-icon").innerHTML = wrongIconHtml;
      }
    });
  }

  // 선택하지 않고 놓친 정답도 표시
  currentQuestion.correct_options.forEach(idx => {
    if (selectedSet.has(idx)) return;
    const correctBtn = optionButtons[idx];
    correctBtn.classList.add("correct");
    correctBtn.querySelector(".option-status-icon").innerHTML = checkIconHtml;
  });

  if (!isLiveMode && scoreRatio > 0) {
    // 오프라인 모드 전용: 로컬 점수 산정 (100점 기본 + 남은 시간 보너스) * 정답 비율
    const baseScore = 100;
    const bonusScore = state.timeLeft * 10;
    state.score += Math.round((baseScore + bonusScore) * scoreRatio);
    elements.currentScoreText.textContent = state.score;
  }

  // Disable all options + submit button
  optionButtons.forEach(btn => btn.disabled = true);
  elements.submitAnswerBtn.disabled = true;

  finishAnswering(currentQuestion.id, selectedIndices, isCorrect, scoreRatio);
}

// 14. 응답 완료 후 흐름 분기 (라이브 모드: 대기 화면 복귀 / 오프라인 모드: 다음 문제로 자동 진행)
function finishAnswering(questionId, selectedOptions, isCorrect, scoreRatio) {
  if (supabaseClient && state.session) {
    elements.quizFooterMessage.textContent = "응답이 제출되었습니다. 관리자가 다음 문제를 활성화할 때까지 기다려주세요...";
    submitAnswer(questionId, selectedOptions, isCorrect, scoreRatio);
    setTimeout(async () => {
      elements.waitingMessage.textContent = "응답을 제출했습니다. 관리자가 다음 문제를 활성화하면 자동으로 화면이 전환됩니다.";
      switchScreen(elements.welcomeScreen);
      await loadLeaderboard();
      await loadQuizReview();
      await loadOpinionBoard();
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

// 15. Show Results Screen & Trigger Database Upload
async function showResults() {
  switchScreen(elements.resultScreen);
  
  // Math Correct ratio
  let correctCount = 0;
  state.answers.forEach((ans, idx) => {
    const correctSet = new Set(OFFLINE_DEMO_QUESTIONS[idx].correct_options);
    const selectedSet = new Set(ans);
    const isCorrect = correctSet.size === selectedSet.size &&
      [...correctSet].every(i => selectedSet.has(i));
    if (isCorrect) {
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
    const userAnswerIndices = state.answers[idx] || [];
    const correctSet = new Set(q.correct_options);
    const selectedSet = new Set(userAnswerIndices);
    const isCorrect = correctSet.size === selectedSet.size &&
      [...correctSet].every(i => selectedSet.has(i));

    // Status text
    let statusText = "오답";
    if (isCorrect) statusText = "정답";
    else if (userAnswerIndices.length === 0) statusText = "시간 초과";

    // User response text
    const userSelectedText = userAnswerIndices.length === 0
      ? "선택하지 않음"
      : userAnswerIndices.map(i => q.options[i]).join(", ");
    const correctText = q.correct_options.map(i => q.options[i]).join(", ");

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

// 16. Restart Logic (Returns to Lobby startContainer while keeping login session)
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
