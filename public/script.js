	/**
	 * @param {HTMLTableElement} table
	 */
function datalayerDebugger(table) {
	const datapath = new Set(Array.from(table.querySelectorAll('[data-datapath]'), it => it.dataset.datapath));
	console.log('datapath', datapath);

	for (const input of table.querySelectorAll('input')) {
		const master = input.closest('[data-datapath]');
		const cell = master.querySelector('td.datalayer__expand');
		const datapath = master.dataset.datapath;
		input.addEventListener("change", () => {
			console.log(input.checked, datapath);
			const rows = table.querySelectorAll(`[data-datapath="${datapath}"].indent`);
			if (input.checked) {
				cell.setAttribute("rowspan", String(rows.length + 1));
			} else {
				cell.removeAttribute("rowspan");
			}
			for (const row of rows) {
				console.log('row', row);
				row.classList.toggle("hidden", !input.checked);
			}
		});
	}
}


const element = document.querySelector("#debugger .datalayer");
if (element) {
	datalayerDebugger(element);
}
