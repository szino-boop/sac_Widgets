(function () {
  "use strict";

  const TEMPLATE = document.createElement("template");
  TEMPLATE.innerHTML = `
    <style>
      :host {
        display: block;
        width: 100%;
        height: 100%;
        font-family: "72", Arial, sans-serif;
        font-size: 13px;
        color: #1d2d3e;
        box-sizing: border-box;
        overflow: auto;
      }
      * { box-sizing: border-box; }
      .toolbar {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
      }
      .title {
        font-weight: 700;
        font-size: 14px;
        flex: 1;
      }
      input[type="text"] {
        border: 1px solid #d5dbe1;
        border-radius: 4px;
        padding: 4px 8px;
        font-size: 13px;
        width: 180px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      thead th {
        background: #f5f6f7;
        border-bottom: 1px solid #d5dbe1;
        padding: 6px 8px;
        cursor: pointer;
        user-select: none;
        white-space: nowrap;
      }
      thead th:hover {
        background: #eef1f4;
      }
      tbody td {
        border-bottom: 1px solid #eceff1;
        padding: 6px 8px;
      }
      tbody tr:hover {
        background: #f5f9ff;
      }
      tbody tr.selected {
        background: #e1eeff;
      }
      .num {
        direction: ltr;
        unicode-bidi: plaintext;
      }
      .badge {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 999px;
        font-size: 12px;
      }
      .badge-success { background: #e5f5e0; color: #0e6027; }
      .badge-accent  { background: #e6f1fb; color: #0c447c; }
      .badge-danger  { background: #fcebeb; color: #791f1f; }
      .sort-icon { font-size: 10px; opacity: 0.6; }
    </style>
    <div class="toolbar">
      <span class="title"></span>
      <input type="text" class="search" placeholder="חיפוש" />
    </div>
    <table>
      <thead><tr class="head-row"></tr></thead>
      <tbody></tbody>
    </table>
  `;

  const STATUS_CLASS = {
    "מעל יעד": "badge-success",
    "על יעד": "badge-accent",
    "מתחת ליעד": "badge-danger"
  };

  const FALLBACK_COLUMNS = [
    { key: "product", label: "מוצר", type: "dimension" },
    { key: "region", label: "אזור", type: "dimension" },
    { key: "qty", label: "כמות", type: "measure" },
    { key: "revenue", label: "הכנסה (₪)", type: "measure" },
    { key: "status", label: "סטטוס", type: "dimension" }
  ];

  const FALLBACK_ROWS = [
    { product: "מחשב נייד Pro 14", region: "מרכז", qty: 42, revenue: 151200, status: "מעל יעד" },
    { product: "טלפון חכם X2", region: "צפון", qty: 88, revenue: 246400, status: "על יעד" },
    { product: "אוזניות אלחוטיות", region: "דרום", qty: 130, revenue: 39000, status: "מתחת ליעד" }
  ];

  class RtlTableWidget extends HTMLElement {
    constructor() {
      super();
      this._shadow = this.attachShadow({ mode: "open" });
      this._shadow.appendChild(TEMPLATE.content.cloneNode(true));

      this._props = {
        title: "טבלה",
        textDirection: "rtl",
        showStatusBadges: true,
        enableSelection: true,
        enableSearch: true
      };

      this._columns = FALLBACK_COLUMNS;
      this._rows = FALLBACK_ROWS;
      this._sortKey = null;
      this._sortDir = 1;
      this._query = "";
      this._selected = new Set();

      this._els = {
        title: this._shadow.querySelector(".title"),
        search: this._shadow.querySelector(".search"),
        headRow: this._shadow.querySelector(".head-row"),
        tbody: this._shadow.querySelector("tbody")
      };

      this._els.search.addEventListener("input", (e) => {
        this._query = e.target.value;
        this._render();
      });
    }

    connectedCallback() {
      this.style.direction = this._props.textDirection;
      this._render();
    }

    static get observedAttributes() {
      return [];
    }

    get title() { return this._props.title; }
    set title(v) {
      this._props.title = v;
      this._render();
    }

    get textDirection() { return this._props.textDirection; }
    set textDirection(v) {
      this._props.textDirection = v === "ltr" ? "ltr" : "rtl";
      this.style.direction = this._props.textDirection;
      this._render();
    }

    get showStatusBadges() { return this._props.showStatusBadges; }
    set showStatusBadges(v) {
      this._props.showStatusBadges = !!v;
      this._render();
    }

    get enableSelection() { return this._props.enableSelection; }
    set enableSelection(v) {
      this._props.enableSelection = !!v;
      this._render();
    }

    get enableSearch() { return this._props.enableSearch; }
    set enableSearch(v) {
      this._props.enableSearch = !!v;
      this._els.search.style.display = v ? "" : "none";
    }

    getSelectedKeys() {
      return Array.from(this._selected);
    }

    clearSelection() {
      this._selected.clear();
      this._render();
      this._fireSelectEvent();
    }

    refresh() {
      this._loadFromDataBinding();
      this._render();
    }

    onCustomWidgetBeforeUpdate(changedProperties) {
      Object.keys(changedProperties || {}).forEach((key) => {
        this._props[key] = changedProperties[key];
      });
    }

    onCustomWidgetAfterUpdate(changedProperties) {
      if (changedProperties && changedProperties.dataBinding) {
        this._loadFromDataBinding();
      }
      this.style.direction = this._props.textDirection;
      this._render();
    }

    onCustomWidgetDestroy() {
      this._selected.clear();
    }

    onCustomWidgetResize(width, height) {
      this.style.width = width + "px";
      this.style.height = height + "px";
    }

    _loadFromDataBinding() {
      try {
        if (!this.dataBindings) return;
        const binding = this.dataBindings.getDataBinding("myDataBinding");
        if (!binding || !binding.data) return;

        const dims = binding.dimensions || [];
        const meas = binding.measures || [];

        this._columns = []
          .concat(dims.map((d) => ({ key: d.key, label: d.description || d.id, type: "dimension" })))
          .concat(meas.map((m) => ({ key: m.key, label: m.description || m.id, type: "measure" })));

        this._rows = binding.data.map((row) => {
          const record = {};
          dims.forEach((d) => { record[d.key] = row[d.key] ? row[d.key].label : ""; });
          meas.forEach((m) => { record[m.key] = row[m.key] ? row[m.key].raw : 0; });
          return record;
        });
      } catch (err) {
        console.error("rtl-table-widget: failed to read data binding, keeping current data", err);
      }
    }

    _rowKey(row) {
      return this._columns.map((c) => row[c.key]).join("|");
    }

    _toggleSelect(key) {
      if (this._selected.has(key)) {
        this._selected.delete(key);
      } else {
        this._selected.add(key);
      }
      this._render();
      this._fireSelectEvent();
    }

    _fireSelectEvent() {
      this.dispatchEvent(new CustomEvent("onRowSelect", {
        detail: { selected: Array.from(this._selected) }
      }));
    }

    _fireSortEvent() {
      this.dispatchEvent(new CustomEvent("onSort", {
        detail: { key: this._sortKey, direction: this._sortDir }
      }));
    }

    _formatValue(col, value) {
      if (col.type === "measure" && typeof value === "number") {
        return value.toLocaleString("he-IL");
      }
      return value;
    }

    _render() {
      this._els.title.textContent = this._props.title;
      this._els.search.style.display = this._props.enableSearch ? "" : "none";

      let rows = this._rows;
      if (this._query) {
        const firstDim = this._columns.find((c) => c.type === "dimension");
        if (firstDim) {
          rows = rows.filter((r) =>
            String(r[firstDim.key]).indexOf(this._query) !== -1
          );
        }
      }

      if (this._sortKey) {
        const key = this._sortKey;
        const dir = this._sortDir;
        rows = rows.slice().sort((a, b) => {
          const av = a[key];
          const bv = b[key];
          if (typeof av === "number") return (av - bv) * dir;
          return String(av).localeCompare(String(bv), "he") * dir;
        });
      }

      this._els.headRow.innerHTML = "";
      if (this._props.enableSelection) {
        const th = document.createElement("th");
        th.style.width = "28px";
        this._els.headRow.appendChild(th);
      }
      this._columns.forEach((col) => {
        const th = document.createElement("th");
        th.textContent = col.label + " ";
        if (this._sortKey === col.key) {
          const icon = document.createElement("span");
          icon.className = "sort-icon";
          icon.textContent = this._sortDir === 1 ? "▲" : "▼";
          th.appendChild(icon);
        }
        th.addEventListener("click", () => {
          if (this._sortKey === col.key) {
            this._sortDir *= -1;
          } else {
            this._sortKey = col.key;
            this._sortDir = 1;
          }
          this._fireSortEvent();
          this._render();
        });
        this._els.headRow.appendChild(th);
      });

      this._els.tbody.innerHTML = "";
      rows.forEach((row) => {
        const key = this._rowKey(row);
        const tr = document.createElement("tr");
        if (this._selected.has(key)) tr.className = "selected";

        if (this._props.enableSelection) {
          const td = document.createElement("td");
          const cb = document.createElement("input");
          cb.type = "checkbox";
          cb.checked = this._selected.has(key);
          cb.addEventListener("change", () => this._toggleSelect(key));
          td.appendChild(cb);
          tr.appendChild(td);
        }

        this._columns.forEach((col) => {
          const td = document.createElement("td");
          if (col.type === "measure") td.classList.add("num");
          if (col.key === "status" && this._props.showStatusBadges && STATUS_CLASS[row[col.key]]) {
            const span = document.createElement("span");
            span.className = "badge " + STATUS_CLASS[row[col.key]];
            span.textContent = row[col.key];
            td.appendChild(span);
          } else {
            td.textContent = this._formatValue(col, row[col.key]);
          }
          tr.appendChild(td);
        });

        tr.addEventListener("click", (e) => {
          if (e.target.tagName === "INPUT") return;
          if (this._props.enableSelection) this._toggleSelect(key);
        });

        this._els.tbody.appendChild(tr);
      });
    }
  }

  customElements.define("rtl-table-widget", RtlTableWidget);
})();
