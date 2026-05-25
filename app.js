let priceColumns = [];
let items = [];
let logoData = "";
let isRestoring = false;

const AUTO_SAVE_KEY = "professional_invoice_autosave";
const INVOICE_COUNTER_KEY = "professional_invoice_counter";

window.onload = function () {
    const restored = restoreAutoSave();

    if (!restored) {
        document.getElementById("invoiceDate").valueAsDate = new Date();
        document.getElementById("invoiceNumber").value = generateInvoiceNumber();
    }

    renderInputTable();
    updateInvoice();
};

function escapeHTML(value) {
    return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function hexToRgb(hex) {
    hex = hex.replace("#", "");
    return [
        parseInt(hex.substring(0, 2), 16),
        parseInt(hex.substring(2, 4), 16),
        parseInt(hex.substring(4, 6), 16)
    ];
}

function generateInvoiceNumber() {
    const year = new Date().getFullYear();
    let counter = parseInt(localStorage.getItem(INVOICE_COUNTER_KEY) || "1");
    return "INV-" + year + "-" + String(counter).padStart(4, "0");
}

function increaseInvoiceCounter() {
    let counter = parseInt(localStorage.getItem(INVOICE_COUNTER_KEY) || "1");
    localStorage.setItem(INVOICE_COUNTER_KEY, counter + 1);
}

function loadLogo(event) {
    const file = event.target.files[0];

    if (!file) {
        logoData = "";
        updateInvoice();
        return;
    }

    const reader = new FileReader();

    reader.onload = function (e) {
        logoData = e.target.result;
        updateInvoice();
    };

    reader.readAsDataURL(file);
}

function addItemRow() {
    if (priceColumns.length === 0) {
        alert("Please add at least one price column first.");
        return;
    }

    let newPrices = {};

    priceColumns.forEach(column => {
        newPrices[column] = 0;
    });

    items.push({
        name: "",
        prices: newPrices,
        discountType: "none",
        discountValue: 0
    });

    renderInputTable();
    updateInvoice();
}

function duplicateItemRow(index) {
    const copiedItem = JSON.parse(JSON.stringify(items[index]));
    copiedItem.name = copiedItem.name + " Copy";

    items.splice(index + 1, 0, copiedItem);

    renderInputTable();
    updateInvoice();
}

function removeItemRow(index) {
    items.splice(index, 1);
    renderInputTable();
    updateInvoice();
}

function addPriceColumn() {
    let columnName = prompt("Enter price column name. Example: Item Price, Packing, Delivery, Tax, Service Charge");

    if (!columnName) return;

    columnName = columnName.trim();

    if (columnName === "") return;

    if (priceColumns.includes(columnName)) {
        alert("This column already exists.");
        return;
    }

    priceColumns.push(columnName);

    items.forEach(item => {
        item.prices[columnName] = 0;
    });

    renderInputTable();
    updateInvoice();
}

function removePriceColumn(columnName) {
    if (!confirm("Remove column: " + columnName + "?")) return;

    priceColumns = priceColumns.filter(column => column !== columnName);

    items.forEach(item => {
        delete item.prices[columnName];
    });

    renderInputTable();
    updateInvoice();
}

function updateItemName(index, value) {
    items[index].name = value;
    updateInvoice();
}

function updateItemPrice(index, columnName, value) {
    items[index].prices[columnName] = parseFloat(value) || 0;
    updateInputRowTotal(index);
    updateInvoice();
}

function updateItemDiscountType(index, value) {
    items[index].discountType = value;
    updateInputRowTotal(index);
    updateInvoice();
}

function updateItemDiscountValue(index, value) {
    items[index].discountValue = parseFloat(value) || 0;
    updateInputRowTotal(index);
    updateInvoice();
}

function calculateRowSubtotal(item) {
    let total = 0;

    priceColumns.forEach(column => {
        total += parseFloat(item.prices[column]) || 0;
    });

    return total;
}

function calculateItemDiscount(item) {
    const subtotal = calculateRowSubtotal(item);
    const discountValue = parseFloat(item.discountValue) || 0;

    if (item.discountType === "amount") {
        return Math.min(discountValue, subtotal);
    }

    if (item.discountType === "percent") {
        return Math.min((subtotal * discountValue) / 100, subtotal);
    }

    return 0;
}

function calculateRowTotal(item) {
    return calculateRowSubtotal(item) - calculateItemDiscount(item);
}

function calculateSubtotalBeforeDiscount() {
    let total = 0;

    items.forEach(item => {
        total += calculateRowSubtotal(item);
    });

    return total;
}

function calculateItemDiscountTotal() {
    let total = 0;

    items.forEach(item => {
        total += calculateItemDiscount(item);
    });

    return total;
}

function calculateAfterItemDiscountTotal() {
    let total = 0;

    items.forEach(item => {
        total += calculateRowTotal(item);
    });

    return total;
}

function calculateInvoiceDiscount() {
    const type = document.getElementById("invoiceDiscountType").value;
    const value = parseFloat(document.getElementById("invoiceDiscountValue").value) || 0;
    const totalAfterItemDiscount = calculateAfterItemDiscountTotal();

    if (type === "amount") {
        return Math.min(value, totalAfterItemDiscount);
    }

    if (type === "percent") {
        return Math.min((totalAfterItemDiscount * value) / 100, totalAfterItemDiscount);
    }

    return 0;
}

function calculateGrandTotal() {
    return calculateAfterItemDiscountTotal() - calculateInvoiceDiscount();
}

function calculateColumnTotal(columnName) {
    let total = 0;

    items.forEach(item => {
        total += parseFloat(item.prices[columnName]) || 0;
    });

    return total;
}

function hasAnyItemDiscount() {
    return items.some(item => calculateItemDiscount(item) > 0);
}

function getCurrency() {
    return document.getElementById("currency").value || "Rs.";
}

function formatMoney(amount) {
    return getCurrency() + " " + Number(amount || 0).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function updateInputRowTotal(index) {
    const cell = document.getElementById("inputRowTotal_" + index);

    if (cell && items[index]) {
        cell.innerText = formatMoney(calculateRowTotal(items[index]));
    }
}

function renderInputTable() {
    const head = document.getElementById("inputTableHead");
    const body = document.getElementById("inputTableBody");

    if (priceColumns.length === 0) {
        head.innerHTML = "";
        body.innerHTML = `
                <tr>
                    <td class="text-center text-slate-500 py-8 border border-slate-200">
                        No price columns added yet. Click <strong>Add Column</strong> to start.
                    </td>
                </tr>
            `;
        return;
    }

    let headHTML = `
            <tr>
                <th class="border border-slate-200 px-3 py-3 text-left min-w-[240px]">Item Name</th>
        `;

    priceColumns.forEach(column => {
        headHTML += `
                <th class="border border-slate-200 px-3 py-3 text-left min-w-[150px]">
                    <div class="flex items-center justify-between gap-2">
                        <span>${escapeHTML(column)}</span>
                        <button onclick='removePriceColumn(${JSON.stringify(column)})'
                                class="text-red-600 text-xs hover:underline">
                            Remove
                        </button>
                    </div>
                </th>
            `;
    });

    headHTML += `
                <th class="border border-slate-200 px-3 py-3 text-left min-w-[150px]">Discount Type</th>
                <th class="border border-slate-200 px-3 py-3 text-left min-w-[130px]">Discount</th>
                <th class="border border-slate-200 px-3 py-3 text-left min-w-[150px]">Row Total</th>
                <th class="border border-slate-200 px-3 py-3 text-center min-w-[180px]">Action</th>
            </tr>
        `;

    head.innerHTML = headHTML;

    if (items.length === 0) {
        body.innerHTML = `
                <tr>
                    <td colspan="${priceColumns.length + 5}" class="text-center text-slate-500 py-8 border border-slate-200">
                        No items added yet. Click <strong>Add Item</strong> to add invoice items.
                    </td>
                </tr>
            `;
        return;
    }

    let bodyHTML = "";

    items.forEach((item, index) => {
        bodyHTML += `
                <tr>
                    <td class="border border-slate-200 px-3 py-2">
                        <input type="text"
                               value="${escapeHTML(item.name)}"
                               placeholder="Enter item name"
                               class="w-full border border-slate-300 rounded px-2 py-1 focus:border-blue-900"
                               oninput="updateItemName(${index}, this.value)">
                    </td>
            `;

        priceColumns.forEach(column => {
            let value = item.prices[column] || "";

            bodyHTML += `
                    <td class="border border-slate-200 px-3 py-2">
                        <input type="number"
                               value="${value}"
                               min="0"
                               placeholder="0"
                               class="w-full border border-slate-300 rounded px-2 py-1 focus:border-blue-900"
                               oninput='updateItemPrice(${index}, ${JSON.stringify(column)}, this.value)'>
                    </td>
                `;
        });

        bodyHTML += `
                    <td class="border border-slate-200 px-3 py-2">
                        <select class="w-full border border-slate-300 rounded px-2 py-1 focus:border-blue-900"
                                onchange="updateItemDiscountType(${index}, this.value)">
                            <option value="none" ${item.discountType === "none" ? "selected" : ""}>No Discount</option>
                            <option value="amount" ${item.discountType === "amount" ? "selected" : ""}>Amount</option>
                            <option value="percent" ${item.discountType === "percent" ? "selected" : ""}>Percentage</option>
                        </select>
                    </td>

                    <td class="border border-slate-200 px-3 py-2">
                        <input type="number"
                               value="${item.discountValue || ""}"
                               min="0"
                               placeholder="0"
                               class="w-full border border-slate-300 rounded px-2 py-1 focus:border-blue-900"
                               oninput="updateItemDiscountValue(${index}, this.value)">
                    </td>

                    <td id="inputRowTotal_${index}" class="border border-slate-200 px-3 py-2 font-semibold">
                        ${formatMoney(calculateRowTotal(item))}
                    </td>

                    <td class="border border-slate-200 px-3 py-2 text-center">
                        <button onclick="duplicateItemRow(${index})"
                                class="bg-slate-700 hover:bg-slate-800 text-white px-3 py-1 rounded text-xs">
                            Duplicate
                        </button>

                        <button onclick="removeItemRow(${index})"
                                class="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-xs ml-1">
                            Delete
                        </button>
                    </td>
                </tr>
            `;
    });

    body.innerHTML = bodyHTML;
}

function updateInvoice() {
    applyThemeToPreview();

    const businessName = document.getElementById("businessName").value || "Your Business Name";
    const businessPhone = document.getElementById("businessPhone").value;
    const businessEmail = document.getElementById("businessEmail").value;
    const businessAddress = document.getElementById("businessAddress").value || "Business address";

    document.getElementById("previewBusinessName").innerText = businessName;
    document.getElementById("previewBusinessAddress").innerText = businessAddress;
    document.getElementById("previewBusinessPhone").innerText = businessPhone ? "Phone: " + businessPhone : "";
    document.getElementById("previewBusinessEmail").innerText = businessEmail ? "Email: " + businessEmail : "";

    updateLogoPosition();

    const logo = document.getElementById("previewLogo");

    if (logoData) {
        logo.src = logoData;
        logo.classList.remove("hidden");
    } else {
        logo.classList.add("hidden");
    }

    document.getElementById("previewInvoiceNumber").innerText =
        document.getElementById("invoiceNumber").value || "INV-0001";

    document.getElementById("previewInvoiceDate").innerText =
        document.getElementById("invoiceDate").value || "";

    const dueDate = document.getElementById("dueDate").value;
    const dueDateLine = document.getElementById("previewDueDateLine");

    if (dueDate) {
        dueDateLine.classList.remove("hidden");
        document.getElementById("previewDueDate").innerText = dueDate;
    } else {
        dueDateLine.classList.add("hidden");
    }

    document.getElementById("previewCustomerName").innerText =
        document.getElementById("customerName").value || "Customer Name";

    const customerPhone = document.getElementById("customerPhone").value;
    const customerEmail = document.getElementById("customerEmail").value;
    const customerAddress = document.getElementById("customerAddress").value;

    document.getElementById("previewCustomerPhone").innerText =
        customerPhone ? "Phone: " + customerPhone : "";

    document.getElementById("previewCustomerEmail").innerText =
        customerEmail ? "Email: " + customerEmail : "";

    document.getElementById("previewCustomerAddress").innerText =
        customerAddress || "";

    renderPreviewTable();
    updateSummary();
    updatePaymentPreview();
    updateNotePreview();
    updateSocialPreview();
    updateQRCode();
    saveAutoSave();
}

function updateSummary() {
    const itemDiscount = calculateItemDiscountTotal();
    const invoiceDiscount = calculateInvoiceDiscount();
    const totalDiscount = itemDiscount + invoiceDiscount;

    document.getElementById("previewSubtotal").innerText = formatMoney(calculateSubtotalBeforeDiscount());

    const itemDiscountRow = document.getElementById("itemDiscountSummaryRow");
    const invoiceDiscountRow = document.getElementById("invoiceDiscountSummaryRow");

    if (itemDiscount > 0) {
        itemDiscountRow.classList.remove("hidden");
        document.getElementById("previewItemDiscountTotal").innerText = "- " + formatMoney(itemDiscount);
    } else {
        itemDiscountRow.classList.add("hidden");
    }

    if (invoiceDiscount > 0) {
        invoiceDiscountRow.classList.remove("hidden");
        document.getElementById("previewInvoiceDiscount").innerText = "- " + formatMoney(invoiceDiscount);
    } else {
        invoiceDiscountRow.classList.add("hidden");
    }

    document.getElementById("previewGrandTotal").innerText = formatMoney(calculateGrandTotal());

    document.getElementById("summaryTotalItems").innerText = items.length;
    document.getElementById("summarySubtotal").innerText = formatMoney(calculateSubtotalBeforeDiscount());
    document.getElementById("summaryDiscount").innerText = formatMoney(totalDiscount);
    document.getElementById("summaryGrandTotal").innerText = formatMoney(calculateGrandTotal());
}

function renderPreviewTable() {
    const head = document.getElementById("previewTableHead");
    const body = document.getElementById("previewTableBody");

    const showDiscountColumn = hasAnyItemDiscount();

    if (priceColumns.length === 0) {
        head.innerHTML = "";
        body.innerHTML = `
                <tr>
                    <td class="text-center text-slate-500 py-8 border border-slate-200">
                        Add price columns and items to generate the invoice table.
                    </td>
                </tr>
            `;
        return;
    }

    let headHTML = `
            <tr>
                <th class="px-4 py-3 text-left border border-slate-300">#</th>
                <th class="px-4 py-3 text-left border border-slate-300">Item</th>
        `;

    priceColumns.forEach(column => {
        headHTML += `
                <th class="px-4 py-3 text-right border border-slate-300">${escapeHTML(column)}</th>
            `;
    });

    if (showDiscountColumn) {
        headHTML += `<th class="px-4 py-3 text-right border border-slate-300">Discount</th>`;
    }

    headHTML += `<th class="px-4 py-3 text-right border border-slate-300">Total</th></tr>`;
    head.innerHTML = headHTML;

    if (items.length === 0) {
        const colspan = priceColumns.length + (showDiscountColumn ? 4 : 3);

        body.innerHTML = `
                <tr>
                    <td colspan="${colspan}" class="text-center text-slate-500 py-8 border border-slate-200">
                        No invoice items added.
                    </td>
                </tr>
            `;
        return;
    }

    let bodyHTML = "";

    items.forEach((item, index) => {
        bodyHTML += `
                <tr class="${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}">
                    <td class="px-4 py-3 border border-slate-200">${index + 1}</td>
                    <td class="px-4 py-3 border border-slate-200 font-medium">${escapeHTML(item.name || "Item Name")}</td>
            `;

        priceColumns.forEach(column => {
            let price = parseFloat(item.prices[column]) || 0;

            bodyHTML += `
                    <td class="px-4 py-3 border border-slate-200 text-right">
                        ${formatMoney(price)}
                    </td>
                `;
        });

        if (showDiscountColumn) {
            bodyHTML += `
                    <td class="px-4 py-3 border border-slate-200 text-right">
                        ${formatMoney(calculateItemDiscount(item))}
                    </td>
                `;
        }

        bodyHTML += `
                    <td class="px-4 py-3 border border-slate-200 text-right font-bold">
                        ${formatMoney(calculateRowTotal(item))}
                    </td>
                </tr>
            `;
    });

    bodyHTML += `
            <tr class="bg-slate-100 text-slate-900">
                <td colspan="2" class="px-4 py-4 text-right font-bold border border-slate-300">
                    Column Totals
                </td>
        `;

    priceColumns.forEach(column => {
        bodyHTML += `
                <td class="px-4 py-4 text-right font-bold border border-slate-300">
                    ${formatMoney(calculateColumnTotal(column))}
                </td>
            `;
    });

    if (showDiscountColumn) {
        bodyHTML += `
                <td class="px-4 py-4 text-right font-bold border border-slate-300">
                    ${formatMoney(calculateItemDiscountTotal())}
                </td>
            `;
    }

    bodyHTML += `
                <td class="px-4 py-4 text-right font-bold border border-slate-300">
                    ${formatMoney(calculateAfterItemDiscountTotal())}
                </td>
            </tr>
        `;

    const grandTotalColspan = priceColumns.length + (showDiscountColumn ? 3 : 2);

    bodyHTML += `
            <tr id="grandTotalRow" class="bg-blue-900 text-white">
                <td colspan="${grandTotalColspan}" class="px-4 py-4 text-right font-bold border border-slate-300">
                    Grand Total
                </td>
                <td class="px-4 py-4 text-right font-bold border border-slate-300">
                    ${formatMoney(calculateGrandTotal())}
                </td>
            </tr>
        `;

    body.innerHTML = bodyHTML;
}

function updatePaymentPreview() {
    const fields = [
        ["Payment Method", document.getElementById("paymentMethod").value],
        ["Bank Name", document.getElementById("bankName").value],
        ["Account Name", document.getElementById("accountName").value],
        ["Account Number", document.getElementById("accountNumber").value],
        ["Branch", document.getElementById("bankBranch").value],
        ["Payment Link", document.getElementById("paymentLink").value]
    ];

    let html = "";

    fields.forEach(([label, value]) => {
        if (value) {
            html += `<p><strong>${label}:</strong> ${escapeHTML(value)}</p>`;
        }
    });

    const block = document.getElementById("previewPaymentBlock");
    const details = document.getElementById("previewPaymentDetails");

    if (html) {
        block.classList.remove("hidden");
        details.innerHTML = html;
    } else {
        block.classList.add("hidden");
        details.innerHTML = "";
    }
}

function updateNotePreview() {
    const note = document.getElementById("customNote").value;
    const block = document.getElementById("previewNoteBlock");

    if (note.trim() !== "") {
        block.classList.remove("hidden");
        document.getElementById("previewCustomNote").innerText = note;
    } else {
        block.classList.add("hidden");
    }
}

function updateSocialPreview() {
    const facebook = document.getElementById("facebook").value;
    const instagram = document.getElementById("instagram").value;
    const whatsapp = document.getElementById("whatsapp").value;

    let socialHTML = "";

    if (facebook) {
        socialHTML += `<p><strong>Facebook:</strong> ${escapeHTML(facebook)}</p>`;
    }

    if (instagram) {
        socialHTML += `<p><strong>Instagram:</strong> ${escapeHTML(instagram)}</p>`;
    }

    if (whatsapp) {
        socialHTML += `<p><strong>WhatsApp:</strong> ${escapeHTML(whatsapp)}</p>`;
    }

    document.getElementById("previewSocialLinks").innerHTML = socialHTML;
}

function updateQRCode() {
    const qrType = document.getElementById("qrType").value;
    const qrBlock = document.getElementById("previewQRBlock");
    const qrContainer = document.getElementById("qrcode");

    qrContainer.innerHTML = "";

    let qrText = "";

    if (qrType === "whatsapp") {
        qrText = document.getElementById("whatsapp").value;
    }

    if (qrType === "payment") {
        qrText = document.getElementById("paymentLink").value;
    }

    if (qrType === "business") {
        qrText =
            "Business: " + (document.getElementById("businessName").value || "") + "\n" +
            "Phone: " + (document.getElementById("businessPhone").value || "") + "\n" +
            "Email: " + (document.getElementById("businessEmail").value || "");
    }

    if (qrText.trim() !== "") {
        qrBlock.classList.remove("hidden");

        new QRCode(qrContainer, {
            text: qrText,
            width: 90,
            height: 90
        });
    } else {
        qrBlock.classList.add("hidden");
    }
}

function applyTemplate() {
    const template = document.getElementById("invoiceTemplate").value;
    const colorInput = document.getElementById("themeColor");

    if (template === "royalBlue") colorInput.value = "#1e3a8a";
    if (template === "minimalBlack") colorInput.value = "#111827";
    if (template === "modernGreen") colorInput.value = "#166534";
    if (template === "classicGray") colorInput.value = "#475569";
    if (template === "premiumGold") colorInput.value = "#92400e";

    updateInvoice();
}

function applyThemeToPreview() {
    const color = document.getElementById("themeColor").value || "#1e3a8a";

    const themedElements = [
        "previewTopBar",
        "previewBusinessName",
        "previewInvoiceTitle",
        "billToHeading",
        "summaryHeading",
        "paymentHeading",
        "noteHeading",
        "thankYouText"
    ];

    themedElements.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (id === "previewTopBar") {
                el.style.backgroundColor = color;
            } else {
                el.style.color = color;
            }
        }
    });

    document.getElementById("previewGrandTotal").style.color = color;

    const head = document.getElementById("previewTableHead");
    head.style.backgroundColor = color;

    const grandTotalRow = document.getElementById("grandTotalRow");
    if (grandTotalRow) {
        grandTotalRow.style.backgroundColor = color;
    }
}

function updateLogoPosition() {
    const position = document.getElementById("logoPosition").value;
    const wrapper = document.getElementById("businessHeaderWrapper");
    const header = document.getElementById("invoiceHeaderArea");

    wrapper.className = "flex items-start gap-5";

    if (position === "left") {
        header.className = "flex flex-col md:flex-row md:items-start md:justify-between gap-6 border-b border-slate-200 pb-6";
        wrapper.className = "flex items-start gap-5";
    }

    if (position === "center") {
        header.className = "flex flex-col items-center text-center gap-6 border-b border-slate-200 pb-6";
        wrapper.className = "flex flex-col items-center gap-4";
    }

    if (position === "right") {
        header.className = "flex flex-col md:flex-row-reverse md:items-start md:justify-between gap-6 border-b border-slate-200 pb-6";
        wrapper.className = "flex flex-row-reverse items-start gap-5 text-right";
    }
}

function collectInvoiceData() {
    return {
        businessName: document.getElementById("businessName").value,
        businessPhone: document.getElementById("businessPhone").value,
        businessEmail: document.getElementById("businessEmail").value,
        businessAddress: document.getElementById("businessAddress").value,

        customerName: document.getElementById("customerName").value,
        customerPhone: document.getElementById("customerPhone").value,
        customerEmail: document.getElementById("customerEmail").value,
        customerAddress: document.getElementById("customerAddress").value,

        invoiceNumber: document.getElementById("invoiceNumber").value,
        invoiceDate: document.getElementById("invoiceDate").value,
        dueDate: document.getElementById("dueDate").value,
        currency: document.getElementById("currency").value,
        invoiceDiscountType: document.getElementById("invoiceDiscountType").value,
        invoiceDiscountValue: document.getElementById("invoiceDiscountValue").value,

        paymentMethod: document.getElementById("paymentMethod").value,
        bankName: document.getElementById("bankName").value,
        accountName: document.getElementById("accountName").value,
        accountNumber: document.getElementById("accountNumber").value,
        bankBranch: document.getElementById("bankBranch").value,
        paymentLink: document.getElementById("paymentLink").value,

        facebook: document.getElementById("facebook").value,
        instagram: document.getElementById("instagram").value,
        whatsapp: document.getElementById("whatsapp").value,
        customNote: document.getElementById("customNote").value,

        invoiceTemplate: document.getElementById("invoiceTemplate").value,
        themeColor: document.getElementById("themeColor").value,
        logoPosition: document.getElementById("logoPosition").value,
        qrType: document.getElementById("qrType").value,

        logoData: logoData,
        priceColumns: priceColumns,
        items: items
    };
}

function fillInvoiceData(data) {
    isRestoring = true;

    document.getElementById("businessName").value = data.businessName || "";
    document.getElementById("businessPhone").value = data.businessPhone || "";
    document.getElementById("businessEmail").value = data.businessEmail || "";
    document.getElementById("businessAddress").value = data.businessAddress || "";

    document.getElementById("customerName").value = data.customerName || "";
    document.getElementById("customerPhone").value = data.customerPhone || "";
    document.getElementById("customerEmail").value = data.customerEmail || "";
    document.getElementById("customerAddress").value = data.customerAddress || "";

    document.getElementById("invoiceNumber").value = data.invoiceNumber || generateInvoiceNumber();
    document.getElementById("invoiceDate").value = data.invoiceDate || "";
    document.getElementById("dueDate").value = data.dueDate || "";
    document.getElementById("currency").value = data.currency || "Rs.";
    document.getElementById("invoiceDiscountType").value = data.invoiceDiscountType || "none";
    document.getElementById("invoiceDiscountValue").value = data.invoiceDiscountValue || 0;

    document.getElementById("paymentMethod").value = data.paymentMethod || "";
    document.getElementById("bankName").value = data.bankName || "";
    document.getElementById("accountName").value = data.accountName || "";
    document.getElementById("accountNumber").value = data.accountNumber || "";
    document.getElementById("bankBranch").value = data.bankBranch || "";
    document.getElementById("paymentLink").value = data.paymentLink || "";

    document.getElementById("facebook").value = data.facebook || "";
    document.getElementById("instagram").value = data.instagram || "";
    document.getElementById("whatsapp").value = data.whatsapp || "";
    document.getElementById("customNote").value = data.customNote || "";

    document.getElementById("invoiceTemplate").value = data.invoiceTemplate || "royalBlue";
    document.getElementById("themeColor").value = data.themeColor || "#1e3a8a";
    document.getElementById("logoPosition").value = data.logoPosition || "left";
    document.getElementById("qrType").value = data.qrType || "none";

    logoData = data.logoData || "";
    priceColumns = Array.isArray(data.priceColumns) ? data.priceColumns : [];
    items = Array.isArray(data.items) ? data.items : [];

    items.forEach(item => {
        if (!item.prices) item.prices = {};
        if (!item.discountType) item.discountType = "none";
        if (!item.discountValue) item.discountValue = 0;

        priceColumns.forEach(column => {
            if (item.prices[column] === undefined) {
                item.prices[column] = 0;
            }
        });
    });

    isRestoring = false;
}

function saveAutoSave() {
    if (isRestoring) return;

    const data = collectInvoiceData();
    localStorage.setItem(AUTO_SAVE_KEY, JSON.stringify(data));
}

function restoreAutoSave() {
    const saved = localStorage.getItem(AUTO_SAVE_KEY);

    if (!saved) return false;

    try {
        const data = JSON.parse(saved);
        fillInvoiceData(data);
        return true;
    } catch (error) {
        return false;
    }
}

function downloadDraftJSON() {
    const data = collectInvoiceData();
    const json = JSON.stringify(data, null, 4);
    const blob = new Blob([json], { type: "application/json" });

    const invoiceNumber = document.getElementById("invoiceNumber").value || "invoice";
    const link = document.createElement("a");

    link.href = URL.createObjectURL(blob);
    link.download = invoiceNumber + "-editable-draft.json";
    link.click();

    URL.revokeObjectURL(link.href);
}

function importDraftJSON(event) {
    const file = event.target.files[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = function (e) {
        try {
            const data = JSON.parse(e.target.result);

            fillInvoiceData(data);
            renderInputTable();
            updateInvoice();

            alert("Invoice draft imported successfully.");
        } catch (error) {
            alert("Invalid JSON draft file.");
        }
    };

    reader.readAsText(file);
    event.target.value = "";
}

function clearInvoice() {
    if (!confirm("Are you sure you want to clear the current invoice?")) return;

    localStorage.removeItem(AUTO_SAVE_KEY);

    priceColumns = [];
    items = [];
    logoData = "";

    document.querySelectorAll("input, textarea").forEach(input => {
        if (input.type !== "color" && input.type !== "file") {
            input.value = "";
        }
    });

    document.getElementById("currency").value = "Rs.";
    document.getElementById("invoiceNumber").value = generateInvoiceNumber();
    document.getElementById("invoiceDate").valueAsDate = new Date();
    document.getElementById("invoiceDiscountType").value = "none";
    document.getElementById("invoiceDiscountValue").value = 0;
    document.getElementById("invoiceTemplate").value = "royalBlue";
    document.getElementById("themeColor").value = "#1e3a8a";
    document.getElementById("logoPosition").value = "left";
    document.getElementById("qrType").value = "none";
    document.getElementById("paymentMethod").value = "";

    renderInputTable();
    updateInvoice();
}

function printInvoice() {
    window.print();
}

function downloadPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF("p", "mm", "a4");

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const themeRGB = hexToRgb(document.getElementById("themeColor").value || "#1e3a8a");
    const darkSlate = [15, 23, 42];
    const lightGray = [248, 250, 252];

    const businessName = document.getElementById("businessName").value || "Your Business Name";
    const businessPhone = document.getElementById("businessPhone").value;
    const businessEmail = document.getElementById("businessEmail").value;
    const businessAddress = document.getElementById("businessAddress").value || "Business address";

    const invoiceNumber = document.getElementById("invoiceNumber").value || "invoice";
    const invoiceDate = document.getElementById("invoiceDate").value || "";
    const dueDate = document.getElementById("dueDate").value || "";

    const customerName = document.getElementById("customerName").value || "Customer Name";
    const customerPhone = document.getElementById("customerPhone").value;
    const customerEmail = document.getElementById("customerEmail").value;
    const customerAddress = document.getElementById("customerAddress").value;

    const facebook = document.getElementById("facebook").value;
    const instagram = document.getElementById("instagram").value;
    const whatsapp = document.getElementById("whatsapp").value;
    const customNote = document.getElementById("customNote").value;

    doc.setFillColor(...themeRGB);
    doc.rect(0, 0, pageWidth, 8, "F");

    let startY = 20;
    let logoPosition = document.getElementById("logoPosition").value;

    let logoX = 14;
    if (logoPosition === "center") logoX = pageWidth / 2 - 16;
    if (logoPosition === "right") logoX = pageWidth - 46;

    if (logoData) {
        try {
            doc.addImage(logoData, "PNG", logoX, startY, 32, 32);
        } catch (e) {
            try {
                doc.addImage(logoData, "JPEG", logoX, startY, 32, 32);
            } catch (err) {}
        }
    }

    let businessX = 14;
    let businessAlign = "left";

    if (logoData && logoPosition === "left") businessX = 52;
    if (logoPosition === "center") {
        businessX = pageWidth / 2;
        businessAlign = "center";
        startY = 58;
    }
    if (logoPosition === "right") {
        businessX = 14;
        businessAlign = "left";
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(...themeRGB);
    doc.text(businessName, businessX, startY + 5, { align: businessAlign });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);

    let businessLineY = startY + 12;

    const businessAddressLines = doc.splitTextToSize(businessAddress, 80);
    doc.text(businessAddressLines, businessX, businessLineY, { align: businessAlign });
    businessLineY += businessAddressLines.length * 5;

    if (businessPhone) {
        doc.text("Phone: " + businessPhone, businessX, businessLineY, { align: businessAlign });
        businessLineY += 5;
    }

    if (businessEmail) {
        doc.text("Email: " + businessEmail, businessX, businessLineY, { align: businessAlign });
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(26);
    doc.setTextColor(...themeRGB);
    doc.text("INVOICE", pageWidth - 14, 25, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text("Invoice No: " + invoiceNumber, pageWidth - 14, 34, { align: "right" });
    doc.text("Date: " + invoiceDate, pageWidth - 14, 40, { align: "right" });

    if (dueDate) {
        doc.text("Due Date: " + dueDate, pageWidth - 14, 46, { align: "right" });
    }

    let dividerY = logoPosition === "center" ? 88 : 60;

    doc.setDrawColor(226, 232, 240);
    doc.line(14, dividerY, pageWidth - 14, dividerY);

    let billStartY = dividerY + 10;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...themeRGB);
    doc.text("BILL TO", 14, billStartY);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...darkSlate);
    doc.text(customerName, 14, billStartY + 8);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);

    let customerY = billStartY + 15;

    if (customerPhone) {
        doc.text("Phone: " + customerPhone, 14, customerY);
        customerY += 5;
    }

    if (customerEmail) {
        doc.text("Email: " + customerEmail, 14, customerY);
        customerY += 5;
    }

    if (customerAddress) {
        const customerAddressLines = doc.splitTextToSize(customerAddress, 85);
        doc.text(customerAddressLines, 14, customerY);
    }

    doc.setFillColor(...lightGray);
    doc.roundedRect(pageWidth - 84, billStartY - 4, 70, 48, 3, 3, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...themeRGB);
    doc.text("PAYMENT SUMMARY", pageWidth - 78, billStartY + 4);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);

    let summaryY = billStartY + 13;

    doc.text("Subtotal:", pageWidth - 78, summaryY);
    doc.text(formatMoney(calculateSubtotalBeforeDiscount()), pageWidth - 18, summaryY, { align: "right" });
    summaryY += 7;

    if (calculateItemDiscountTotal() > 0) {
        doc.text("Item Discounts:", pageWidth - 78, summaryY);
        doc.text("- " + formatMoney(calculateItemDiscountTotal()), pageWidth - 18, summaryY, { align: "right" });
        summaryY += 7;
    }

    if (calculateInvoiceDiscount() > 0) {
        doc.text("Invoice Discount:", pageWidth - 78, summaryY);
        doc.text("- " + formatMoney(calculateInvoiceDiscount()), pageWidth - 18, summaryY, { align: "right" });
        summaryY += 7;
    }

    doc.setFont("helvetica", "bold");
    doc.setTextColor(...themeRGB);
    doc.text("Grand Total:", pageWidth - 78, summaryY);
    doc.text(formatMoney(calculateGrandTotal()), pageWidth - 18, summaryY, { align: "right" });

    const showDiscountColumn = hasAnyItemDiscount();

    let tableHeaders = ["#", "Item", ...priceColumns];

    if (showDiscountColumn) {
        tableHeaders.push("Discount");
    }

    tableHeaders.push("Total");

    const tableHead = [tableHeaders];
    const tableBody = [];

    items.forEach((item, index) => {
        const row = [index + 1, item.name || "Item Name"];

        priceColumns.forEach(column => {
            row.push(formatMoney(parseFloat(item.prices[column]) || 0));
        });

        if (showDiscountColumn) {
            row.push(formatMoney(calculateItemDiscount(item)));
        }

        row.push(formatMoney(calculateRowTotal(item)));

        tableBody.push(row);
    });

    if (items.length > 0) {
        const totalRow = ["", "Column Totals"];

        priceColumns.forEach(column => {
            totalRow.push(formatMoney(calculateColumnTotal(column)));
        });

        if (showDiscountColumn) {
            totalRow.push(formatMoney(calculateItemDiscountTotal()));
        }

        totalRow.push(formatMoney(calculateAfterItemDiscountTotal()));
        tableBody.push(totalRow);

        const grandTotalRow = ["", "Grand Total"];

        priceColumns.forEach(() => {
            grandTotalRow.push("");
        });

        if (showDiscountColumn) {
            grandTotalRow.push("");
        }

        grandTotalRow.push(formatMoney(calculateGrandTotal()));
        tableBody.push(grandTotalRow);
    }

    doc.autoTable({
        head: tableHead,
        body: tableBody,
        startY: billStartY + 58,
        theme: "grid",
        showHead: "firstPage",
        rowPageBreak: "avoid",
        pageBreak: "auto",
        styles: {
            font: "helvetica",
            fontSize: 8,
            cellPadding: 3,
            overflow: "linebreak",
            valign: "middle"
        },
        headStyles: {
            fillColor: themeRGB,
            textColor: [255, 255, 255],
            fontStyle: "bold"
        },
        alternateRowStyles: {
            fillColor: [248, 250, 252]
        },
        columnStyles: {
            0: { halign: "center", cellWidth: 10 },
            1: { cellWidth: 35 }
        },
        didParseCell: function (data) {
            const rowIndex = data.row.index;
            const isColumnTotalRow = rowIndex === tableBody.length - 2;
            const isGrandTotalRow = rowIndex === tableBody.length - 1;

            if (isColumnTotalRow) {
                data.cell.styles.fillColor = [241, 245, 249];
                data.cell.styles.fontStyle = "bold";
                data.cell.styles.textColor = darkSlate;
            }

            if (isGrandTotalRow) {
                data.cell.styles.fillColor = themeRGB;
                data.cell.styles.textColor = [255, 255, 255];
                data.cell.styles.fontStyle = "bold";
            }

            if (data.column.index >= 2) {
                data.cell.styles.halign = "right";
            }
        },
        margin: {
            left: 14,
            right: 14,
            bottom: 28
        }
    });

    let finalY = doc.lastAutoTable.finalY + 10;

    if (finalY > pageHeight - 65) {
        doc.addPage();
        finalY = 20;
    }

    const paymentLines = getPaymentLines();

    if (paymentLines.length > 0) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(...themeRGB);
        doc.text("PAYMENT DETAILS", 14, finalY);
        finalY += 6;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(80, 80, 80);

        paymentLines.forEach(line => {
            doc.text(line, 14, finalY);
            finalY += 5;
        });

        finalY += 4;
    }

    if (customNote.trim() !== "") {
        if (finalY > pageHeight - 45) {
            doc.addPage();
            finalY = 20;
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(...themeRGB);
        doc.text("NOTE", 14, finalY);
        finalY += 6;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(80, 80, 80);

        const noteLines = doc.splitTextToSize(customNote, pageWidth - 28);
        doc.text(noteLines, 14, finalY);
        finalY += noteLines.length * 5 + 5;
    }

    doc.setDrawColor(226, 232, 240);
    doc.line(14, finalY, pageWidth - 14, finalY);
    finalY += 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);

    if (facebook) {
        doc.text("Facebook: " + facebook, 14, finalY);
        finalY += 5;
    }

    if (instagram) {
        doc.text("Instagram: " + instagram, 14, finalY);
        finalY += 5;
    }

    if (whatsapp) {
        doc.text("WhatsApp: " + whatsapp, 14, finalY);
        finalY += 5;
    }

    finalY += 7;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...themeRGB);
    doc.text("Thank you for your business!", pageWidth / 2, finalY, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text("Invoice By", pageWidth / 2, finalY + 8, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...darkSlate);
    doc.text("Mohommed Najad", pageWidth / 2, finalY + 14, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text("076 906 8534", pageWidth / 2, finalY + 20, { align: "center" });

    const totalPages = doc.internal.getNumberOfPages();

    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.text("Page " + i + " of " + totalPages, pageWidth - 14, pageHeight - 10, { align: "right" });
    }

    doc.save(invoiceNumber + ".pdf");
    increaseInvoiceCounter();
}

function getPaymentLines() {
    const lines = [];

    const paymentMethod = document.getElementById("paymentMethod").value;
    const bankName = document.getElementById("bankName").value;
    const accountName = document.getElementById("accountName").value;
    const accountNumber = document.getElementById("accountNumber").value;
    const bankBranch = document.getElementById("bankBranch").value;
    const paymentLink = document.getElementById("paymentLink").value;

    if (paymentMethod) lines.push("Payment Method: " + paymentMethod);
    if (bankName) lines.push("Bank Name: " + bankName);
    if (accountName) lines.push("Account Name: " + accountName);
    if (accountNumber) lines.push("Account Number: " + accountNumber);
    if (bankBranch) lines.push("Branch: " + bankBranch);
    if (paymentLink) lines.push("Payment Link: " + paymentLink);

    return lines;
}
