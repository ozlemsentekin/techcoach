// iyzico abonelik checkout formu, <script> etiketleriyle birlikte HTML string olarak döner.
// innerHTML ile eklenen <script>'lar çalışmadığı için elle yeniden oluşturup ekliyoruz.
export function injectCheckoutFormContent(container, html) {
  container.innerHTML = ''
  const template = document.createElement('template')
  template.innerHTML = html

  Array.from(template.content.childNodes).forEach((node) => {
    if (node.tagName === 'SCRIPT') {
      const script = document.createElement('script')
      Array.from(node.attributes).forEach((attr) => script.setAttribute(attr.name, attr.value))
      script.textContent = node.textContent
      container.appendChild(script)
    } else {
      container.appendChild(node.cloneNode(true))
    }
  })
}
