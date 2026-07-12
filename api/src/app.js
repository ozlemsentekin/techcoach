const { app } = require('@azure/functions')
const { loginHandler, logoutHandler, meHandler, registerHandler } = require('./auth')
const { listUsersHandler } = require('./admin')
const { listStudentsHandler, createStudentHandler } = require('./students')

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
