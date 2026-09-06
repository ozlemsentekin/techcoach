const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const assert = require('node:assert/strict')
;(async () => {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
    let required = true
    let role = 'ebeveyn'
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.route('**/api/**', route => {
      const path = new URL(route.request().url()).pathname
      if (path === '/api/auth/change-password') {
        const body = route.request().postDataJSON()
        if (body.currentPassword !== '234567') return route.fulfill({ status: 401, json: { error: 'Mevcut şifre hatalı.' } })
        required = false
        return route.fulfill({ json: { ok: true } })
      }
      return route.fulfill({ json: path === '/api/auth/me' ? { user: { id: 'first-login', role, fullName: 'Deniz Test', phone: '+905001234567', mustChangePassword: required } } : { students: [], resourceBooks: [], requests: [] } })
    })
    const base = process.env.TEST_BASE_URL || 'http://localhost:5173'
    await page.goto(`${base}/parent/guide`)
    await page.getByRole('heading', { name: 'İlk giriş: şifrenizi belirleyin' }).waitFor()
    assert.equal(await page.getByRole('button', { name: 'Vazgeç' }).count(), 0)
    assert.equal(await page.getByRole('button', { name: 'Kapat', exact: true }).count(), 0)
    await page.keyboard.press('Escape')
    await page.reload()
    await page.getByRole('heading', { name: 'İlk giriş: şifrenizi belirleyin' }).waitFor()
    await page.getByLabel('Başlangıç şifresi (telefonun son 6 hanesi)', { exact: true }).fill('wrong')
    await page.getByLabel('Yeni şifre', { exact: true }).fill('NewPassword7')
    await page.getByLabel('Yeni şifre (tekrar)', { exact: true }).fill('NewPassword7')
    await page.getByRole('button', { name: 'Kaydet', exact: true }).click()
    await page.getByRole('alert').filter({ hasText: 'Mevcut şifre hatalı.' }).waitFor()
    await page.getByLabel('Başlangıç şifresi (telefonun son 6 hanesi)', { exact: true }).fill('234567')
    await page.getByRole('button', { name: 'Kaydet', exact: true }).click()
    await page.getByRole('heading', { name: 'Başlangıç rehberi', exact: true }).waitFor()
    await page.getByRole('heading', { name: 'Kim, hangi hesapla giriş yapacak?' }).waitFor()
    await page.reload()
    await page.getByRole('heading', { name: 'Başlangıç rehberi', exact: true }).waitFor()
    assert.equal(await page.getByRole('heading', { name: 'İlk giriş: şifrenizi belirleyin' }).count(), 0)
    role = 'ogrenci'; required = true
    await page.goto(`${base}/student`)
    await page.getByRole('heading', { name: 'İlk giriş: şifrenizi belirleyin' }).waitFor()
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    assert.deepEqual(errors, [])
    console.log('PASS mandatory parent/student first login, no skip/ESC bypass, reload persistence, incorrect password, successful change, subsequent access, guide copy, mobile')
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exit(1) })
