const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const assert = require('node:assert/strict')
;(async () => {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } })
    const errors = []
    let children = [{ id: 'child-1', fullName: 'İpek Test', schoolName: 'Test Okulu', grade: '8', resourceCount: 2 }]
    page.on('pageerror', error => errors.push(error.message))
    await page.route('**/api/**', route => {
      const path = new URL(route.request().url()).pathname
      const json = path === '/api/auth/me' ? { user: { id: 'guide-parent', role: 'ebeveyn', fullName: 'Deniz Test' } } : path === '/api/parent/students' ? { students: children, quota: { hasRemaining: true } } : { resourceBooks: [], requests: [] }
      return route.fulfill({ json })
    })
    const base = process.env.TEST_BASE_URL || 'http://localhost:5173'
    await page.goto(`${base}/parent/students`)
    await page.getByRole('button', { name: 'Hesap menüsü' }).click()
    await page.getByRole('button', { name: 'Başlangıç rehberini aç' }).click()
    await page.waitForURL('**/parent/guide')
    await page.getByText('İpek için çocuk profili mevcut.', { exact: false }).waitFor()
    assert.equal(await page.locator('[role="dialog"]').count(), 0)
    assert.equal(await page.getByRole('link', { name: 'Çocuk profili oluştur', exact: true }).count(), 0)
    assert.equal(await page.locator('section[id^="guide-"]').count(), 8)
    assert.equal(await page.getByRole('link', { name: 'Profil bilgilerini incele' }).getAttribute('href'), '/parent/students?action=profile&studentId=child-1')
    for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }]) {
      await page.setViewportSize(viewport)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    }
    await page.getByRole('link', { name: 'Kitaplığı aç', exact: true }).click()
    await page.waitForURL('**/parent/bookshelf')
    children = []
    await page.evaluate(() => localStorage.clear())
    await page.goto(`${base}/parent/students`)
    const modal = page.locator('dialog[open]')
    await modal.waitFor()
    await modal.getByRole('button', { name: 'Başlangıç rehberini aç' }).click()
    await page.waitForURL('**/parent/guide')
    await page.getByRole('link', { name: 'Çocuk profili oluştur', exact: true }).waitFor()
    assert.equal(await page.locator('[role="dialog"]').count(), 0)
    await page.reload()
    await page.getByRole('heading', { name: 'Başlangıç rehberi', exact: true }).waitFor()
    assert.deepEqual(errors, [])
    console.log('PASS existing child, new parent, menu/welcome entry points, eight sections, mobile overflow, profile/library links, direct route reload')
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exit(1) })
