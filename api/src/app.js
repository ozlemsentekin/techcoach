const { app } = require('@azure/functions')
const { withPasswordGate } = require('./passwordGate')
function registerHttp(name, options) {
  app.http(name, { ...options, handler: withPasswordGate(options.route, options.handler) })
}
const { changePasswordHandler, loginHandler, logoutHandler, meHandler, sessionFromHandoffHandler, registerHandler, acceptConsentHandler, validateCouponHandler } = require('./auth')
const {
  listUsersHandler,
  updateUserHandler,
  setUserActiveHandler,
  deleteUserHandler,
  impersonateUserHandler,
  returnToAdminHandler,
  grantTeacherEntitlementHandler,
  unlockUserHandler,
} = require('./admin')
const {
  listStudentsHandler,
  createStudentHandler,
  enterStudentHandler,
  exitStudentHandler,
  listStudentResourceBooksHandler,
  updateStudentResourceBooksHandler,
  listStudentTeachersForParentHandler,
  listParentTeachersHandler,
  createStudentTeacherHandler,
  updateStudentTeacherHandler,
  listTeacherResourceBooksForParentHandler,
  updateTeacherResourceBooksForParentHandler,
  listStudentTeachersForPanelHandler,
  grantTeacherAccessHandler,
} = require('./students')
const { getStudentProfileHandler, updateStudentProfileHandler } = require('./studentProfile')
const {
  getSchoolClassScheduleHandler,
  saveSchoolClassScheduleHandler,
  getPanelSchoolScheduleHandler,
  listSchoolCalendarHandler,
  createSchoolCalendarEntryHandler,
  deleteSchoolCalendarEntryHandler,
} = require('./schoolSchedule')
const {
  listSchoolResourcesHandler,
  createSchoolResourceHandler,
  updateSchoolResourceHandler,
  deleteSchoolResourceHandler,
  getPanelSchoolResourcesHandler,
  getTeacherStudentSchoolResourcesHandler,
} = require('./schoolResources')
const {
  listTeacherStudentsHandler,
  getTeacherStudentHandler,
  getTeacherStudentProfileHandler,
  updateTeacherStudentProfileHandler,
  listTeacherStudentPrivateResourceBooksHandler,
  assignTeacherLibraryResourceBookHandler,
  unassignTeacherLibraryResourceBookHandler,
  updateTeacherStudentStatusHandler,
  updateTeacherStudentGradeHandler,
  deleteTeacherStudentHandler,
  listTeacherParentsHandler,
  getTeacherLessonPlanHandler,
  addTeacherRecurringLessonSlotHandler,
  updateTeacherRecurringLessonSlotHandler,
  deleteTeacherRecurringLessonSlotHandler,
  moveTeacherRecurringLessonOccurrenceHandler,
  deleteTeacherRecurringLessonOccurrenceHandler,
  addTeacherOneTimeLessonHandler,
  updateTeacherOneTimeLessonHandler,
  deleteTeacherOneTimeLessonHandler,
  listTeacherResourceBooksHandler,
  listTeacherResourceBookTopicsHandler,
  markTeacherResourceBookTopicTestCompletionHandler,
  unmarkTeacherResourceBookTopicTestCompletionHandler,
  submitTeacherManualOpticalAnswersHandler,
  saveTeacherManualWrongQuestionPhotoHandler,
  listTeacherStudentHomeworksHandler,
  createTeacherHomeworkHandler,
  assignTeacherHomeworkTaskHandler,
  updateTeacherHomeworkHandler,
  deleteTeacherHomeworkHandler,
  listTeacherStudentTasksHandler,
  updateTeacherStudentTaskHandler,
  deleteTeacherStudentTaskHandler,
  setTeacherTaskReviewHandler,
  getTeacherStudentSchoolScheduleHandler,
  getTeacherTaskAnswerSheetHandler,
  getTeacherStudentProgressOverviewHandler,
  listTeacherStudentWrongQuestionsHandler,
  getTeacherStudentWrongQuestionPhotoHandler,
  getTeacherStudentWrongQuestionTopicStatsHandler,
  updateTeacherStudentWrongQuestionHandler,
  grantParentAccessHandler,
  getTeacherEntitlementHandler,
  updateTeacherProfileHandler,
  createTeacherStudentHandler,
} = require('./teacher')
const { getTeacherClassAnalysisHandler } = require('./classAnalysis')
const { listProvincesHandler, listDistrictsHandler, listSchoolsHandler } = require('./geo')
const {
  listSubjectsHandler,
  createSubjectHandler,
  updateSubjectHandler,
  listSubjectsForPanelHandler,
  listSubjectsForRegistrationHandler,
  listPublishersHandler,
  listPublishersForPanelHandler,
  createPublisherHandler,
  listResourceBooksHandler,
  listResourceBooksMissingAnswerKeyHandler,
  listResourceBooksForPanelHandler,
  createResourceBookHandler,
  updateResourceBookHandler,
  reviewResourceBookHandler,
  listResourceBookTopicsHandler,
  createResourceBookTopicHandler,
  updateResourceBookTopicHandler,
  deleteResourceBookTopicHandler,
  listResourceBookTopicsForPanelHandler,
  markResourceBookTopicTestCompletionHandler,
  unmarkResourceBookTopicTestCompletionHandler,
  submitManualOpticalAnswersHandler,
  saveManualWrongQuestionPhotoHandler,
  listResourceBookTopicTestsHandler,
  createResourceBookTopicTestHandler,
  updateResourceBookTopicTestHandler,
  deleteResourceBookTopicTestHandler,
  listQuestionsForTestHandler,
  createQuestionHandler,
  listTestAnswerKeyHandler,
  setTestAnswerKeyHandler,
  listSchoolsForAdminHandler,
  createSchoolHandler,
  updateSchoolHandler,
  bulkImportSchoolsHandler,
} = require('./catalog')
const {
  listBooksHandler: listBookshelfBooksHandler,
  getBookHandler: getBookshelfBookHandler,
  createBookHandler: createBookshelfBookHandler,
  updateBookHandler: updateBookshelfBookHandler,
  deleteBookHandler: deleteBookshelfBookHandler,
  setBookStudentsHandler: setBookshelfBookStudentsHandler,
  createPublisherForPanelHandler: createBookshelfPublisherHandler,
  listAssignableStudentsHandler: listBookshelfStudentsHandler,
} = require('./bookshelf')
const { extractQuestionsFromImageHandler } = require('./questionExtraction')
const {
  listHomeworksHandler,
  createHomeworkHandler,
  updateHomeworkHandler,
  assignHomeworkTaskHandler,
  deleteHomeworkHandler,
} = require('./homework')
const {
  listTasksHandler,
  getTaskHandler,
  createTaskHandler,
  updateTaskHandler,
  deleteTaskHandler,
  getTaskAnswerSheetHandler,
  saveTaskAnswersHandler,
  saveWrongQuestionPhotoHandler,
  removeTaskTestHandler,
} = require('./tasks')
const { verifyMistakePhotoQuestionNumberHandler } = require('./mistakePhoto')
const { listTaskActivityLogsHandler } = require('./taskActivity')
const {
  listCoachNotesHandler,
  addCoachNoteHandler,
  listStudentRequestsHandler,
  updateStudentRequestHandler,
} = require('./messaging')
const {
  createPanelRequestHandler,
  listMyPanelRequestsHandler,
  getPanelRequestHandler,
  addPanelRequestMessageHandler,
  listAdminPanelRequestsHandler,
  updateAdminPanelRequestHandler,
} = require('./panelRequests')
const {
  getCheckInHandler,
  saveCheckInHandler,
  listWrongQuestionsHandler,
  getWrongQuestionPhotoHandler,
  addWrongQuestionHandler,
  updateWrongQuestionHandler,
  getWrongQuestionTopicStatsHandler,
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
  initiateIyzicoCheckoutHandler,
  initiateChildSeatCheckoutHandler,
  initiateTeacherSeatCheckoutHandler,
  initiateIyzicoCheckoutForNewParentHandler,
  iyzicoCheckoutCallbackHandler,
  iyzicoWebhookHandler,
} = require('./payments')
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

registerHttp('auth-register', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'auth/register',
  handler: registerHandler,
})

registerHttp('auth-subjects', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'auth/subjects',
  handler: listSubjectsForRegistrationHandler,
})

registerHttp('auth-validate-coupon', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'auth/validate-coupon',
  handler: validateCouponHandler,
})

registerHttp('auth-login', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'auth/login',
  handler: loginHandler,
})

registerHttp('auth-me', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'auth/me',
  handler: meHandler,
})

registerHttp('auth-session-from-handoff', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'auth/session-from-handoff',
  handler: sessionFromHandoffHandler,
})

registerHttp('auth-logout', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'auth/logout',
  handler: logoutHandler,
})

registerHttp('auth-consent', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'auth/consent',
  handler: acceptConsentHandler,
})

registerHttp('auth-change-password', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'auth/change-password',
  handler: changePasswordHandler,
})

registerHttp('billing-revenuecat-webhook', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'billing/revenuecat-webhook',
  handler: revenuecatWebhookHandler,
})

registerHttp('parent-payments-iyzico-checkout-initialize', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'parent/payments/iyzico/checkout-initialize',
  handler: initiateIyzicoCheckoutHandler,
})

registerHttp('parent-payments-iyzico-child-seat-checkout-initialize', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'parent/payments/iyzico/child-seat-checkout-initialize',
  handler: initiateChildSeatCheckoutHandler,
})

registerHttp('panel-teacher-payments-iyzico-seat-checkout-initialize', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'panel-teacher/payments/iyzico/seat-checkout-initialize',
  handler: initiateTeacherSeatCheckoutHandler,
})

registerHttp('payments-iyzico-parent-checkout-initialize', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'payments/iyzico/parent-checkout-initialize',
  handler: initiateIyzicoCheckoutForNewParentHandler,
})

registerHttp('payments-iyzico-callback', {
  authLevel: 'anonymous',
  methods: ['GET', 'POST'],
  route: 'payments/iyzico/callback',
  handler: iyzicoCheckoutCallbackHandler,
})

registerHttp('payments-iyzico-webhook', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'payments/iyzico/webhook',
  handler: iyzicoWebhookHandler,
})

registerHttp('panel-admin-users', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel-admin/users',
  handler: listUsersHandler,
})

registerHttp('panel-admin-users-update', {
  authLevel: 'anonymous',
  methods: ['PATCH'],
  route: 'panel-admin/users/{userId}',
  handler: updateUserHandler,
})

registerHttp('panel-admin-users-set-active', {
  authLevel: 'anonymous',
  methods: ['PATCH'],
  route: 'panel-admin/users/{userId}/active',
  handler: setUserActiveHandler,
})

registerHttp('panel-admin-users-delete', {
  authLevel: 'anonymous',
  methods: ['DELETE'],
  route: 'panel-admin/users/{userId}',
  handler: deleteUserHandler,
})

registerHttp('panel-admin-users-impersonate', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'panel-admin/users/{userId}/impersonate',
  handler: impersonateUserHandler,
})

registerHttp('panel-admin-users-unlock', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'panel-admin/users/{userId}/unlock',
  handler: unlockUserHandler,
})

registerHttp('panel-admin-return-to-admin', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'panel-admin/return-to-admin',
  handler: returnToAdminHandler,
})

registerHttp('panel-admin-teacher-entitlement-grant', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'panel-admin/users/{userId}/teacher-entitlement',
  handler: grantTeacherEntitlementHandler,
})

registerHttp('parent-students-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'parent/students',
  handler: listStudentsHandler,
})

registerHttp('parent-students-create', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'parent/students',
  handler: createStudentHandler,
})

registerHttp('parent-students-enter', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'parent/students/{studentId}/enter',
  handler: enterStudentHandler,
})

registerHttp('parent-student-resource-books-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'parent/students/{studentId}/resource-books',
  handler: listStudentResourceBooksHandler,
})

registerHttp('parent-student-resource-books-update', {
  authLevel: 'anonymous',
  methods: ['PUT'],
  route: 'parent/students/{studentId}/resource-books',
  handler: updateStudentResourceBooksHandler,
})

registerHttp('parent-student-teachers-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'parent/students/{studentId}/teachers',
  handler: listStudentTeachersForParentHandler,
})

registerHttp('parent-teachers-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'parent/teachers',
  handler: listParentTeachersHandler,
})

registerHttp('parent-student-teachers-create', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'parent/students/{studentId}/teachers',
  handler: createStudentTeacherHandler,
})

registerHttp('parent-student-teacher-update', {
  authLevel: 'anonymous',
  methods: ['PUT'],
  route: 'parent/students/{studentId}/teachers/{teacherId}',
  handler: updateStudentTeacherHandler,
})

registerHttp('parent-student-teacher-resource-books-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'parent/students/{studentId}/teachers/{teacherId}/resource-books',
  handler: listTeacherResourceBooksForParentHandler,
})

registerHttp('parent-student-teacher-resource-books-update', {
  authLevel: 'anonymous',
  methods: ['PUT'],
  route: 'parent/students/{studentId}/teachers/{teacherId}/resource-books',
  handler: updateTeacherResourceBooksForParentHandler,
})

registerHttp('parent-student-teacher-grant-access', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'parent/students/{studentId}/teachers/{teacherId}/grant-access',
  handler: grantTeacherAccessHandler,
})

registerHttp('panel-teacher-students-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel-teacher/students',
  handler: listTeacherStudentsHandler,
})

registerHttp('panel-teacher-student-get', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel-teacher/students/{studentTeacherId}',
  handler: getTeacherStudentHandler,
})

registerHttp('panel-teacher-student-profile-get', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel-teacher/students/{studentTeacherId}/profile',
  handler: getTeacherStudentProfileHandler,
})

registerHttp('panel-teacher-student-profile-update', {
  authLevel: 'anonymous',
  methods: ['PUT'],
  route: 'panel-teacher/students/{studentTeacherId}/profile',
  handler: updateTeacherStudentProfileHandler,
})

registerHttp('panel-teacher-student-private-resource-books-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel-teacher/students/{studentTeacherId}/private-resource-books',
  handler: listTeacherStudentPrivateResourceBooksHandler,
})

registerHttp('panel-teacher-student-library-resource-book-assign', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'panel-teacher/students/{studentTeacherId}/library/resource-books/{resourceBookId}',
  handler: assignTeacherLibraryResourceBookHandler,
})

registerHttp('panel-teacher-student-library-resource-book-unassign', {
  authLevel: 'anonymous',
  methods: ['DELETE'],
  route: 'panel-teacher/students/{studentTeacherId}/library/resource-books/{resourceBookId}',
  handler: unassignTeacherLibraryResourceBookHandler,
})

registerHttp('panel-teacher-student-status-update', {
  authLevel: 'anonymous',
  methods: ['PATCH'],
  route: 'panel-teacher/students/{studentTeacherId}/status',
  handler: updateTeacherStudentStatusHandler,
})

registerHttp('panel-teacher-student-grade-update', {
  authLevel: 'anonymous',
  methods: ['PATCH'],
  route: 'panel-teacher/students/{studentTeacherId}/grade',
  handler: updateTeacherStudentGradeHandler,
})

registerHttp('panel-teacher-student-delete', {
  authLevel: 'anonymous',
  methods: ['DELETE'],
  route: 'panel-teacher/students/{studentTeacherId}',
  handler: deleteTeacherStudentHandler,
})

registerHttp('panel-teacher-students-create', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'panel-teacher/students',
  handler: createTeacherStudentHandler,
})

registerHttp('panel-teacher-entitlement', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel-teacher/entitlement',
  handler: getTeacherEntitlementHandler,
})

registerHttp('panel-teacher-class-analysis', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel-teacher/class-analysis',
  handler: getTeacherClassAnalysisHandler,
})

registerHttp('panel-teacher-profile-update', {
  authLevel: 'anonymous',
  methods: ['PATCH'],
  route: 'panel-teacher/profile',
  handler: updateTeacherProfileHandler,
})

registerHttp('panel-teacher-parents-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel-teacher/parents',
  handler: listTeacherParentsHandler,
})

registerHttp('panel-teacher-parents-grant-access', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'panel-teacher/parents/{parentId}/grant-access',
  handler: grantParentAccessHandler,
})

registerHttp('panel-teacher-lesson-plan', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel-teacher/lesson-plan',
  handler: getTeacherLessonPlanHandler,
})

registerHttp('panel-teacher-lesson-plan-recurring-create', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'panel-teacher/students/{studentTeacherId}/lesson-plan/recurring',
  handler: addTeacherRecurringLessonSlotHandler,
})

registerHttp('panel-teacher-lesson-plan-recurring-update', {
  authLevel: 'anonymous',
  methods: ['PUT'],
  route: 'panel-teacher/students/{studentTeacherId}/lesson-plan/recurring',
  handler: updateTeacherRecurringLessonSlotHandler,
})

registerHttp('panel-teacher-lesson-plan-recurring-delete', {
  authLevel: 'anonymous',
  methods: ['DELETE'],
  route: 'panel-teacher/students/{studentTeacherId}/lesson-plan/recurring',
  handler: deleteTeacherRecurringLessonSlotHandler,
})

registerHttp('panel-teacher-lesson-plan-recurring-occurrence-update', {
  authLevel: 'anonymous',
  methods: ['PUT'],
  route: 'panel-teacher/students/{studentTeacherId}/lesson-plan/recurring/occurrence',
  handler: moveTeacherRecurringLessonOccurrenceHandler,
})

registerHttp('panel-teacher-lesson-plan-recurring-occurrence-delete', {
  authLevel: 'anonymous',
  methods: ['DELETE'],
  route: 'panel-teacher/students/{studentTeacherId}/lesson-plan/recurring/occurrence',
  handler: deleteTeacherRecurringLessonOccurrenceHandler,
})

registerHttp('panel-teacher-lesson-plan-one-time-create', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'panel-teacher/students/{studentTeacherId}/lesson-plan/one-time',
  handler: addTeacherOneTimeLessonHandler,
})

registerHttp('panel-teacher-lesson-plan-one-time-update', {
  authLevel: 'anonymous',
  methods: ['PUT'],
  route: 'panel-teacher/students/{studentTeacherId}/lesson-plan/one-time/{lessonId}',
  handler: updateTeacherOneTimeLessonHandler,
})

registerHttp('panel-teacher-lesson-plan-one-time-delete', {
  authLevel: 'anonymous',
  methods: ['DELETE'],
  route: 'panel-teacher/students/{studentTeacherId}/lesson-plan/one-time/{lessonId}',
  handler: deleteTeacherOneTimeLessonHandler,
})

registerHttp('panel-teacher-resource-books-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel-teacher/students/{studentTeacherId}/resource-books',
  handler: listTeacherResourceBooksHandler,
})

registerHttp('panel-teacher-resource-book-topics-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel-teacher/students/{studentTeacherId}/resource-book-topics',
  handler: listTeacherResourceBookTopicsHandler,
})

registerHttp('panel-teacher-resource-book-topic-test-completion-mark', {
  authLevel: 'anonymous',
  methods: ['PUT'],
  route: 'panel-teacher/students/{studentTeacherId}/resource-book-topic-tests/{testId}/completion',
  handler: markTeacherResourceBookTopicTestCompletionHandler,
})

registerHttp('panel-teacher-resource-book-topic-test-completion-unmark', {
  authLevel: 'anonymous',
  methods: ['DELETE'],
  route: 'panel-teacher/students/{studentTeacherId}/resource-book-topic-tests/{testId}/completion',
  handler: unmarkTeacherResourceBookTopicTestCompletionHandler,
})

registerHttp('panel-teacher-resource-book-topic-test-optical-completion', {
  authLevel: 'anonymous',
  methods: ['PUT'],
  route: 'panel-teacher/students/{studentTeacherId}/resource-book-topic-tests/{testId}/optical-completion',
  handler: submitTeacherManualOpticalAnswersHandler,
})

registerHttp('panel-teacher-resource-book-topic-test-mistake-photo-save', {
  authLevel: 'anonymous',
  methods: ['PUT'],
  route: 'panel-teacher/students/{studentTeacherId}/resource-book-topic-tests/{testId}/mistakes/{orderNo}',
  handler: saveTeacherManualWrongQuestionPhotoHandler,
})

registerHttp('panel-teacher-homeworks-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel-teacher/students/{studentTeacherId}/homeworks',
  handler: listTeacherStudentHomeworksHandler,
})

registerHttp('panel-teacher-school-resources-get', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel-teacher/students/{studentTeacherId}/school-resources',
  handler: getTeacherStudentSchoolResourcesHandler,
})

registerHttp('panel-teacher-homeworks-create', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'panel-teacher/students/{studentTeacherId}/homeworks',
  handler: createTeacherHomeworkHandler,
})

registerHttp('panel-teacher-homeworks-assign-task', {
  authLevel: 'anonymous',
  methods: ['PUT'],
  route: 'panel-teacher/students/{studentTeacherId}/homeworks/{homeworkId}/task',
  handler: assignTeacherHomeworkTaskHandler,
})

registerHttp('panel-teacher-homeworks-update', {
  authLevel: 'anonymous',
  methods: ['PATCH'],
  route: 'panel-teacher/students/{studentTeacherId}/homeworks/{homeworkId}',
  handler: updateTeacherHomeworkHandler,
})

registerHttp('panel-teacher-homeworks-delete', {
  authLevel: 'anonymous',
  methods: ['DELETE'],
  route: 'panel-teacher/students/{studentTeacherId}/homeworks/{homeworkId}',
  handler: deleteTeacherHomeworkHandler,
})

registerHttp('panel-teacher-tasks-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel-teacher/students/{studentTeacherId}/tasks',
  handler: listTeacherStudentTasksHandler,
})

registerHttp('panel-teacher-tasks-update', {
  authLevel: 'anonymous',
  methods: ['PATCH'],
  route: 'panel-teacher/students/{studentTeacherId}/tasks/{taskId}',
  handler: updateTeacherStudentTaskHandler,
})

registerHttp('panel-teacher-tasks-delete', {
  authLevel: 'anonymous',
  methods: ['DELETE'],
  route: 'panel-teacher/students/{studentTeacherId}/tasks/{taskId}',
  handler: deleteTeacherStudentTaskHandler,
})

registerHttp('panel-teacher-tasks-review-set', {
  authLevel: 'anonymous',
  methods: ['PATCH'],
  route: 'panel-teacher/students/{studentTeacherId}/tasks/{taskId}/review',
  handler: setTeacherTaskReviewHandler,
})

registerHttp('panel-teacher-student-school-schedule-get', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel-teacher/students/{studentTeacherId}/school-schedule',
  handler: getTeacherStudentSchoolScheduleHandler,
})

registerHttp('panel-teacher-tasks-answer-sheet-get', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel-teacher/students/{studentTeacherId}/tasks/{taskId}/answer-sheet',
  handler: getTeacherTaskAnswerSheetHandler,
})

registerHttp('panel-teacher-progress-overview', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel-teacher/students/{studentTeacherId}/progress-overview',
  handler: getTeacherStudentProgressOverviewHandler,
})

registerHttp('panel-teacher-wrong-questions-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel-teacher/students/{studentTeacherId}/wrong-questions',
  handler: listTeacherStudentWrongQuestionsHandler,
})

registerHttp('panel-teacher-wrong-question-topic-stats', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel-teacher/students/{studentTeacherId}/wrong-question-topic-stats',
  handler: getTeacherStudentWrongQuestionTopicStatsHandler,
})

registerHttp('panel-teacher-wrong-questions-update', {
  authLevel: 'anonymous',
  methods: ['PATCH'],
  route: 'panel-teacher/students/{studentTeacherId}/wrong-questions/{wrongQuestionId}',
  handler: updateTeacherStudentWrongQuestionHandler,
})

registerHttp('panel-teacher-wrong-questions-photo', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel-teacher/students/{studentTeacherId}/wrong-questions/{wrongQuestionId}/photo',
  handler: getTeacherStudentWrongQuestionPhotoHandler,
})

registerHttp('parent-return', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'parent/return',
  handler: exitStudentHandler,
})

registerHttp('parent-student-profile-get', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'parent/students/{studentId}/profile',
  handler: getStudentProfileHandler,
})

registerHttp('parent-student-profile-update', {
  authLevel: 'anonymous',
  methods: ['PUT'],
  route: 'parent/students/{studentId}/profile',
  handler: updateStudentProfileHandler,
})

registerHttp('panel-geo-provinces-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel/geo/provinces',
  handler: listProvincesHandler,
})

registerHttp('panel-geo-districts-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel/geo/districts',
  handler: listDistrictsHandler,
})

registerHttp('panel-geo-schools-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel/geo/schools',
  handler: listSchoolsHandler,
})

registerHttp('panel-admin-schools-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel-admin/schools',
  handler: listSchoolsForAdminHandler,
})

registerHttp('panel-admin-schools-create', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'panel-admin/schools',
  handler: createSchoolHandler,
})

registerHttp('panel-admin-schools-update', {
  authLevel: 'anonymous',
  methods: ['PATCH'],
  route: 'panel-admin/schools/{schoolId}',
  handler: updateSchoolHandler,
})

registerHttp('panel-admin-schools-bulk-import', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'panel-admin/schools/bulk-import',
  handler: bulkImportSchoolsHandler,
})

registerHttp('panel-admin-school-class-schedule-get', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel-admin/schools/{schoolId}/class-schedules',
  handler: getSchoolClassScheduleHandler,
})

registerHttp('panel-admin-school-class-schedule-save', {
  authLevel: 'anonymous',
  methods: ['PUT'],
  route: 'panel-admin/schools/{schoolId}/class-schedules',
  handler: saveSchoolClassScheduleHandler,
})

registerHttp('panel-admin-school-resources-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel-admin/schools/{schoolId}/resources',
  handler: listSchoolResourcesHandler,
})

registerHttp('panel-admin-school-resources-create', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'panel-admin/schools/{schoolId}/resources',
  handler: createSchoolResourceHandler,
})

registerHttp('panel-admin-school-resources-update', {
  authLevel: 'anonymous',
  methods: ['PATCH'],
  route: 'panel-admin/schools/{schoolId}/resources/{resourceId}',
  handler: updateSchoolResourceHandler,
})

registerHttp('panel-admin-school-resources-delete', {
  authLevel: 'anonymous',
  methods: ['DELETE'],
  route: 'panel-admin/schools/{schoolId}/resources/{resourceId}',
  handler: deleteSchoolResourceHandler,
})

registerHttp('panel-admin-school-calendar-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel-admin/schools/{schoolId}/calendar',
  handler: listSchoolCalendarHandler,
})

registerHttp('panel-admin-school-calendar-create', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'panel-admin/schools/{schoolId}/calendar',
  handler: createSchoolCalendarEntryHandler,
})

registerHttp('panel-admin-school-calendar-delete', {
  authLevel: 'anonymous',
  methods: ['DELETE'],
  route: 'panel-admin/schools/{schoolId}/calendar/{entryId}',
  handler: deleteSchoolCalendarEntryHandler,
})

registerHttp('panel-admin-subjects', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel-admin/subjects',
  handler: listSubjectsHandler,
})

registerHttp('panel-admin-subjects-create', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'panel-admin/subjects',
  handler: createSubjectHandler,
})

registerHttp('panel-admin-subjects-update', {
  authLevel: 'anonymous',
  methods: ['PATCH'],
  route: 'panel-admin/subjects/{subjectId}',
  handler: updateSubjectHandler,
})

registerHttp('panel-subjects', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel/subjects',
  handler: listSubjectsForPanelHandler,
})

registerHttp('panel-admin-publishers-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel-admin/publishers',
  handler: listPublishersHandler,
})

registerHttp('panel-admin-publishers-create', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'panel-admin/publishers',
  handler: createPublisherHandler,
})

registerHttp('panel-publishers', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel/publishers',
  handler: listPublishersForPanelHandler,
})

registerHttp('panel-admin-motivation-messages-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel-admin/motivation-messages',
  handler: listMotivationMessagesHandler,
})

registerHttp('panel-admin-motivation-messages-create', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'panel-admin/motivation-messages',
  handler: createMotivationMessageHandler,
})

registerHttp('panel-admin-motivation-messages-update', {
  authLevel: 'anonymous',
  methods: ['PATCH'],
  route: 'panel-admin/motivation-messages/{messageId}',
  handler: updateMotivationMessageHandler,
})

registerHttp('panel-motivation-message-pool', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel/motivation-message-pool',
  handler: listMotivationMessagePoolForPanelHandler,
})

registerHttp('panel-admin-greeting-rules-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel-admin/greeting-rules',
  handler: listGreetingRulesHandler,
})

registerHttp('panel-admin-greeting-rules-create', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'panel-admin/greeting-rules',
  handler: createGreetingRuleHandler,
})

registerHttp('panel-admin-greeting-rules-update', {
  authLevel: 'anonymous',
  methods: ['PATCH'],
  route: 'panel-admin/greeting-rules/{ruleId}',
  handler: updateGreetingRuleHandler,
})

registerHttp('panel-admin-greeting-rules-delete', {
  authLevel: 'anonymous',
  methods: ['DELETE'],
  route: 'panel-admin/greeting-rules/{ruleId}',
  handler: deleteGreetingRuleHandler,
})

registerHttp('panel-greeting-rules', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel/greeting-rules',
  handler: listGreetingRulesForPanelHandler,
})

registerHttp('panel-admin-resource-books-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel-admin/resource-books',
  handler: listResourceBooksHandler,
})

registerHttp('panel-admin-resource-books-create', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'panel-admin/resource-books',
  handler: createResourceBookHandler,
})

registerHttp('panel-admin-resource-books-update', {
  authLevel: 'anonymous',
  methods: ['PATCH'],
  route: 'panel-admin/resource-books/{resourceBookId}',
  handler: updateResourceBookHandler,
})

registerHttp('panel-admin-resource-books-review', {
  authLevel: 'anonymous',
  methods: ['PATCH'],
  route: 'panel-admin/resource-books/{resourceBookId}/review',
  handler: reviewResourceBookHandler,
})

registerHttp('panel-admin-resource-books-missing-answer-key', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel-admin/resource-books/missing-answer-key',
  handler: listResourceBooksMissingAnswerKeyHandler,
})

registerHttp('panel-resource-books', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel/resource-books',
  handler: listResourceBooksForPanelHandler,
})

registerHttp('panel-teachers-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel/teachers',
  handler: listStudentTeachersForPanelHandler,
})

registerHttp('panel-admin-resource-book-topics-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel-admin/resource-book-topics',
  handler: listResourceBookTopicsHandler,
})

registerHttp('panel-admin-resource-book-topics-create', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'panel-admin/resource-book-topics',
  handler: createResourceBookTopicHandler,
})

registerHttp('panel-admin-resource-book-topics-update', {
  authLevel: 'anonymous',
  methods: ['PATCH'],
  route: 'panel-admin/resource-book-topics/{topicId}',
  handler: updateResourceBookTopicHandler,
})

registerHttp('panel-admin-resource-book-topics-delete', {
  authLevel: 'anonymous',
  methods: ['DELETE'],
  route: 'panel-admin/resource-book-topics/{topicId}',
  handler: deleteResourceBookTopicHandler,
})

registerHttp('panel-resource-book-topics', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel/resource-book-topics',
  handler: listResourceBookTopicsForPanelHandler,
})

registerHttp('panel-resource-book-topic-test-completion-mark', {
  authLevel: 'anonymous',
  methods: ['PUT'],
  route: 'panel/resource-book-topic-tests/{testId}/completion',
  handler: markResourceBookTopicTestCompletionHandler,
})

registerHttp('panel-resource-book-topic-test-completion-unmark', {
  authLevel: 'anonymous',
  methods: ['DELETE'],
  route: 'panel/resource-book-topic-tests/{testId}/completion',
  handler: unmarkResourceBookTopicTestCompletionHandler,
})

registerHttp('panel-resource-book-topic-test-optical-completion', {
  authLevel: 'anonymous',
  methods: ['PUT'],
  route: 'panel/resource-book-topic-tests/{testId}/optical-completion',
  handler: submitManualOpticalAnswersHandler,
})

registerHttp('panel-resource-book-topic-test-mistake-photo-save', {
  authLevel: 'anonymous',
  methods: ['PUT'],
  route: 'panel/resource-book-topic-tests/{testId}/mistakes/{orderNo}',
  handler: saveManualWrongQuestionPhotoHandler,
})

registerHttp('panel-admin-resource-book-topic-tests-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel-admin/resource-book-topic-tests',
  handler: listResourceBookTopicTestsHandler,
})

registerHttp('panel-admin-resource-book-topic-tests-create', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'panel-admin/resource-book-topic-tests',
  handler: createResourceBookTopicTestHandler,
})

registerHttp('panel-admin-resource-book-topic-tests-update', {
  authLevel: 'anonymous',
  methods: ['PATCH'],
  route: 'panel-admin/resource-book-topic-tests/{testId}',
  handler: updateResourceBookTopicTestHandler,
})

registerHttp('panel-admin-resource-book-topic-tests-delete', {
  authLevel: 'anonymous',
  methods: ['DELETE'],
  route: 'panel-admin/resource-book-topic-tests/{testId}',
  handler: deleteResourceBookTopicTestHandler,
})

registerHttp('panel-admin-resource-book-topic-tests-questions-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel-admin/resource-book-topic-tests/{testId}/questions',
  handler: listQuestionsForTestHandler,
})

registerHttp('panel-admin-resource-book-topic-tests-questions-create', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'panel-admin/resource-book-topic-tests/{testId}/questions',
  handler: createQuestionHandler,
})

registerHttp('panel-admin-resource-book-topic-tests-questions-extract', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'panel-admin/resource-book-topic-tests/{testId}/questions/extract',
  handler: extractQuestionsFromImageHandler,
})

registerHttp('panel-admin-resource-book-topic-tests-answer-key-get', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel-admin/resource-book-topic-tests/{testId}/answer-key',
  handler: listTestAnswerKeyHandler,
})

registerHttp('panel-admin-resource-book-topic-tests-answer-key-set', {
  authLevel: 'anonymous',
  methods: ['PUT'],
  route: 'panel-admin/resource-book-topic-tests/{testId}/answer-key',
  handler: setTestAnswerKeyHandler,
})

registerHttp('panel-bookshelf-resource-books-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel/bookshelf/resource-books',
  handler: listBookshelfBooksHandler,
})

registerHttp('panel-bookshelf-resource-books-create', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'panel/bookshelf/resource-books',
  handler: createBookshelfBookHandler,
})

registerHttp('panel-bookshelf-resource-book-get', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel/bookshelf/resource-books/{resourceBookId}',
  handler: getBookshelfBookHandler,
})

registerHttp('panel-bookshelf-resource-book-update', {
  authLevel: 'anonymous',
  methods: ['PATCH'],
  route: 'panel/bookshelf/resource-books/{resourceBookId}',
  handler: updateBookshelfBookHandler,
})

registerHttp('panel-bookshelf-resource-book-delete', {
  authLevel: 'anonymous',
  methods: ['DELETE'],
  route: 'panel/bookshelf/resource-books/{resourceBookId}',
  handler: deleteBookshelfBookHandler,
})

registerHttp('panel-bookshelf-resource-book-students', {
  authLevel: 'anonymous',
  methods: ['PUT'],
  route: 'panel/bookshelf/resource-books/{resourceBookId}/students',
  handler: setBookshelfBookStudentsHandler,
})

registerHttp('panel-bookshelf-publishers-create', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'panel/bookshelf/publishers',
  handler: createBookshelfPublisherHandler,
})

registerHttp('panel-bookshelf-students-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel/bookshelf/students',
  handler: listBookshelfStudentsHandler,
})

registerHttp('panel-homeworks-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel/homeworks',
  handler: listHomeworksHandler,
})

registerHttp('panel-homeworks-create', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'panel/homeworks',
  handler: createHomeworkHandler,
})

registerHttp('panel-homeworks-update', {
  authLevel: 'anonymous',
  methods: ['PATCH'],
  route: 'panel/homeworks/{homeworkId}',
  handler: updateHomeworkHandler,
})

registerHttp('panel-homeworks-assign-task', {
  authLevel: 'anonymous',
  methods: ['PUT'],
  route: 'panel/homeworks/{homeworkId}/task',
  handler: assignHomeworkTaskHandler,
})

registerHttp('panel-homeworks-delete', {
  authLevel: 'anonymous',
  methods: ['DELETE'],
  route: 'panel/homeworks/{homeworkId}',
  handler: deleteHomeworkHandler,
})

registerHttp('panel-tasks-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel/tasks',
  handler: listTasksHandler,
})

registerHttp('panel-tasks-create', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'panel/tasks',
  handler: createTaskHandler,
})

registerHttp('panel-tasks-get', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel/tasks/{taskId}',
  handler: getTaskHandler,
})

registerHttp('panel-tasks-update', {
  authLevel: 'anonymous',
  methods: ['PATCH'],
  route: 'panel/tasks/{taskId}',
  handler: updateTaskHandler,
})

registerHttp('panel-tasks-delete', {
  authLevel: 'anonymous',
  methods: ['DELETE'],
  route: 'panel/tasks/{taskId}',
  handler: deleteTaskHandler,
})

registerHttp('panel-task-activity-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel/task-activity',
  handler: listTaskActivityLogsHandler,
})

registerHttp('panel-tasks-answer-sheet-get', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel/tasks/{taskId}/answer-sheet',
  handler: getTaskAnswerSheetHandler,
})

registerHttp('panel-tasks-answers-save', {
  authLevel: 'anonymous',
  methods: ['PATCH'],
  route: 'panel/tasks/{taskId}/answers',
  handler: saveTaskAnswersHandler,
})

registerHttp('panel-tasks-mistake-photo-save', {
  authLevel: 'anonymous',
  methods: ['PUT'],
  route: 'panel/tasks/{taskId}/mistakes/{testId}/{orderNo}',
  handler: saveWrongQuestionPhotoHandler,
})

registerHttp('panel-mistake-photo-question-number-check', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'panel/mistake-photo/question-number-check',
  handler: verifyMistakePhotoQuestionNumberHandler,
})

registerHttp('panel-tasks-test-remove', {
  authLevel: 'anonymous',
  methods: ['DELETE'],
  route: 'panel/tasks/{taskId}/tests/{testId}',
  handler: removeTaskTestHandler,
})

registerHttp('panel-school-schedule-get', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel/school-schedule',
  handler: getPanelSchoolScheduleHandler,
})

registerHttp('panel-school-resources-get', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel/school-resources',
  handler: getPanelSchoolResourcesHandler,
})

registerHttp('panel-coach-notes-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel/coach-notes',
  handler: listCoachNotesHandler,
})

registerHttp('panel-coach-notes-create', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'panel/coach-notes',
  handler: addCoachNoteHandler,
})

registerHttp('panel-student-requests-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel/student-requests',
  handler: listStudentRequestsHandler,
})

registerHttp('panel-student-requests-update', {
  authLevel: 'anonymous',
  methods: ['PATCH'],
  route: 'panel/student-requests/{requestId}',
  handler: updateStudentRequestHandler,
})

registerHttp('panel-check-in-get', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel/check-in',
  handler: getCheckInHandler,
})

registerHttp('panel-check-in-set', {
  authLevel: 'anonymous',
  methods: ['PUT'],
  route: 'panel/check-in',
  handler: saveCheckInHandler,
})

registerHttp('panel-wrong-questions-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel/wrong-questions',
  handler: listWrongQuestionsHandler,
})

registerHttp('panel-wrong-questions-create', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'panel/wrong-questions',
  handler: addWrongQuestionHandler,
})

registerHttp('panel-wrong-questions-update', {
  authLevel: 'anonymous',
  methods: ['PATCH'],
  route: 'panel/wrong-questions/{wrongQuestionId}',
  handler: updateWrongQuestionHandler,
})

registerHttp('panel-wrong-questions-photo', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel/wrong-questions/{wrongQuestionId}/photo',
  handler: getWrongQuestionPhotoHandler,
})

registerHttp('panel-wrong-question-topic-stats', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel/wrong-question-topic-stats',
  handler: getWrongQuestionTopicStatsHandler,
})

registerHttp('panel-study-sessions-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel/study-sessions',
  handler: listStudySessionsHandler,
})

registerHttp('panel-study-sessions-create', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'panel/study-sessions',
  handler: addStudySessionHandler,
})

registerHttp('panel-progress-overview', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel/progress-overview',
  handler: getProgressOverviewHandler,
})

registerHttp('panel-parent-messages-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel/parent-messages',
  handler: listParentMessagesHandler,
})

registerHttp('panel-parent-messages-create', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'panel/parent-messages',
  handler: createParentMessageHandler,
})

registerHttp('panel-parent-messages-update', {
  authLevel: 'anonymous',
  methods: ['PATCH'],
  route: 'panel/parent-messages/{messageId}',
  handler: updateParentMessageHandler,
})

registerHttp('panel-motivation-feedback-create', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'panel/motivation-feedback',
  handler: addMotivationFeedbackHandler,
})

registerHttp('panel-motivation-daily-selection-get', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel/motivation-daily-selection',
  handler: getDailySelectionHandler,
})

registerHttp('panel-motivation-daily-selection-set', {
  authLevel: 'anonymous',
  methods: ['PUT'],
  route: 'panel/motivation-daily-selection',
  handler: setDailySelectionHandler,
})

registerHttp('panel-motivation-daily-selection-switch', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'panel/motivation-daily-selection/switch',
  handler: incrementSwitchCountHandler,
})

registerHttp('panel-small-goal-get', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel/small-goal',
  handler: getSmallGoalHandler,
})

registerHttp('panel-small-goal-set', {
  authLevel: 'anonymous',
  methods: ['PUT'],
  route: 'panel/small-goal',
  handler: setSmallGoalHandler,
})

registerHttp('panel-requests-create', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'panel/requests',
  handler: createPanelRequestHandler,
})

registerHttp('panel-requests-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel/requests',
  handler: listMyPanelRequestsHandler,
})

registerHttp('panel-requests-get', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel/requests/{requestId}',
  handler: getPanelRequestHandler,
})

registerHttp('panel-requests-messages-add', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'panel/requests/{requestId}/messages',
  handler: addPanelRequestMessageHandler,
})

registerHttp('panel-admin-requests-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel-admin/requests',
  handler: listAdminPanelRequestsHandler,
})

registerHttp('panel-admin-requests-update', {
  authLevel: 'anonymous',
  methods: ['PATCH'],
  route: 'panel-admin/requests/{requestId}',
  handler: updateAdminPanelRequestHandler,
})
