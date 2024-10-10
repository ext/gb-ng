import { Signal } from "signal-polyfill";
import { effect } from "./effect.js";

class Datalayer extends EventTarget {
  values = new Map();

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
    this.dispatchEvent(
      new CustomEvent("datalayer:model", { detail: { key, datapaths } }),
    );
  }

  entries() {
    return this.values.entries();
  }
}

/**
 * @param {HTMLTableElement} table
 */
function datalayerDebugger(datalayer, table) {
  const tbody = table.querySelector("tbody");

  const datapath = new Set(
    Array.from(
      table.querySelectorAll("[data-datapath]"),
      (it) => it.dataset.datapath,
    ),
  );

  for (const input of table.querySelectorAll("input")) {
  }

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
      console.log(input.checked, datapath);
      const rows = table.querySelectorAll(
        `[data-datapath="${datapath}"].indent`,
      );
      console.log("rows", rows);
      if (input.checked) {
        cell.setAttribute("rowspan", String(rows.length + 1));
      } else {
        cell.removeAttribute("rowspan");
      }
      for (const row of rows) {
        console.log("row", row);
        row.classList.toggle("hidden", !input.checked);
      }
    });
    const ref = datalayer.ref(`${datapath}:value`);
    const typecell = row.querySelector(".datalayer__datatype");
    const valuecell = row.querySelector(".datalayer__value");
    effect(() => {
      typecell.textContent = `Model (${typeof ref.get()})`;
      valuecell.textContent = JSON.stringify(ref.get());
      valuecell.animate(
        [
	        { backgroundColor: "yellow" },
	        { backgroundColor: "yellow", offset: 0.5 },
	        { backgroundColor: "transparent" },
        ],
        {
          duration: 500,
        },
      );
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
      valuecell.animate(
        [
	        { backgroundColor: "yellow" },
	        { backgroundColor: "yellow", offset: 0.5 },
	        { backgroundColor: "transparent" },
        ],
        {
          duration: 500,
        },
      );
    });
    tbody.append(row);
  }

  for (const [datapath, signal] of datalayer.entries()) {
    console.log("initial", datapath, signal);
    addRow(datapath, signal);
  }

  datalayer.addEventListener("datalayer:model", (event) => {
    const { key, datapaths } = event.detail;
    console.log("model", key, datapaths);
    addModel(key);
    for (const datapath of datapaths) {
      const signal = datalayer.ref(datapath);
      addKey(datapath, signal, true);
    }
  });

  datalayer.addEventListener("datalayer:register", (event) => {
    const { datapath, signal } = event.detail;
    console.log("register", datapath);
    addKey(datapath, signal, false);
  });
}

const datalayer = new Datalayer();

{
  const element = document.querySelector("#debugger .datalayer");
  if (element) {
    datalayerDebugger(datalayer, element);
  }
}

{
  const elements = document.querySelectorAll("input[type=text][data-datapath]");
  for (const element of elements) {
    const datapath = element.dataset.datapath;
    console.log(element, datapath);
    const value = datalayer.ref(`${datapath}:value`, true);
    const valid = datalayer.ref(`${datapath}:valid`, true);
    const enabled = datalayer.ref(`${datapath}:enabled`, true);
    datalayer.createModel(datapath, [
      `${datapath}:value`,
      `${datapath}:valid`,
      `${datapath}:enabled`,
    ]);
    value.set(element.value);
    valid.set(element.value !== "");
    enabled.set(true);
    element.addEventListener("change", () => {
      value.set(element.value);
      valid.set(element.value !== "");
      enabled.set(true);
    });
  }
}
