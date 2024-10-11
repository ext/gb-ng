import { Signal } from "signal-polyfill";
import { effect } from "./effect.js";

class Datalayer extends EventTarget {
  values = new Map();
  models = new Set();

  ref(datapath, model) {
    if (this.values.has(datapath)) {
      return this.values.get(datapath).signal;
    } else {
      const signal = new Signal.State(undefined);
      const datum = { datapath, signal };
      this.values.set(datapath, datum);
      if (!model) {
        this.dispatchEvent(
          new CustomEvent("datalayer:register", {
            detail: { datapath, signal },
          }),
        );
      }
      return signal;
    }
  }

  createModel(key, datapaths) {
    if (this.models.has(key)) {
      return;
    }
    this.models.add(key);

    this.dispatchEvent(new CustomEvent("datalayer:model", { detail: { key, datapaths } }));
  }

  entries() {
    return this.values.entries();
  }

  isModel(datapath) {
    return this.models.has(datapath);
  }
}

/**
 * @param {HTMLTableElement} table
 */
function datalayerDebugger(datalayer, table) {
  const tbody = table.querySelector("tbody");

  function addModel(datapath) {
    const row = document.createElement("tr");
    row.setAttribute("data-datapath", datapath);
    row.innerHTML = /* HTML */ `
      <td class="datalayer__expand"><input type="checkbox" /></td>
      <td class="datalayer__datapath">${datapath}</td>
      <td class="datalayer__datatype">Model</td>
      <td class="datalayer__datapath">r-</td>
      <td class="datalayer__value">-</td>
    `;
    const input = row.querySelector("input");
    const cell = row.querySelector(".datalayer__expand");
    input.addEventListener("change", () => {
      const rows = table.querySelectorAll(`[data-datapath="${datapath}"].indent`);
      if (input.checked) {
        cell.setAttribute("rowspan", String(rows.length + 1));
      } else {
        cell.removeAttribute("rowspan");
      }
      for (const row of rows) {
        row.classList.toggle("hidden", !input.checked);
      }
    });
    const ref = datalayer.ref(`${datapath}:value`);
    const typecell = row.querySelector(".datalayer__datatype");
    const valuecell = row.querySelector(".datalayer__value");
    effect(() => {
      typecell.textContent = `Model (${typeof ref.get()})`;
      valuecell.textContent = JSON.stringify(ref.get());
      valuecell.animate([{ backgroundColor: "yellow" }, { backgroundColor: "yellow", offset: 0.5 }, { backgroundColor: "transparent" }], {
        duration: 500,
      });
    });
    tbody.append(row);
  }

  function addKey(datapath, ref, model) {
    const row = document.createElement("tr");
    if (model) {
      row.setAttribute("data-datapath", datapath.replace(/:.*/, ""));
      row.classList.add("indent");
      row.classList.add("hidden");
    } else {
      row.setAttribute("data-datapath", datapath);
    }
    row.innerHTML = /* HTML */ `
      ${model ? "" : '<td class="datalayer__expand"></td>'}
      <td class="datalayer__datapath">${datapath}</td>
      <td class="datalayer__datatype"></td>
      <td class="datalayer__datapath">rw</td>
      <td class="datalayer__value"></td>
    `;
    const typecell = row.querySelector(".datalayer__datatype");
    const valuecell = row.querySelector(".datalayer__value");
    effect(() => {
      typecell.textContent = typeof ref.get();
      valuecell.textContent = JSON.stringify(ref.get());
      valuecell.animate([{ backgroundColor: "yellow" }, { backgroundColor: "yellow", offset: 0.5 }, { backgroundColor: "transparent" }], {
        duration: 500,
      });
    });
    tbody.append(row);
  }

  for (const [datapath, signal] of datalayer.entries()) {
    addRow(datapath, signal);
  }

  datalayer.addEventListener("datalayer:model", (event) => {
    const { key, datapaths } = event.detail;
    addModel(key);
    for (const datapath of datapaths) {
      const signal = datalayer.ref(datapath);
      addKey(datapath, signal, true);
    }
  });

  datalayer.addEventListener("datalayer:register", (event) => {
    const { datapath, signal } = event.detail;
    addKey(datapath, signal, false);
  });
}

function textParser(value) {
  return value;
}

function numberParser(value) {
  return parseInt(value, 10);
}

const datalayer = new Datalayer();

{
  const element = document.querySelector("#debugger .datalayer");
  if (element) {
    datalayerDebugger(datalayer, element);
  }
}

/* text fields */
{
  const elements = document.querySelectorAll("input[type=text][data-datapath], input[type=number][data-datapath]");
  for (const element of elements) {
    const datapath = element.dataset.datapath;
    const type = element.getAttribute("type");
    const parser = type === "number" ? numberParser : textParser;
    const value = datalayer.ref(`${datapath}:value`, true);
    const valid = datalayer.ref(`${datapath}:valid`, true);
    const enabled = datalayer.ref(`${datapath}:enabled`, true);
    datalayer.createModel(datapath, [`${datapath}:value`, `${datapath}:valid`, `${datapath}:enabled`]);
    value.set(parser(element.value));
    valid.set(element.value !== "");
    enabled.set(true);
    element.addEventListener("change", () => {
      value.set(parser(element.value));
      valid.set(element.value !== "");
      enabled.set(true);
    });
  }
}

/* radio fields */
{
  const elements = document.querySelectorAll("input[type=radio][data-datapath]");
  for (const element of elements) {
    const datapath = element.dataset.datapath;
    const value = datalayer.ref(`${datapath}:value`, true);
    const valid = datalayer.ref(`${datapath}:valid`, true);
    const enabled = datalayer.ref(`${datapath}:enabled`, true);
    datalayer.createModel(datapath, [`${datapath}:value`, `${datapath}:valid`, `${datapath}:enabled`]);
    value.set(undefined);
    valid.set(false);
    enabled.set(true);
    element.addEventListener("change", () => {
      value.set(element.value !== "0");
      valid.set(true);
      enabled.set(true);
    });
  }
}

/* conditions */
{
  function evalulateCondition(condition) {
    if (!condition) {
      return true;
    }
    function unsafeHack(scope, script) {
      const source = [`"use strict";`, `const { value, enabled, valid } = this;`, `return ${script}`].join("\n");
      return Function(source).bind(scope)();
    }
    const scope = {
      value(datapath) {
        const isModel = datalayer.isModel(datapath);
        if (isModel) {
          const enabled = datalayer.ref(`${datapath}:enabled`).get();
          const value = datalayer.ref(`${datapath}:value`).get();
          return enabled ? value : undefined;
        } else {
          return datalayer.ref(datapath).get();
        }
      },
      enabled(datapath) {
        return datalayer.ref(`${datapath}:enabled`).get();
      },
      valid(datapath) {
        return datalayer.ref(`${datapath}:valid`).get();
      },
    };
    return unsafeHack(scope, condition);
  }

  const elements = document.querySelectorAll(".input-field, .radio-field, .messagebox");
  for (const element of elements) {
    const condition = element.dataset.condition;
    let state = element.hidden;
    Object.defineProperty(element, "hidden2", {
      get() {
        return state;
      },
      set(value) {
        effect(() => {
          state = value;
          element.hidden = state || !evalulateCondition(condition);
        });
      },
    });

    /* set up recursive dependencies */
    for (const child of element.querySelectorAll("[data-datapath]")) {
      effect(() => {
        const datapath = `${child.dataset.datapath}:enabled`;
        const result = evalulateCondition(condition);
        datalayer.ref(datapath).set(result);
      });
    }
  }
}

setTimeout(() => {
  const loader = document.querySelectorAll(".loader, .loader-text");
  for (const element of loader) {
    element.remove();
  }

  const fields = document.querySelectorAll(".input-field, .radio-field, .messagebox");
  for (const field of fields) {
    field.hidden2 = false;
  }

  const buttons = document.querySelectorAll("button");
  for (const button of buttons) {
    button.hidden = false;
  }

  /* simulate mapping of REST -> datalayer mapping */
  const rest = datalayer.ref("rest.something");
  rest.set("lorem ipsum");

  /* simulate component setup() which would read initial value */
  const value = datalayer.ref("foo:value");
  document.querySelector("#input1").value = rest.get();
  value.set(rest.get());
}, 1000);

function onSubmit(event) {
  event.preventDefault();

  /* simulate mapping of fields for REST */
  const model = {
    name: datalayer.ref("foo:value").get(),
    amount: datalayer.ref("bar:value").get(),
  };

  alert(`POST /api/submit ${JSON.stringify(model)}`);
}

window.onSubmit = onSubmit;
