const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const assert = require('node:assert/strict')

;(async () => {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } })
    const errors = []
    const saved = []
    const children = [{ id: 'child-1', fullName: 'İpek Test', grade: '8' }]
    page.on('pageerror', error => errors.push(error.message))
    await page.route('**/api/**', route => {
      const request = route.request()
      const path = new URL(request.url()).pathname
      if (path === '/api/panel/bookshelf/resource-books' && request.method() === 'POST') {
        saved.push(request.postDataJSON())
        return route.fulfill({ json: { resourceBook: { id: 'new-book', ...saved.at(-1) } } })
      }
      const json = path === '/api/auth/me' ? { user: { id: 'parent', role: 'ebeveyn', fullName: 'Deniz Test' } }
        : path === '/api/parent/students' || path === '/api/panel/bookshelf/students' ? { students: children, quota: { hasRemaining: true } }
          : path === '/api/panel/subjects' ? { subjects: [{ id: 'math', name: 'Matematik' }] }
            : path === '/api/panel/publishers' ? { publishers: [{ id: 'publisher', name: 'Test Yayınları' }] }
              : { resourceBooks: [], requests: [] }
      return route.fulfill({ json })
    })
    const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:5173'
    await page.goto(`${base}/parent/bookshelf`)
    await page.getByRole('button', { name: 'Yeni Kitap Ekle', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Yeni Kitap Ekle' })
    await dialog.getByRole('radio').first().waitFor({ state: 'attached' })
    const assertFits = async () => {
      const metrics = await dialog.evaluate(el => ({
        width: el.scrollWidth, clientWidth: el.clientWidth,
        overflowing: [...el.querySelectorAll('*')].filter(node => getComputedStyle(node).overflowY === 'auto' && node.scrollHeight > node.clientHeight + 1).map(node => ({ height: node.clientHeight, content: node.scrollHeight })),
        bottom: el.querySelector('[data-book-form-footer]').getBoundingClientRect().bottom,
        viewport: innerHeight,
      }))
      if (metrics.overflowing.length) await page.screenshot({ path: '/tmp/book-wizard-overflow.png' })
      assert.ok(metrics.width <= metrics.clientWidth, JSON.stringify(metrics))
      assert.deepEqual(metrics.overflowing, [], JSON.stringify(metrics))
      assert.ok(metrics.bottom <= metrics.viewport, JSON.stringify(metrics))
    }
    for (const viewport of [{ width: 1366, height: 768 }, { width: 390, height: 844 }, { width: 375, height: 667 }, { width: 320, height: 568 }]) {
      await page.setViewportSize(viewport)
      for (const mode of ['İçindekileri ekleyerek', 'İçindekiler eklemeden']) {
        await dialog.getByText(mode, { exact: true }).click()
        const preparation = dialog.getByRole('region', { name: 'Yapmanız gerekenler' })
        assert.equal(await preparation.getByRole('listitem').count(), 3)
        await preparation.getByText(mode === 'İçindekileri ekleyerek' ? 'Konu ve testleri girin' : 'Görevi siz yazın', { exact: true }).waitFor()
        await assertFits()
      }
    }
    await page.setViewportSize({ width: 390, height: 844 })
    await dialog.getByText('İçindekileri ekleyerek', { exact: true }).click()
    await page.screenshot({ path: '/tmp/book-preference-mobile.png' })
    await dialog.getByText('İçindekiler eklemeden', { exact: true }).click()
    await dialog.getByRole('button', { name: 'Devam', exact: true }).click()
    await dialog.getByRole('button', { name: 'Devam', exact: true }).click()
    await dialog.getByRole('alert').filter({ hasText: 'Kitap adı' }).waitFor()
    assert.equal(saved.length, 0)
    await dialog.getByLabel('Kitap Adı', { exact: true }).fill('Matematik kitabım')
    await dialog.getByLabel('Ders', { exact: true }).selectOption('math')
    await dialog.getByLabel('Sınıf', { exact: true }).selectOption('8')
    await page.setViewportSize({ width: 320, height: 568 })
    await assertFits()
    await dialog.getByRole('button', { name: 'Devam', exact: true }).click()
    assert.equal(await dialog.getByLabel('Kaynak Tipi', { exact: true }).count(), 0)
    await assertFits()
    await dialog.getByRole('button', { name: 'Geri', exact: true }).click()
    assert.equal(await dialog.getByLabel('Kitap Adı', { exact: true }).inputValue(), 'Matematik kitabım')
    await dialog.getByRole('button', { name: 'Devam', exact: true }).click()
    await dialog.getByRole('button', { name: 'Kitabı Ekle', exact: true }).click()
    await dialog.getByRole('alert').filter({ hasText: 'Yayın evi' }).waitFor()
    await dialog.getByLabel('Yayın evi', { exact: true }).selectOption('publisher')
    await dialog.getByRole('button', { name: 'Kitabı Ekle', exact: true }).click()
    await dialog.waitFor({ state: 'hidden' })
    assert.equal(saved.length, 1)
    assert.equal(saved[0].contentMode, 'simple')
    assert.equal(saved[0].hasAnswerKey, false)
    assert.deepEqual(saved[0].studentIds, ['child-1'])
    await page.goto(`${base}/parent/bookshelf`)

    await page.getByRole('button', { name: 'Yeni Kitap Ekle', exact: true }).click()
    await dialog.getByRole('button', { name: 'Devam', exact: true }).click()
    await dialog.getByLabel('Kitap Adı', { exact: true }).fill('Test kitabım')
    await dialog.getByLabel('Ders', { exact: true }).selectOption('math')
    await dialog.getByLabel('Sınıf', { exact: true }).selectOption('8')
    await dialog.getByRole('button', { name: 'Devam', exact: true }).click()
    await dialog.getByLabel('Kaynak Tipi', { exact: true }).selectOption('soru_bankasi')
    await assertFits()
    await dialog.getByLabel('Yayın evi', { exact: true }).selectOption('publisher')
    await page.screenshot({ path: '/tmp/book-wizard-mobile-details.png' })
    await dialog.getByRole('button', { name: 'Geri', exact: true }).click()
    await dialog.getByRole('button', { name: 'Geri', exact: true }).click()
    await page.setViewportSize({ width: 390, height: 844 })
    await page.screenshot({ path: '/tmp/book-wizard-mobile.png' })
    await page.setViewportSize({ width: 1366, height: 768 })
    await page.screenshot({ path: '/tmp/book-wizard-desktop.png' })
    await dialog.getByRole('button', { name: 'Devam', exact: true }).click()
    await dialog.getByRole('button', { name: 'Devam', exact: true }).click()
    await dialog.getByRole('button', { name: 'Kitabı Ekle', exact: true }).click()
    await dialog.waitFor({ state: 'hidden' })
    assert.equal(saved.length, 2)
    assert.equal(saved[1].contentMode, 'structured')
    assert.equal(saved[1].hasAnswerKey, true)
    assert.equal(saved[1].type, 'soru_bankasi')
    assert.deepEqual(errors, [])
    console.log('PASS: mobile/desktop fit, both modes, preview, step validation, back navigation, preserved values, final save payloads')
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exit(1) })
