const { app } = require('@azure/functions')
const { changePasswordHandler, loginHandler, logoutHandler, meHandler, registerHandler, acceptConsentHandler } = require('./auth')
const {
  listUsersHandler,
  updateUserHandler,
  deleteUserHandler,
  impersonateUserHandler,
  returnToAdminHandler,
  grantTeacherEntitlementHandler,
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
const { listProvincesHandler, listDistrictsHandler, listSchoolsHandler } = require('./geo')
const {
  listSubjectsHandler,
  createSubjectHandler,
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
  getWeeklyPlanStatusHandler,
  setWeeklyPlanStatusHandler,
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

app.http('auth-register', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'auth/register',
  handler: registerHandler,
})

app.http('auth-subjects', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'auth/subjects',
  handler: listSubjectsForRegistrationHandler,
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

app.http('auth-consent', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'auth/consent',
  handler: acceptConsentHandler,
})

app.http('auth-change-password', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'auth/change-password',
  handler: changePasswordHandler,
})

app.http('billing-revenuecat-webhook', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'billing/revenuecat-webhook',
  handler: revenuecatWebhookHandler,
})

app.http('parent-payments-iyzico-checkout-initialize', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'parent/payments/iyzico/checkout-initialize',
  handler: initiateIyzicoCheckoutHandler,
})

app.http('parent-payments-iyzico-child-seat-checkout-initialize', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'parent/payments/iyzico/child-seat-checkout-initialize',
  handler: initiateChildSeatCheckoutHandler,
})

app.http('payments-iyzico-parent-checkout-initialize', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'payments/iyzico/parent-checkout-initialize',
  handler: initiateIyzicoCheckoutForNewParentHandler,
})

app.http('payments-iyzico-callback', {
  authLevel: 'anonymous',
  methods: ['GET', 'POST'],
  route: 'payments/iyzico/callback',
  handler: iyzicoCheckoutCallbackHandler,
})

app.http('payments-iyzico-webhook', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'payments/iyzico/webhook',
  handler: iyzicoWebhookHandler,
})

app.http('panel-admin-users', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel-admin/users',
  handler: listUsersHandler,
})

app.http('panel-admin-users-update', {
  authLevel: 'anonymous',
  methods: ['PATCH'],
  route: 'panel-admin/users/{userId}',
  handler: updateUserHandler,
})

app.http('panel-admin-users-delete', {
  authLevel: 'anonymous',
  methods: ['DELETE'],
  route: 'panel-admin/users/{userId}',
  handler: deleteUserHandler,
})

app.http('panel-admin-users-impersonate', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'panel-admin/users/{userId}/impersonate',
  handler: impersonateUserHandler,
})

app.http('panel-admin-return-to-admin', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'panel-admin/return-to-admin',
  handler: returnToAdminHandler,
})

app.http('panel-admin-teacher-entitlement-grant', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'panel-admin/users/{userId}/teacher-entitlement',
  handler: grantTeacherEntitlementHandler,
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

app.http('parent-student-teachers-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'parent/students/{studentId}/teachers',
  handler: listStudentTeachersForParentHandler,
})

app.http('parent-teachers-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'parent/teachers',
  handler: listParentTeachersHandler,
})

app.http('parent-student-teachers-create', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'parent/students/{studentId}/teachers',
  handler: createStudentTeacherHandler,
})

app.http('parent-student-teacher-update', {
  authLevel: 'anonymous',
  methods: ['PUT'],
  route: 'parent/students/{studentId}/teachers/{teacherId}',
  handler: updateStudentTeacherHandler,
})

app.http('parent-student-teacher-resource-books-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'parent/students/{studentId}/teachers/{teacherId}/resource-books',
  handler: listTeacherResourceBooksForParentHandler,
})

app.http('parent-student-teacher-resource-books-update', {
  authLevel: 'anonymous',
  methods: ['PUT'],
  route: 'parent/students/{studentId}/teachers/{teacherId}/resource-books',
  handler: updateTeacherResourceBooksForParentHandler,
})

app.http('parent-student-teacher-grant-access', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'parent/students/{studentId}/teachers/{teacherId}/grant-access',
  handler: grantTeacherAccessHandler,
})

app.http('panel-teacher-students-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel-teacher/students',
  handler: listTeacherStudentsHandler,
})

app.http('panel-teacher-student-get', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel-teacher/students/{studentTeacherId}',
  handler: getTeacherStudentHandler,
})

app.http('panel-teacher-student-profile-get', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel-teacher/students/{studentTeacherId}/profile',
  handler: getTeacherStudentProfileHandler,
})

app.http('panel-teacher-student-profile-update', {
  authLevel: 'anonymous',
  methods: ['PUT'],
  route: 'panel-teacher/students/{studentTeacherId}/profile',
  handler: updateTeacherStudentProfileHandler,
})

app.http('panel-teacher-student-private-resource-books-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel-teacher/students/{studentTeacherId}/private-resource-books',
  handler: listTeacherStudentPrivateResourceBooksHandler,
})

app.http('panel-teacher-student-library-resource-book-assign', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'panel-teacher/students/{studentTeacherId}/library/resource-books/{resourceBookId}',
  handler: assignTeacherLibraryResourceBookHandler,
})

app.http('panel-teacher-student-library-resource-book-unassign', {
  authLevel: 'anonymous',
  methods: ['DELETE'],
  route: 'panel-teacher/students/{studentTeacherId}/library/resource-books/{resourceBookId}',
  handler: unassignTeacherLibraryResourceBookHandler,
})

app.http('panel-teacher-student-status-update', {
  authLevel: 'anonymous',
  methods: ['PATCH'],
  route: 'panel-teacher/students/{studentTeacherId}/status',
  handler: updateTeacherStudentStatusHandler,
})

app.http('panel-teacher-student-grade-update', {
  authLevel: 'anonymous',
  methods: ['PATCH'],
  route: 'panel-teacher/students/{studentTeacherId}/grade',
  handler: updateTeacherStudentGradeHandler,
})

app.http('panel-teacher-student-delete', {
  authLevel: 'anonymous',
  methods: ['DELETE'],
  route: 'panel-teacher/students/{studentTeacherId}',
  handler: deleteTeacherStudentHandler,
})

app.http('panel-teacher-students-create', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'panel-teacher/students',
  handler: createTeacherStudentHandler,
})

app.http('panel-teacher-entitlement', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel-teacher/entitlement',
  handler: getTeacherEntitlementHandler,
})

app.http('panel-teacher-profile-update', {
  authLevel: 'anonymous',
  methods: ['PATCH'],
  route: 'panel-teacher/profile',
  handler: updateTeacherProfileHandler,
})

app.http('panel-teacher-parents-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel-teacher/parents',
  handler: listTeacherParentsHandler,
})

app.http('panel-teacher-parents-grant-access', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'panel-teacher/parents/{parentId}/grant-access',
  handler: grantParentAccessHandler,
})

app.http('panel-teacher-lesson-plan', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel-teacher/lesson-plan',
  handler: getTeacherLessonPlanHandler,
})

app.http('panel-teacher-lesson-plan-recurring-create', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'panel-teacher/students/{studentTeacherId}/lesson-plan/recurring',
  handler: addTeacherRecurringLessonSlotHandler,
})

app.http('panel-teacher-lesson-plan-recurring-update', {
  authLevel: 'anonymous',
  methods: ['PUT'],
  route: 'panel-teacher/students/{studentTeacherId}/lesson-plan/recurring',
  handler: updateTeacherRecurringLessonSlotHandler,
})

app.http('panel-teacher-lesson-plan-recurring-delete', {
  authLevel: 'anonymous',
  methods: ['DELETE'],
  route: 'panel-teacher/students/{studentTeacherId}/lesson-plan/recurring',
  handler: deleteTeacherRecurringLessonSlotHandler,
})

app.http('panel-teacher-lesson-plan-recurring-occurrence-update', {
  authLevel: 'anonymous',
  methods: ['PUT'],
  route: 'panel-teacher/students/{studentTeacherId}/lesson-plan/recurring/occurrence',
  handler: moveTeacherRecurringLessonOccurrenceHandler,
})

app.http('panel-teacher-lesson-plan-recurring-occurrence-delete', {
  authLevel: 'anonymous',
  methods: ['DELETE'],
  route: 'panel-teacher/students/{studentTeacherId}/lesson-plan/recurring/occurrence',
  handler: deleteTeacherRecurringLessonOccurrenceHandler,
})

app.http('panel-teacher-lesson-plan-one-time-create', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'panel-teacher/students/{studentTeacherId}/lesson-plan/one-time',
  handler: addTeacherOneTimeLessonHandler,
})

app.http('panel-teacher-lesson-plan-one-time-update', {
  authLevel: 'anonymous',
  methods: ['PUT'],
  route: 'panel-teacher/students/{studentTeacherId}/lesson-plan/one-time/{lessonId}',
  handler: updateTeacherOneTimeLessonHandler,
})

app.http('panel-teacher-lesson-plan-one-time-delete', {
  authLevel: 'anonymous',
  methods: ['DELETE'],
  route: 'panel-teacher/students/{studentTeacherId}/lesson-plan/one-time/{lessonId}',
  handler: deleteTeacherOneTimeLessonHandler,
})

app.http('panel-teacher-resource-books-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel-teacher/students/{studentTeacherId}/resource-books',
  handler: listTeacherResourceBooksHandler,
})

app.http('panel-teacher-resource-book-topics-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel-teacher/students/{studentTeacherId}/resource-book-topics',
  handler: listTeacherResourceBookTopicsHandler,
})

app.http('panel-teacher-resource-book-topic-test-completion-mark', {
  authLevel: 'anonymous',
  methods: ['PUT'],
  route: 'panel-teacher/students/{studentTeacherId}/resource-book-topic-tests/{testId}/completion',
  handler: markTeacherResourceBookTopicTestCompletionHandler,
})

app.http('panel-teacher-resource-book-topic-test-completion-unmark', {
  authLevel: 'anonymous',
  methods: ['DELETE'],
  route: 'panel-teacher/students/{studentTeacherId}/resource-book-topic-tests/{testId}/completion',
  handler: unmarkTeacherResourceBookTopicTestCompletionHandler,
})

app.http('panel-teacher-resource-book-topic-test-optical-completion', {
  authLevel: 'anonymous',
  methods: ['PUT'],
  route: 'panel-teacher/students/{studentTeacherId}/resource-book-topic-tests/{testId}/optical-completion',
  handler: submitTeacherManualOpticalAnswersHandler,
})

app.http('panel-teacher-resource-book-topic-test-mistake-photo-save', {
  authLevel: 'anonymous',
  methods: ['PUT'],
  route: 'panel-teacher/students/{studentTeacherId}/resource-book-topic-tests/{testId}/mistakes/{orderNo}',
  handler: saveTeacherManualWrongQuestionPhotoHandler,
})

app.http('panel-teacher-homeworks-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel-teacher/students/{studentTeacherId}/homeworks',
  handler: listTeacherStudentHomeworksHandler,
})

app.http('panel-teacher-school-resources-get', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel-teacher/students/{studentTeacherId}/school-resources',
  handler: getTeacherStudentSchoolResourcesHandler,
})

app.http('panel-teacher-homeworks-create', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'panel-teacher/students/{studentTeacherId}/homeworks',
  handler: createTeacherHomeworkHandler,
})

app.http('panel-teacher-homeworks-assign-task', {
  authLevel: 'anonymous',
  methods: ['PUT'],
  route: 'panel-teacher/students/{studentTeacherId}/homeworks/{homeworkId}/task',
  handler: assignTeacherHomeworkTaskHandler,
})

app.http('panel-teacher-homeworks-update', {
  authLevel: 'anonymous',
  methods: ['PATCH'],
  route: 'panel-teacher/students/{studentTeacherId}/homeworks/{homeworkId}',
  handler: updateTeacherHomeworkHandler,
})

app.http('panel-teacher-homeworks-delete', {
  authLevel: 'anonymous',
  methods: ['DELETE'],
  route: 'panel-teacher/students/{studentTeacherId}/homeworks/{homeworkId}',
  handler: deleteTeacherHomeworkHandler,
})

app.http('panel-teacher-tasks-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel-teacher/students/{studentTeacherId}/tasks',
  handler: listTeacherStudentTasksHandler,
})

app.http('panel-teacher-tasks-update', {
  authLevel: 'anonymous',
  methods: ['PATCH'],
  route: 'panel-teacher/students/{studentTeacherId}/tasks/{taskId}',
  handler: updateTeacherStudentTaskHandler,
})

app.http('panel-teacher-tasks-delete', {
  authLevel: 'anonymous',
  methods: ['DELETE'],
  route: 'panel-teacher/students/{studentTeacherId}/tasks/{taskId}',
  handler: deleteTeacherStudentTaskHandler,
})

app.http('panel-teacher-student-school-schedule-get', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel-teacher/students/{studentTeacherId}/school-schedule',
  handler: getTeacherStudentSchoolScheduleHandler,
})

app.http('panel-teacher-tasks-answer-sheet-get', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel-teacher/students/{studentTeacherId}/tasks/{taskId}/answer-sheet',
  handler: getTeacherTaskAnswerSheetHandler,
})

app.http('panel-teacher-progress-overview', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel-teacher/students/{studentTeacherId}/progress-overview',
  handler: getTeacherStudentProgressOverviewHandler,
})

app.http('panel-teacher-wrong-questions-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel-teacher/students/{studentTeacherId}/wrong-questions',
  handler: listTeacherStudentWrongQuestionsHandler,
})

app.http('panel-teacher-wrong-question-topic-stats', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel-teacher/students/{studentTeacherId}/wrong-question-topic-stats',
  handler: getTeacherStudentWrongQuestionTopicStatsHandler,
})

app.http('panel-teacher-wrong-questions-update', {
  authLevel: 'anonymous',
  methods: ['PATCH'],
  route: 'panel-teacher/students/{studentTeacherId}/wrong-questions/{wrongQuestionId}',
  handler: updateTeacherStudentWrongQuestionHandler,
})

app.http('panel-teacher-wrong-questions-photo', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel-teacher/students/{studentTeacherId}/wrong-questions/{wrongQuestionId}/photo',
  handler: getTeacherStudentWrongQuestionPhotoHandler,
})

app.http('parent-return', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'parent/return',
  handler: exitStudentHandler,
})

app.http('parent-student-profile-get', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'parent/students/{studentId}/profile',
  handler: getStudentProfileHandler,
})

app.http('parent-student-profile-update', {
  authLevel: 'anonymous',
  methods: ['PUT'],
  route: 'parent/students/{studentId}/profile',
  handler: updateStudentProfileHandler,
})

app.http('panel-geo-provinces-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel/geo/provinces',
  handler: listProvincesHandler,
})

app.http('panel-geo-districts-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel/geo/districts',
  handler: listDistrictsHandler,
})

app.http('panel-geo-schools-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel/geo/schools',
  handler: listSchoolsHandler,
})

app.http('panel-admin-schools-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel-admin/schools',
  handler: listSchoolsForAdminHandler,
})

app.http('panel-admin-schools-create', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'panel-admin/schools',
  handler: createSchoolHandler,
})

app.http('panel-admin-schools-update', {
  authLevel: 'anonymous',
  methods: ['PATCH'],
  route: 'panel-admin/schools/{schoolId}',
  handler: updateSchoolHandler,
})

app.http('panel-admin-schools-bulk-import', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'panel-admin/schools/bulk-import',
  handler: bulkImportSchoolsHandler,
})

app.http('panel-admin-school-class-schedule-get', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel-admin/schools/{schoolId}/class-schedules',
  handler: getSchoolClassScheduleHandler,
})

app.http('panel-admin-school-class-schedule-save', {
  authLevel: 'anonymous',
  methods: ['PUT'],
  route: 'panel-admin/schools/{schoolId}/class-schedules',
  handler: saveSchoolClassScheduleHandler,
})

app.http('panel-admin-school-resources-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel-admin/schools/{schoolId}/resources',
  handler: listSchoolResourcesHandler,
})

app.http('panel-admin-school-resources-create', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'panel-admin/schools/{schoolId}/resources',
  handler: createSchoolResourceHandler,
})

app.http('panel-admin-school-resources-update', {
  authLevel: 'anonymous',
  methods: ['PATCH'],
  route: 'panel-admin/schools/{schoolId}/resources/{resourceId}',
  handler: updateSchoolResourceHandler,
})

app.http('panel-admin-school-resources-delete', {
  authLevel: 'anonymous',
  methods: ['DELETE'],
  route: 'panel-admin/schools/{schoolId}/resources/{resourceId}',
  handler: deleteSchoolResourceHandler,
})

app.http('panel-admin-school-calendar-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel-admin/schools/{schoolId}/calendar',
  handler: listSchoolCalendarHandler,
})

app.http('panel-admin-school-calendar-create', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'panel-admin/schools/{schoolId}/calendar',
  handler: createSchoolCalendarEntryHandler,
})

app.http('panel-admin-school-calendar-delete', {
  authLevel: 'anonymous',
  methods: ['DELETE'],
  route: 'panel-admin/schools/{schoolId}/calendar/{entryId}',
  handler: deleteSchoolCalendarEntryHandler,
})

app.http('panel-admin-subjects', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel-admin/subjects',
  handler: listSubjectsHandler,
})

app.http('panel-admin-subjects-create', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'panel-admin/subjects',
  handler: createSubjectHandler,
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

app.http('panel-publishers', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel/publishers',
  handler: listPublishersForPanelHandler,
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

app.http('panel-admin-resource-books-review', {
  authLevel: 'anonymous',
  methods: ['PATCH'],
  route: 'panel-admin/resource-books/{resourceBookId}/review',
  handler: reviewResourceBookHandler,
})

app.http('panel-admin-resource-books-missing-answer-key', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel-admin/resource-books/missing-answer-key',
  handler: listResourceBooksMissingAnswerKeyHandler,
})

app.http('panel-resource-books', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel/resource-books',
  handler: listResourceBooksForPanelHandler,
})

app.http('panel-teachers-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel/teachers',
  handler: listStudentTeachersForPanelHandler,
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

app.http('panel-admin-resource-book-topics-delete', {
  authLevel: 'anonymous',
  methods: ['DELETE'],
  route: 'panel-admin/resource-book-topics/{topicId}',
  handler: deleteResourceBookTopicHandler,
})

app.http('panel-resource-book-topics', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel/resource-book-topics',
  handler: listResourceBookTopicsForPanelHandler,
})

app.http('panel-resource-book-topic-test-completion-mark', {
  authLevel: 'anonymous',
  methods: ['PUT'],
  route: 'panel/resource-book-topic-tests/{testId}/completion',
  handler: markResourceBookTopicTestCompletionHandler,
})

app.http('panel-resource-book-topic-test-completion-unmark', {
  authLevel: 'anonymous',
  methods: ['DELETE'],
  route: 'panel/resource-book-topic-tests/{testId}/completion',
  handler: unmarkResourceBookTopicTestCompletionHandler,
})

app.http('panel-resource-book-topic-test-optical-completion', {
  authLevel: 'anonymous',
  methods: ['PUT'],
  route: 'panel/resource-book-topic-tests/{testId}/optical-completion',
  handler: submitManualOpticalAnswersHandler,
})

app.http('panel-resource-book-topic-test-mistake-photo-save', {
  authLevel: 'anonymous',
  methods: ['PUT'],
  route: 'panel/resource-book-topic-tests/{testId}/mistakes/{orderNo}',
  handler: saveManualWrongQuestionPhotoHandler,
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

app.http('panel-bookshelf-resource-books-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel/bookshelf/resource-books',
  handler: listBookshelfBooksHandler,
})

app.http('panel-bookshelf-resource-books-create', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'panel/bookshelf/resource-books',
  handler: createBookshelfBookHandler,
})

app.http('panel-bookshelf-resource-book-get', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel/bookshelf/resource-books/{resourceBookId}',
  handler: getBookshelfBookHandler,
})

app.http('panel-bookshelf-resource-book-update', {
  authLevel: 'anonymous',
  methods: ['PATCH'],
  route: 'panel/bookshelf/resource-books/{resourceBookId}',
  handler: updateBookshelfBookHandler,
})

app.http('panel-bookshelf-resource-book-delete', {
  authLevel: 'anonymous',
  methods: ['DELETE'],
  route: 'panel/bookshelf/resource-books/{resourceBookId}',
  handler: deleteBookshelfBookHandler,
})

app.http('panel-bookshelf-resource-book-students', {
  authLevel: 'anonymous',
  methods: ['PUT'],
  route: 'panel/bookshelf/resource-books/{resourceBookId}/students',
  handler: setBookshelfBookStudentsHandler,
})

app.http('panel-bookshelf-publishers-create', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'panel/bookshelf/publishers',
  handler: createBookshelfPublisherHandler,
})

app.http('panel-bookshelf-students-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel/bookshelf/students',
  handler: listBookshelfStudentsHandler,
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

app.http('panel-homeworks-assign-task', {
  authLevel: 'anonymous',
  methods: ['PUT'],
  route: 'panel/homeworks/{homeworkId}/task',
  handler: assignHomeworkTaskHandler,
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

app.http('panel-task-activity-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel/task-activity',
  handler: listTaskActivityLogsHandler,
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

app.http('panel-tasks-mistake-photo-save', {
  authLevel: 'anonymous',
  methods: ['PUT'],
  route: 'panel/tasks/{taskId}/mistakes/{testId}/{orderNo}',
  handler: saveWrongQuestionPhotoHandler,
})

app.http('panel-mistake-photo-question-number-check', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'panel/mistake-photo/question-number-check',
  handler: verifyMistakePhotoQuestionNumberHandler,
})

app.http('panel-tasks-test-remove', {
  authLevel: 'anonymous',
  methods: ['DELETE'],
  route: 'panel/tasks/{taskId}/tests/{testId}',
  handler: removeTaskTestHandler,
})

app.http('panel-school-schedule-get', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel/school-schedule',
  handler: getPanelSchoolScheduleHandler,
})

app.http('panel-school-resources-get', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel/school-resources',
  handler: getPanelSchoolResourcesHandler,
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

app.http('panel-wrong-questions-photo', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel/wrong-questions/{wrongQuestionId}/photo',
  handler: getWrongQuestionPhotoHandler,
})

app.http('panel-wrong-question-topic-stats', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel/wrong-question-topic-stats',
  handler: getWrongQuestionTopicStatsHandler,
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

app.http('panel-requests-create', {
  authLevel: 'anonymous',
  methods: ['POST'],
  route: 'panel/requests',
  handler: createPanelRequestHandler,
})

app.http('panel-requests-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel/requests',
  handler: listMyPanelRequestsHandler,
})

app.http('panel-requests-get', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel/requests/{requestId}',
  handler: getPanelRequestHandler,
})

app.http('panel-admin-requests-list', {
  authLevel: 'anonymous',
  methods: ['GET'],
  route: 'panel-admin/requests',
  handler: listAdminPanelRequestsHandler,
})

app.http('panel-admin-requests-update', {
  authLevel: 'anonymous',
  methods: ['PATCH'],
  route: 'panel-admin/requests/{requestId}',
  handler: updateAdminPanelRequestHandler,
})
