const { app } = require('@azure/functions')
const { loginHandler, logoutHandler, meHandler, registerHandler } = require('./auth')
const { listUsersHandler } = require('./admin')
const {
  listStudentsHandler,
  createStudentHandler,
  enterStudentHandler,
  exitStudentHandler,
  listStudentResourceBooksHandler,
  updateStudentResourceBooksHandler,
} = require('./students')
const {
  listSubjectsHandler,
  listSubjectsForPanelHandler,
  listPublishersHandler,
  createPublisherHandler,
  listResourceBooksHandler,
  listResourceBooksForPanelHandler,
  createResourceBookHandler,
  updateResourceBookHandler,
  listResourceBookTopicsHandler,
  createResourceBookTopicHandler,
  updateResourceBookTopicHandler,
  listResourceBookTopicsForPanelHandler,
  listResourceBookTopicTestsHandler,
  createResourceBookTopicTestHandler,
  updateResourceBookTopicTestHandler,
  deleteResourceBookTopicTestHandler,
  listQuestionsForTestHandler,
  createQuestionHandler,
  listTestAnswerKeyHandler,
  setTestAnswerKeyHandler,
} = require('./catalog')
const { extractQuestionsFromImageHandler } = require('./questionExtraction')
const { listHomeworksHandler, createHomeworkHandler, updateHomeworkHandler, deleteHomeworkHandler } = require('./homework')
const {
  listTasksHandler,
  getTaskHandler,
  createTaskHandler,
  updateTaskHandler,
  deleteTaskHandler,
  getTaskAnswerSheetHandler,
  saveTaskAnswersHandler,
  getWeeklyPlanStatusHandler,
  setWeeklyPlanStatusHandler,
} = require('./tasks')
const {
  listMessagesHandler,
  sendMessageHandler,
  markMessagesReadHandler,
  listCoachNotesHandler,
  addCoachNoteHandler,
  listStudentRequestsHandler,
  updateStudentRequestHandler,
} = require('./messaging')
const {
  getCheckInHandler,
  saveCheckInHandler,
  listWrongQuestionsHandler,
  addWrongQuestionHandler,
  updateWrongQuestionHandler,
  listStudySessionsHandler,
  addStudySessionHandler,
  getProgressOverviewHandler,
  getSmallGoalHandler,
  setSmallGoalHandler,
} = require('./progress')
const {
  listParentMessagesHandler,
  createParentMessageHandler,
  updateParentMessageHandler,
  addMotivationFeedbackHandler,
  getDailySelectionHandler,
  setDailySelectionHandler,
  incrementSwitchCountHandler,
} = require('./motivation')
const { revenuecatWebhookHandler } = require('./entitlements')
const {
  listMotivationMessagesHandler,
  createMotivationMessageHandler,
  updateMotivationMessageHandler,
  listMotivationMessagePoolForPanelHandler,
  listGreetingRulesHandler,
  createGreetingRuleHandler,
  updateGreetingRuleHandler,
  deleteGreetingRuleHandler,
  listGreetingRulesForPanelHandler,
} = require('./content')

app.http('auth-register', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'auth/register',
  handler: registerHandler,
})

app.http('auth-login', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'auth/login',
  handler: loginHandler,
})

app.http('auth-me', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'auth/me',
  handler: meHandler,
})

app.http('auth-logout', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'auth/logout',
  handler: logoutHandler,
})

app.http('billing-revenuecat-webhook', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'billing/revenuecat-webhook',
  handler: revenuecatWebhookHandler,
})

app.http('panel-admin-users', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel-admin/users',
  handler: listUsersHandler,
})

app.http('parent-students-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'parent/students',
  handler: listStudentsHandler,
})

app.http('parent-students-create', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'parent/students',
  handler: createStudentHandler,
})

app.http('parent-students-enter', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'parent/students/{studentId}/enter',
  handler: enterStudentHandler,
})

app.http('parent-student-resource-books-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'parent/students/{studentId}/resource-books',
  handler: listStudentResourceBooksHandler,
})

app.http('parent-student-resource-books-update', {
  authLevel: 'anonymous',
  methods: ['PUT'],
  route: 'parent/students/{studentId}/resource-books',
  handler: updateStudentResourceBooksHandler,
})

app.http('parent-return', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'parent/return',
  handler: exitStudentHandler,
})

app.http('panel-admin-subjects', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel-admin/subjects',
  handler: listSubjectsHandler,
})

app.http('panel-subjects', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel/subjects',
  handler: listSubjectsForPanelHandler,
})

app.http('panel-admin-publishers-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel-admin/publishers',
  handler: listPublishersHandler,
})

app.http('panel-admin-publishers-create', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'panel-admin/publishers',
  handler: createPublisherHandler,
})

app.http('panel-admin-motivation-messages-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel-admin/motivation-messages',
  handler: listMotivationMessagesHandler,
})

app.http('panel-admin-motivation-messages-create', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'panel-admin/motivation-messages',
  handler: createMotivationMessageHandler,
})

app.http('panel-admin-motivation-messages-update', {
  authLevel: 'anonymous',
  methods: ['PATCH'],
  route: 'panel-admin/motivation-messages/{messageId}',
  handler: updateMotivationMessageHandler,
})

app.http('panel-motivation-message-pool', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel/motivation-message-pool',
  handler: listMotivationMessagePoolForPanelHandler,
})

app.http('panel-admin-greeting-rules-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel-admin/greeting-rules',
  handler: listGreetingRulesHandler,
})

app.http('panel-admin-greeting-rules-create', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'panel-admin/greeting-rules',
  handler: createGreetingRuleHandler,
})

app.http('panel-admin-greeting-rules-update', {
  authLevel: 'anonymous',
  methods: ['PATCH'],
  route: 'panel-admin/greeting-rules/{ruleId}',
  handler: updateGreetingRuleHandler,
})

app.http('panel-admin-greeting-rules-delete', {
  authLevel: 'anonymous',
  methods: ['DELETE'],
  route: 'panel-admin/greeting-rules/{ruleId}',
  handler: deleteGreetingRuleHandler,
})

app.http('panel-greeting-rules', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel/greeting-rules',
  handler: listGreetingRulesForPanelHandler,
})

app.http('panel-admin-resource-books-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel-admin/resource-books',
  handler: listResourceBooksHandler,
})

app.http('panel-admin-resource-books-create', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'panel-admin/resource-books',
  handler: createResourceBookHandler,
})

app.http('panel-admin-resource-books-update', {
  authLevel: 'anonymous',
  methods: ['PATCH'],
  route: 'panel-admin/resource-books/{resourceBookId}',
  handler: updateResourceBookHandler,
})

app.http('panel-resource-books', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel/resource-books',
  handler: listResourceBooksForPanelHandler,
})

app.http('panel-admin-resource-book-topics-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel-admin/resource-book-topics',
  handler: listResourceBookTopicsHandler,
})

app.http('panel-admin-resource-book-topics-create', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'panel-admin/resource-book-topics',
  handler: createResourceBookTopicHandler,
})

app.http('panel-admin-resource-book-topics-update', {
  authLevel: 'anonymous',
  methods: ['PATCH'],
  route: 'panel-admin/resource-book-topics/{topicId}',
  handler: updateResourceBookTopicHandler,
})

app.http('panel-resource-book-topics', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel/resource-book-topics',
  handler: listResourceBookTopicsForPanelHandler,
})

app.http('panel-admin-resource-book-topic-tests-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel-admin/resource-book-topic-tests',
  handler: listResourceBookTopicTestsHandler,
})

app.http('panel-admin-resource-book-topic-tests-create', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'panel-admin/resource-book-topic-tests',
  handler: createResourceBookTopicTestHandler,
})

app.http('panel-admin-resource-book-topic-tests-update', {
  authLevel: 'anonymous',
  methods: ['PATCH'],
  route: 'panel-admin/resource-book-topic-tests/{testId}',
  handler: updateResourceBookTopicTestHandler,
})

app.http('panel-admin-resource-book-topic-tests-delete', {
  authLevel: 'anonymous',
  methods: ['DELETE'],
  route: 'panel-admin/resource-book-topic-tests/{testId}',
  handler: deleteResourceBookTopicTestHandler,
})

app.http('panel-admin-resource-book-topic-tests-questions-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel-admin/resource-book-topic-tests/{testId}/questions',
  handler: listQuestionsForTestHandler,
})

app.http('panel-admin-resource-book-topic-tests-questions-create', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'panel-admin/resource-book-topic-tests/{testId}/questions',
  handler: createQuestionHandler,
})

app.http('panel-admin-resource-book-topic-tests-questions-extract', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'panel-admin/resource-book-topic-tests/{testId}/questions/extract',
  handler: extractQuestionsFromImageHandler,
})

app.http('panel-admin-resource-book-topic-tests-answer-key-get', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel-admin/resource-book-topic-tests/{testId}/answer-key',
  handler: listTestAnswerKeyHandler,
})

app.http('panel-admin-resource-book-topic-tests-answer-key-set', {
  authLevel: 'anonymous',
  methods: ['PUT'],
  route: 'panel-admin/resource-book-topic-tests/{testId}/answer-key',
  handler: setTestAnswerKeyHandler,
})

app.http('panel-homeworks-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel/homeworks',
  handler: listHomeworksHandler,
})

app.http('panel-homeworks-create', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'panel/homeworks',
  handler: createHomeworkHandler,
})

app.http('panel-homeworks-update', {
  authLevel: 'anonymous',
  methods: ['PATCH'],
  route: 'panel/homeworks/{homeworkId}',
  handler: updateHomeworkHandler,
})

app.http('panel-homeworks-delete', {
  authLevel: 'anonymous',
  methods: ['DELETE'],
  route: 'panel/homeworks/{homeworkId}',
  handler: deleteHomeworkHandler,
})

app.http('panel-tasks-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel/tasks',
  handler: listTasksHandler,
})

app.http('panel-tasks-create', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'panel/tasks',
  handler: createTaskHandler,
})

app.http('panel-tasks-get', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel/tasks/{taskId}',
  handler: getTaskHandler,
})

app.http('panel-tasks-update', {
  authLevel: 'anonymous',
  methods: ['PATCH'],
  route: 'panel/tasks/{taskId}',
  handler: updateTaskHandler,
})

app.http('panel-tasks-delete', {
  authLevel: 'anonymous',
  methods: ['DELETE'],
  route: 'panel/tasks/{taskId}',
  handler: deleteTaskHandler,
})

app.http('panel-tasks-answer-sheet-get', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel/tasks/{taskId}/answer-sheet',
  handler: getTaskAnswerSheetHandler,
})

app.http('panel-tasks-answers-save', {
  authLevel: 'anonymous',
  methods: ['PATCH'],
  route: 'panel/tasks/{taskId}/answers',
  handler: saveTaskAnswersHandler,
})

app.http('panel-weekly-plan-status-get', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel/weekly-plan-status',
  handler: getWeeklyPlanStatusHandler,
})

app.http('panel-weekly-plan-status-set', {
  authLevel: 'anonymous',
  methods: ['PUT'],
  route: 'panel/weekly-plan-status',
  handler: setWeeklyPlanStatusHandler,
})

app.http('panel-messages-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel/messages',
  handler: listMessagesHandler,
})

app.http('panel-messages-send', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'panel/messages',
  handler: sendMessageHandler,
})

app.http('panel-messages-mark-read', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'panel/messages/mark-read',
  handler: markMessagesReadHandler,
})

app.http('panel-coach-notes-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel/coach-notes',
  handler: listCoachNotesHandler,
})

app.http('panel-coach-notes-create', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'panel/coach-notes',
  handler: addCoachNoteHandler,
})

app.http('panel-student-requests-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel/student-requests',
  handler: listStudentRequestsHandler,
})

app.http('panel-student-requests-update', {
  authLevel: 'anonymous',
  methods: ['PATCH'],
  route: 'panel/student-requests/{requestId}',
  handler: updateStudentRequestHandler,
})

app.http('panel-check-in-get', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel/check-in',
  handler: getCheckInHandler,
})

app.http('panel-check-in-set', {
  authLevel: 'anonymous',
  methods: ['PUT'],
  route: 'panel/check-in',
  handler: saveCheckInHandler,
})

app.http('panel-wrong-questions-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel/wrong-questions',
  handler: listWrongQuestionsHandler,
})

app.http('panel-wrong-questions-create', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'panel/wrong-questions',
  handler: addWrongQuestionHandler,
})

app.http('panel-wrong-questions-update', {
  authLevel: 'anonymous',
  methods: ['PATCH'],
  route: 'panel/wrong-questions/{wrongQuestionId}',
  handler: updateWrongQuestionHandler,
})

app.http('panel-study-sessions-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel/study-sessions',
  handler: listStudySessionsHandler,
})

app.http('panel-study-sessions-create', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'panel/study-sessions',
  handler: addStudySessionHandler,
})

app.http('panel-progress-overview', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel/progress-overview',
  handler: getProgressOverviewHandler,
})

app.http('panel-parent-messages-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel/parent-messages',
  handler: listParentMessagesHandler,
})

app.http('panel-parent-messages-create', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'panel/parent-messages',
  handler: createParentMessageHandler,
})

app.http('panel-parent-messages-update', {
  authLevel: 'anonymous',
  methods: ['PATCH'],
  route: 'panel/parent-messages/{messageId}',
  handler: updateParentMessageHandler,
})

app.http('panel-motivation-feedback-create', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'panel/motivation-feedback',
  handler: addMotivationFeedbackHandler,
})

app.http('panel-motivation-daily-selection-get', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel/motivation-daily-selection',
  handler: getDailySelectionHandler,
})

app.http('panel-motivation-daily-selection-set', {
  authLevel: 'anonymous',
  methods: ['PUT'],
  route: 'panel/motivation-daily-selection',
  handler: setDailySelectionHandler,
})

app.http('panel-motivation-daily-selection-switch', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'panel/motivation-daily-selection/switch',
  handler: incrementSwitchCountHandler,
})

app.http('panel-small-goal-get', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel/small-goal',
  handler: getSmallGoalHandler,
})

app.http('panel-small-goal-set', {
  authLevel: 'anonymous',
  methods: ['PUT'],
  route: 'panel/small-goal',
  handler: setSmallGoalHandler,
})
