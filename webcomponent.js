(function () {
  const template = document.createElement('template');
  template.innerHTML = `
    <style>
      :host {
        display: block;
        font-family: var(--sapFontFamily, Arial, sans-serif);
        padding: 12px;
        box-sizing: border-box;
      }
      .container {
        border: 1px solid #ccc;
        border-radius: 8px;
        padding: 16px;
        background: #ffffff;
      }
      button {
        background-color: #0a6ed1;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
        font-weight: bold;
      }
      button:disabled {
        background-color: #a8b5c2;
      }
      .insight-box {
        margin-top: 12px;
        white-space: pre-wrap;
        line-height: 1.5;
        color: #333;
      }
      .error {
        color: #b00;
        margin-top: 8px;
        font-weight: bold;
      }
    </style>
    <div class="container">
      <button id="btn">קבל תובנה מ-Gemini</button>
      <div id="error" class="error"></div>
      <div id="insight" class="insight-box"></div>
    </div>
  `;

  class GeminiInsightWidget extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this.shadowRoot.appendChild(template.content.cloneNode(true));

      this._button = this.shadowRoot.getElementById('btn');
      this._errorEl = this.shadowRoot.getElementById('error');
      this._insightEl = this.shadowRoot.getElementById('insight');

      this._middlewareUrl = 'https://viewing-gag-swear.ngrok-free.dev/api/insight';
      this._contextLabel = 'ניתוח נתוני מודל';
      this._dataJson = null;

      this._button.addEventListener('click', () => this._requestInsight());
    }

    onCustomWidgetAfterUpdate(changedProperties) {
      if (changedProperties.myDataBinding) {
        const dataBinding = changedProperties.myDataBinding;
        if (dataBinding && dataBinding.data) {
          this._dataJson = dataBinding.data;
        }
      }
    }

    setMiddlewareUrl(url) {
      this._middlewareUrl = url;
    }

    setContextLabel(label) {
      this._contextLabel = label;
    }

    async _requestInsight() {
      this._errorEl.textContent = '';
      this._insightEl.textContent = '';

      if (!this._dataJson || (Array.isArray(this._dataJson) && this._dataJson.length === 0)) {
        this._errorEl.textContent = 'לא התקבלו נתונים מהמודל. ודא שהממדים והמדדים מוגדרים ב-Builder.';
        return;
      }

      this._button.disabled = true;
      this._button.textContent = 'מחשב תובנה...';

      try {
        const response = await fetch(this._middlewareUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            context: this._contextLabel,
            data: this._dataJson
          })
        });

        if (!response.ok) {
          const errRes = await response.json().catch(() => ({}));
          throw new Error(errRes.error || `Server error ${response.status}`);
        }

        const result = await response.json();
        this._insightEl.textContent = result.insight || 'לא התקבלה תובנה.';
      } catch (err) {
        this._errorEl.textContent = 'שגיאה: ' + err.message;
      } finally {
        this._button.disabled = false;
        this._button.textContent = 'קבל תובנה מ-Gemini';
      }
    }
  }

  customElements.define('com-example-gemini-insight-widget', GeminiInsightWidget);
})();
