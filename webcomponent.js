(function () { 
  // Template for the widget's shadow DOM
  const template = document.createElement('template');
  template.innerHTML = `
    <style>
      :host {
        display: block;
        font-family: "72", Arial, sans-serif;
        box-sizing: border-box;
        width: 100%;
        height: 100%;
      }
      .wrapper {
        display: flex;
        flex-direction: column;
        height: 100%;
        border: 1px solid #d9d9d9;
        border-radius: 6px;
        padding: 8px;
        box-sizing: border-box;
      }
      .label {
        font-size: 12px;
        color: #6a6d70;
        margin-bottom: 6px;
      }
      button {
        align-self: flex-start;
        background: #0a6ed1;
        color: white;
        border: none;
        border-radius: 4px;
        padding: 6px 12px;
        cursor: pointer;
        font-size: 13px;
      }
      button:disabled {
        background: #a6a6a6;
        cursor: default;
      }
      .insight {
        margin-top: 8px;
        font-size: 13px;
        line-height: 1.4;
        overflow-y: auto;
        flex: 1;
        white-space: pre-wrap;
      }
      .error {
        color: #b00;
        font-size: 12px;
        margin-top: 6px;
      }
    </style>
    <div class="wrapper">
      <div class="label"></div>
      <button type="button">קבל תובנה מ-Gemini</button>
      <div class="insight"></div>
      <div class="error"></div>
    </div>
  `;

  class GeminiInsightWidget extends HTMLElement {
    constructor() {
      super();
      this._shadowRoot = this.attachShadow({ mode: 'open' });
      this._shadowRoot.appendChild(template.content.cloneNode(true));
      this._middlewareUrl = '';
      this._contextLabel = '';
      this._dataJson = null;

      this._button = this._shadowRoot.querySelector('button');
      this._insightEl = this._shadowRoot.querySelector('.insight');
      this._errorEl = this._shadowRoot.querySelector('.error');
      this._labelEl = this._shadowRoot.querySelector('.label');

      this._button.addEventListener('click', () => this._requestInsight());
    }

    // ---- SAC property & Data Binding handlers ----
    onCustomWidgetBeforeUpdate(changedProps) {
      if ('middlewareUrl' in changedProps) {
        this._middlewareUrl = changedProps.middlewareUrl;
      }
      if ('contextLabel' in changedProps) {
        this._contextLabel = changedProps.contextLabel;
      }
    }

    onCustomWidgetAfterUpdate(changedProps) {
      if (this._labelEl) {
        this._labelEl.textContent = this._contextLabel || '';
      }

      // טיפול בקבלת נתונים אוטומטית מתוך המודל ב-SAC (Data Binding)
      if ('myDataBinding' in changedProps) {
        const dataBinding = changedProps['myDataBinding'];
        if (dataBinding && dataBinding.state === 'success' && dataBinding.data) {
          // שמירת הנתונים שהתקבלו ישירות מהמודל
          this._dataJson = JSON.stringify(dataBinding.data);
        }
      }
    }

    // ---- Script API methods exposed to SAC ----
    setMiddlewareUrl(url) {
      this._middlewareUrl = url;
    }

    setContextLabel(label) {
      this._contextLabel = label;
      if (this._labelEl) {
        this._labelEl.textContent = label;
      }
    }

    // מתודת גיבוי במידה ועדיין רוצים להעביר נתונים ידנית דרך סקריפט
    setData(dataJson) {
      this._dataJson = dataJson;
    }

    async _requestInsight() {
      this._errorEl.textContent = '';
      this._insightEl.textContent = '';

      if (!this._middlewareUrl) {
        this._errorEl.textContent = 'Middleware URL is not configured.';
        return;
      }

      this._button.disabled = true;
      this._button.textContent = 'טוען תובנה...';

      try {
        // המרת הנתונים לאובייקט במידה וקיימים
        let parsedData = null;
        if (typeof this._dataJson === 'string') {
          parsedData = JSON.parse(this._dataJson);
        } else if (typeof this._dataJson === 'object') {
          parsedData = this._dataJson;
        }

        const response = await fetch(this._middlewareUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            context: this._contextLabel,
            data: parsedData
          })
        });

        if (!response.ok) {
          throw new Error(`Middleware returned status ${response.status}`);
        }

        const result = await response.json();
        const text = result.insight || '(no insight returned)';
        this._insightEl.textContent = text;

        this.dispatchEvent(
          new CustomEvent('onInsightReceived', {
            detail: { insightText: text }
          })
        );
      } catch (err) {
        this._errorEl.textContent = 'שגיאה בקבלת תובנה: ' + err.message;
        this.dispatchEvent(
          new CustomEvent('onError', {
            detail: { message: err.message }
          })
        );
      } finally {
        this._button.disabled = false;
        this._button.textContent = 'קבל תובנה מ-Gemini';
      }
    }
  }

  customElements.define('com-example-gemini-insight-widget', GeminiInsightWidget);
})();
