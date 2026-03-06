const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { config } = require('./config')

const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{12,72}$/

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase()
}

function validateRegistrationInput(payload) {
  const fullName = String(payload.fullName || '').trim()
  const email = normalizeEmail(payload.email)
  const password = String(payload.password || '')
  const passwordRepeat = String(payload.passwordRepeat || '')
  const acceptAydinlatma = payload.acceptAydinlatma === true
  const acceptKvkk = payload.acceptKvkk === true

  if (fullName.length < 3 || fullName.length > 120) {
    return 'Ad soyad 3 ile 120 karakter arasında olmalı.'
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) {
    return 'Geçerli bir e-posta adresi girin.'
  }

  if (!PASSWORD_RULE.test(password)) {
    return 'Şifre en az 12 karakter olmalı; büyük harf, küçük harf, rakam ve özel karakter içermelidir.'
  }

  if (password !== passwordRepeat) {
    return 'Şifre tekrarı eşleşmiyor.'
  }

  if (!acceptAydinlatma || !acceptKvkk) {
    return 'Devam etmek için aydınlatma ve KVKK onaylarını vermelisiniz.'
  }

  return null
}

function validateLoginInput(payload) {
  const email = normalizeEmail(payload.email)
  const password = String(payload.password || '')

  if (!email || !password) {
    return 'E-posta ve şifre zorunludur.'
  }

  return null
}

async function hashPassword(password) {
  return bcrypt.hash(password, 12)
}

async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash)
}

function createSessionToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      fullName: user.fullName,
    },
    config.jwtSecret,
    {
      expiresIn: config.tokenTtlSeconds,
      issuer: 'techcoach-api',
      audience: 'techcoach-web',
    },
  )
}

function readSessionToken(request) {
  const cookieHeader = request.headers.get('cookie') || ''
  const cookies = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)

  const target = cookies.find((cookie) => cookie.startsWith(`${config.cookieName}=`))
  return target ? decodeURIComponent(target.slice(config.cookieName.length + 1)) : null
}

function verifySessionToken(token) {
  return jwt.verify(token, config.jwtSecret, {
    issuer: 'techcoach-api',
    audience: 'techcoach-web',
  })
}

module.exports = {
  createSessionToken,
  hashPassword,
  normalizeEmail,
  readSessionToken,
  validateLoginInput,
  validateRegistrationInput,
  verifyPassword,
  verifySessionToken,
}
