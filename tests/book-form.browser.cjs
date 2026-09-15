const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const assert = require('node:assert/strict')

;(async () => {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } })
    const errors = []
    const saved = []
    const books = []
    const results = []
    const children = [{ id: 'child-1', fullName: 'İpek Test', grade: '8' }]
    page.on('pageerror', error => errors.push(error.message))
    await page.route('**/api/**', route => {
      const request = route.request()
      const path = new URL(request.url()).pathname
      if (path === '/api/panel/bookshelf/resource-books' && request.method() === 'POST') {
        saved.push(request.postDataJSON())
        const book = { id: `book-${saved.length}`, ...saved.at(-1), subjectName: 'Matematik', publisherName: 'Test Yayınları', scope: 'private', assigned: true, canEditContent: true, canManageAssignees: true, assignedStudents: children }
        books.push(book)
        return route.fulfill({ json: { resourceBook: book } })
      }
      if (path.startsWith('/api/panel/bookshelf/resource-books/')) {
        return route.fulfill({ json: { resourceBook: books.find(book => path.endsWith('/' + book.id)), topics: [], tests: [] } })
      }
      if (path === '/api/panel/tasks/task-simple/simple-result') {
        results.push(request.postDataJSON())
        return route.fulfill({ json: { task: { id: 'task-simple', status: 'tamamlandi' } } })
      }
      if (path === '/api/panel/resource-books') return route.fulfill({ json: { resourceBooks: books } })
      if (path === '/api/parent/students/child-1/resource-books') return route.fulfill({ json: { resourceBooks: books } })
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
    const simpleDetail = page.getByRole('dialog', { name: 'Matematik kitabım', exact: true })
    const assertSimpleDetail = async () => {
      await simpleDetail.getByText('Kitap kullanıma hazır', { exact: true }).waitFor()
      assert.equal(await simpleDetail.getByRole('button', { name: 'İçindekiler', exact: true }).count(), 0)
      assert.equal(await simpleDetail.getByRole('button', { name: 'Test Sonuçları', exact: true }).count(), 0)
      assert.equal(await simpleDetail.getByRole('button', { name: 'İçindekiler eklemeye başla', exact: true }).count(), 0)
      assert.ok(await simpleDetail.evaluate(el => el.scrollWidth <= el.clientWidth))
    }
    await assertSimpleDetail()
    await simpleDetail.getByRole('button', { name: 'Kapat', exact: true }).click()
    await page.reload()
    await page.getByRole('button', { name: /^Matematik 1 kaynak/ }).click()
    await page.getByRole('button', { name: 'Matematik kitabım', exact: true }).click()
    await assertSimpleDetail()
    await simpleDetail.getByRole('button', { name: 'Çalışma planına git', exact: true }).click()
    await page.waitForURL('**/parent/weekly-plan')
    await page.goto(`${base}/parent/bookshelf`)

    await page.getByRole('button', { name: 'Yeni Kitap Ekle', exact: true }).click()
    await dialog.getByRole('button', { name: 'Devam', exact: true }).click()
    await dialog.getByLabel('Kitap Adı', { exact: true }).fill('Test kitabım')
    await dialog.getByLabel('Ders', { exact: true }).selectOption('math')
    await dialog.getByLabel('Sınıf', { exact: true }).selectOption('8')
    await dialog.getByRole('button', { name: 'Devam', exact: true }).click()
    assert.equal(await dialog.getByLabel('Cevap Anahtarı Var', { exact: true }).count(), 0)
    assert.equal(await dialog.getByLabel('Kaynak Tipi', { exact: true }).evaluate(el => el.required && !el.checkValidity()), true)
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
    const structuredDetail = page.getByRole('dialog', { name: 'Test kitabım', exact: true })
    await structuredDetail.getByRole('button', { name: 'İçindekiler Ekle', exact: true }).waitFor()
    assert.equal(await structuredDetail.getByText('Kitap kullanıma hazır', { exact: true }).count(), 0)
    await structuredDetail.getByRole('button', { name: 'Kapat', exact: true }).click()
    for (const [type, expectedKey] of [['etkinlik', true], ['konu_anlatimi', false], ['okuma_kitabi', false]]) {
      await page.getByRole('button', { name: 'Yeni Kitap Ekle', exact: true }).click()
      await dialog.getByRole('button', { name: 'Devam', exact: true }).click()
      await dialog.getByLabel('Kitap Adı', { exact: true }).fill(`Kitap ${type}`)
      await dialog.getByLabel('Ders', { exact: true }).selectOption('math')
      await dialog.getByLabel('Sınıf', { exact: true }).selectOption('8')
      await dialog.getByRole('button', { name: 'Devam', exact: true }).click()
      await dialog.getByLabel('Yayın evi', { exact: true }).selectOption('publisher')
      const countBefore = saved.length
      await dialog.getByRole('button', { name: 'Kitabı Ekle', exact: true }).click()
      assert.equal(saved.length, countBefore)
      assert.equal(await dialog.getByLabel('Kaynak Tipi', { exact: true }).evaluate(el => el.validity.valueMissing), true)
      await dialog.getByLabel('Kaynak Tipi', { exact: true }).selectOption(type)
      assert.equal(await dialog.getByLabel('Cevap Anahtarı Var', { exact: true }).count(), 0)
      await dialog.getByRole('button', { name: 'Kitabı Ekle', exact: true }).click()
      await dialog.waitFor({ state: 'hidden' })
      assert.equal(saved.at(-1).hasAnswerKey, expectedKey)
      assert.equal(saved.at(-1).type, type)
      await page.getByRole('dialog', { name: `Kitap ${type}`, exact: true }).getByRole('button', { name: 'Kapat', exact: true }).click()
    }
    // Exercise the actual task drawer and completion flow with the newly created book.
    await page.evaluate(async (book) => {
      const { default: React } = await import('/node_modules/.vite/deps/react.js')
      const { default: { createRoot } } = await import('/node_modules/.vite/deps/react-dom_client.js')
      const { default: Drawer } = await import('/src/panels/parent/components/AddTaskDrawer.jsx')
      const host = document.createElement('div')
      document.body.appendChild(host)
      window.flowRoot = createRoot(host)
      window.flowRoot.render(React.createElement(Drawer, {
        initialTemplate: { task: { taskType: 'soru-bankasi-odevi', resourceBookId: book.id } },
        defaultDate: '2026-09-14', studentGrade: '8', onClose() {},
        onSave(payload) { window.savedTaskPayload = payload },
      }))
    }, books[0])
    const drawer = page.getByRole('dialog', { name: 'Yeni Görev Ekle' })
    await drawer.getByLabel('Görev açıklaması').fill('Sayfa 24–28, Test 3’ü çöz')
    await drawer.getByRole('button', { name: 'Görevi Ekle', exact: true }).click()
    await page.waitForFunction(() => Boolean(window.savedTaskPayload))
    const taskPayload = await page.evaluate(() => window.savedTaskPayload)
    assert.equal(taskPayload.resourceBookId, books[0].id)
    assert.deepEqual(taskPayload.selectedTestIds, [])
    assert.equal(taskPayload.description, 'Sayfa 24–28, Test 3’ü çöz')
    await page.evaluate(async (book) => {
      const { default: React } = await import('/node_modules/.vite/deps/react.js')
      const { default: Completion } = await import('/src/panels/parent/components/TaskCompletionFlow.jsx')
      window.flowRoot.render(React.createElement(Completion, {
        task: { ...window.savedTaskPayload, id: 'task-simple', resourceType: book.type, contentMode: book.contentMode },
        studentId: 'child-1', onClose() {}, onCompleted(task) { window.completedTask = task },
      }))
    }, books[0])
    await page.getByRole('heading', { name: 'Sonucu Gir', exact: true }).waitFor()
    await page.getByLabel('Doğru', { exact: true }).fill('8')
    await page.getByLabel('Yanlış', { exact: true }).fill('1')
    await page.getByLabel('Boş', { exact: true }).fill('1')
    await page.getByRole('button', { name: 'Tamamla', exact: true }).click()
    await page.waitForFunction(() => window.completedTask?.status === 'tamamlandi')
    assert.deepEqual(results, [{ correctCount: 8, wrongCount: 1, blankCount: 1, photos: [] }])
    assert.deepEqual(errors, [])
    console.log('PASS: mobile/desktop fit, both modes, preview, step validation, back navigation, preserved values, save/reopen details, plan navigation, task note and manual completion')
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exit(1) })
