const { app } = require('@azure/functions')
const { loginHandler, logoutHandler, meHandler, registerHandler } = require('./auth')

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
