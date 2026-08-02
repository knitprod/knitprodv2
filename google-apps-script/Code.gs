/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Epyllion Knitex Ltd. - Knitting Performance System
 * Dedicated Google Apps Script REST API Backend for:
 * 1. Order Plan & Status
 * 2. Yarn Allocation
 * 
 * ONLY these two modules connect with Google Sheets.
 */

// ==========================================================
// CONFIGURATION & GLOBAL CONSTANTS
// ==========================================================
const VERSION = "2.1.0-OrderYarnNormalized";

// ==========================================================
// WEB APP ROUTING HOOKS (GET & POST)
// ==========================================================

/**
 * Handles all HTTP GET requests.
 * Routes based on the 'action' query parameter.
 */
function doGet(e) {
  try {
    const action = e && e.parameter ? e.parameter.action : "";
    
    if (!action) {
      return makeResponse({
        success: false,
        message: "Action parameter is missing. Please specify an action (e.g. orders/list, yarn/list, health)."
      });
    }

    // Auto-bootstrap required sheets if missing
    initializeDatabase();

    // Route requests
    switch (action) {
      case "orders/list":
      case "orders":
        return handleGetOrderPlans(e);
      case "yarn/list":
      case "yarn":
        return handleGetYarnAllocations(e);
      case "health":
        return makeResponse({
          success: true,
          message: "Epyllion Order Plan & Yarn Allocation REST API is online.",
          version: VERSION,
          connectedSheets: ["Order Plan & Status", "Yarn Allocation"]
        });
      default:
        return makeResponse({
          success: false,
          message: "Invalid action or endpoint: " + action + ". Allowed GET actions: orders/list, yarn/list, health."
        });
    }
  } catch (error) {
    return makeResponse({
      success: false,
      message: "Server Error: " + error.toString()
    });
  }
}

/**
 * Handles all HTTP POST requests.
 * Parses the POST payload and routes based on the 'action' parameter.
 */
function doPost(e) {
  try {
    // Auto-bootstrap required sheets if missing
    initializeDatabase();

    let postData = {};
    if (e && e.postData && e.postData.contents) {
      try {
        postData = JSON.parse(e.postData.contents);
      } catch (ex) {
        return makeResponse({
          success: false,
          message: "Malformed JSON post body: " + ex.toString()
        });
      }
    }

    const action = postData.action || (e && e.parameter ? e.parameter.action : "");
    if (!action) {
      return makeResponse({
        success: false,
        message: "Action parameter is missing in route request."
      });
    }

    // Route POST actions
    switch (action) {
      case "orders/save":
        return handleSaveOrderPlans(postData);
      case "orders/delete":
        return handleDeleteOrderPlan(postData);
      case "yarn/save":
        return handleSaveYarnAllocations(postData);
      case "yarn/delete":
        return handleDeleteYarnAllocation(postData);
      default:
        return makeResponse({
          success: false,
          message: "Invalid POST action or endpoint: " + action + ". Allowed POST actions: orders/save, orders/delete, yarn/save, yarn/delete."
        });
    }
  } catch (error) {
    return makeResponse({
      success: false,
      message: "Server POST Error: " + error.toString()
    });
  }
}

/**
 * Creates an HTTP-compatible TextOutput containing stringified JSON data.
 */
function makeResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ==========================================================
// COLUMN HEADER NORMALIZATION HELPER
// ==========================================================

function normalizeHeaderName(headerStr) {
  if (!headerStr) return "";
  var raw = headerStr.toString().trim();
  var str = raw.toLowerCase().replace(/[^a-z0-9]/g, "");

  // ID
  if (str === "id") return "id";

  // Yarn field mappings
  if (str.indexOf("actualreq") >= 0 || str.indexOf("requisitiondate") >= 0) return "actualRequisitionDate";
  if (str === "buyer" || str === "buyername") return "buyer";
  if (str === "ordernumber" || str === "orderno" || str === "order" || str === "ewo" || str === "ordernum") return "orderNumber";
  if (str === "fabricstype" || str === "fabricstypes" || str === "fabricstype" || str === "fabricstype" || str === "fabrictype" || str === "fabric") return "fabricsType";
  if (str === "fabricshade" || str === "shade") return "fabricShade";
  if (str === "fabricgsm" || str === "gsm") return "fabricGsm";
  if (str.indexOf("yarnreq") >= 0 || str === "yarnrequired") return "yarnRequired";
  if (str === "lotref" || str === "lotreference") return "lotRef";
  if (str === "allocatedyarn") return "allocatedYarn";
  if (str === "lotno" || str === "lot" || str === "lotnum" || str === "lotnumber") return "lotNo";
  if (str.indexOf("spinner") >= 0) return "spinnersName";
  if (str === "allocationstatus" || str === "status") return "allocationStatus";
  if (str === "yarnstockstatus" || str === "stockstatus") return "yarnStockStatus";
  if (str === "yarndeliverystatus" || str === "deliverystatus") return "yarnDeliveryStatus";
  if (str.indexOf("proposedalloc") >= 0) return "proposedAllocationDate";
  if (str.indexOf("allocationsart") >= 0 || str.indexOf("allocationstartdate") >= 0 || str.indexOf("allocationdaterange") >= 0) return "allocationDateRange";
  if (str === "allocationno" || str === "allocationnum" || str === "allocationnumber") return "allocationNo";
  if (str.indexOf("yarnrqqty") >= 0 || str.indexOf("yarnreqqty") >= 0 || str.indexOf("yarnrequiredqty") >= 0) return "yarnRqQty";
  if (str === "allocatedqty" || str === "allocatedquantity") return "allocatedQty";
  if (str === "balance" || str === "balanceqty") return "balance";
  if (str === "remarks" || str === "comment" || str === "comments") return "remarks";

  // Order Plan field mappings
  if (str === "planmonth" || str === "month") return "planMonth";
  if (str === "plantype" || str === "type") return "planType";
  if (str === "color") return "color";
  if (str === "knitstart" || str === "knitstartdate") return "knitStart";
  if (str === "knitend" || str === "knitenddate") return "knitEnd";
  if (str === "target" || str === "targetqty") return "target";
  if (str === "targetnextmonth") return "targetNextMonth";
  if (str === "allocationstart") return "allocationStart";
  if (str === "allocationend") return "allocationEnd";
  if (str === "allocatedbal" || str === "allocatedbalance") return "allocatedBal";
  if (str === "greyreq" || str === "greyrequirement") return "greyReq";
  if (str === "knitpro" || str === "knitproduction") return "knitPro";
  if (str === "knitbal" || str === "knitbalance") return "knitBal";
  if (str === "aknitstart" || str === "actualknitstart") return "aKnitStart";
  if (str === "lastproductiondate") return "lastProductionDate";
  if (str === "avgprodday" || str === "avgproductionday") return "avgProdDay";
  if (str === "expectedknitend") return "expectedKnitEnd";
  if (str === "knitstartotd") return "knitStartOtd";
  if (str === "knitendotd") return "knitEndOtd";
  if (str === "knitstartremarks") return "knitStartRemarks";
  if (str === "knitendremarks") return "knitEndRemarks";

  return raw;
}

// ==========================================================
// DATABASE SETUP & AUTO-BOOTSTRAP MODULE
// ==========================================================

/**
 * Initializes 'Order Plan & Status' and 'Yarn Allocation' sheets
 * with standard headers and seed data if missing.
 */
function initializeDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // --------------------------------------------------------
  // 1. Order Plan & Status Sheet
  // --------------------------------------------------------
  let orderPlanSheet = ss.getSheetByName("Order Plan & Status") || ss.getSheetByName("Order_Plans");
  if (!orderPlanSheet) {
    orderPlanSheet = ss.insertSheet("Order Plan & Status");
    const orderHeaders = [
      "id", "planMonth", "planType", "ewo", "buyer", "color", "knitStart", "knitEnd", 
      "target", "targetNextMonth", "allocationStart", "allocationEnd", "allocatedQty", 
      "allocatedBal", "greyReq", "knitPro", "knitBal", "aKnitStart", "lastProductionDate", 
      "avgProdDay", "expectedKnitEnd", "knitStartOtd", "knitEndOtd", "knitStartRemarks", "knitEndRemarks"
    ];
    orderPlanSheet.getRange(1, 1, 1, orderHeaders.length).setValues([orderHeaders]);

    const seedOrderPlans = [
      [
        "ord-270258-1", "July", "Confirm", "270258", "Vogue Sourcin", "Mid Blue", "27-Jun-26", "15-Jul-26",
        314, 0, "5-May-26", "5-May-26", 336, 0, 334, 20, 314, "22-Jun-26", "15-Jul-26",
        5, "23-Sep-26", "Passed", "Passed", "Allocation complete", "Knit target met"
      ],
      [
        "ord-270258-2", "July", "Confirm", "270258", "Vogue Sourcin", "Blue Marl", "27-Jun-26", "15-Jul-26",
        3866, 0, "7-May-26", "15-Jul-26", 6253, 2, 5787, 3106, 2681, "29-Jun-26", "21-Jul-26",
        80, "25-Aug-26", "Failed", "Failed", "Yarn delay", "Production running"
      ],
      [
        "ord-270418", "July", "Confirm", "270418", "Vogue Sourcin", "Next Black", "10-Jun-26", "25-Jun-26",
        282, 0, "14-May-26", "24-May-26", 3124, 0, 2960, 2600, 359, "10-Jun-26", "25-Jun-26",
        45, "25-Jun-26", "Passed", "Passed", "On schedule", "Completed"
      ]
    ];

    for (let i = 0; i < seedOrderPlans.length; i++) {
      orderPlanSheet.appendRow(seedOrderPlans[i]);
    }
  }

  // --------------------------------------------------------
  // 2. Yarn Allocation Sheet
  // --------------------------------------------------------
  let yarnSheet = ss.getSheetByName("Yarn Allocation") || ss.getSheetByName("Yarn_Allocation");
  if (!yarnSheet) {
    yarnSheet = ss.insertSheet("Yarn Allocation");
    const yarnHeaders = [
      "id", "actualRequisitionDate", "buyer", "orderNumber", "fabricsType", "fabricShade", 
      "fabricGsm", "yarnRequired", "lotRef", "allocatedYarn", "lotNo", "spinnersName", 
      "allocationStatus", "yarnStockStatus", "yarnDeliveryStatus", "proposedAllocationDate", 
      "allocationDateRange", "allocationNo", "yarnRqQty", "allocatedQty", 
      "balance", "remarks"
    ];
    yarnSheet.getRange(1, 1, 1, yarnHeaders.length).setValues([yarnHeaders]);

    const seedYarnAllocations = [
      [
        "yarn-001", "05-Jul-26", "Vogue Sourcin", "270258", "Single Jersey", "Mid Blue",
        "180 GSM", "30/1 Combed Cotton", "LOT-9081", "30s Cotton Combed", "L-9081", "Spinner A",
        "Allocated", "In Stock", "Delivered", "04-Jul-26", "05-Jul-26 to 10-Jul-26",
        "ALLOC-2026-01", 5000, 5000, 0, "Fully Allocated"
      ],
      [
        "yarn-002", "10-Jul-26", "Vogue Sourcin", "270418", "1x1 Rib", "Next Black",
        "220 GSM", "34/1 Carded Cotton", "LOT-7712", "34s Carded", "L-7712", "Spinner B",
        "Partial", "Transit", "Pending", "08-Jul-26", "10-Jul-26 to 18-Jul-26",
        "ALLOC-2026-02", 3500, 2500, 1000, "Awaiting Balance Delivery"
      ]
    ];

    for (let i = 0; i < seedYarnAllocations.length; i++) {
      yarnSheet.appendRow(seedYarnAllocations[i]);
    }
  }
}

// ==========================================================
// 1. ORDER PLAN & STATUS HANDLERS
// ==========================================================

function getOrderPlanSheetInternal() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName("Order Plan & Status") || ss.getSheetByName("Order_Plans");
}

/**
 * Returns all order plans from 'Order Plan & Status' sheet.
 */
function handleGetOrderPlans(e) {
  const sheet = getOrderPlanSheetInternal();
  if (!sheet) {
    return makeResponse({ success: true, data: [] });
  }

  const data = sheet.getDataRange().getValues();
  if (!data || data.length < 2) {
    return makeResponse({ success: true, data: [] });
  }

  const rawHeaders = data[0];
  const normalizedHeaders = rawHeaders.map(function(h) { return normalizeHeaderName(h); });
  const orderPlans = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const item = {};
    for (let j = 0; j < normalizedHeaders.length; j++) {
      let val = row[j];
      if (val instanceof Date) {
        val = val.toISOString().split('T')[0];
      }
      const propKey = normalizedHeaders[j] || ("col_" + j);
      item[propKey] = val;
    }
    if (item.id || item.ewo) {
      orderPlans.push(item);
    }
  }

  return makeResponse({
    success: true,
    count: orderPlans.length,
    data: orderPlans
  });
}

/**
 * Saves or updates order plan records in 'Order Plan & Status' sheet.
 */
function handleSaveOrderPlans(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = getOrderPlanSheetInternal();
  if (!sheet) {
    sheet = ss.insertSheet("Order Plan & Status");
  }

  const orders = payload.orderPlans || payload.data || (Array.isArray(payload) ? payload : [payload]);
  if (!Array.isArray(orders)) {
    return makeResponse({ success: false, message: "Invalid payload format. Expected orderPlans array." });
  }

  let data = sheet.getDataRange().getValues();
  const defaultHeaders = [
    "id", "planMonth", "planType", "ewo", "buyer", "color", "knitStart", "knitEnd", 
    "target", "targetNextMonth", "allocationStart", "allocationEnd", "allocatedQty", 
    "allocatedBal", "greyReq", "knitPro", "knitBal", "aKnitStart", "lastProductionDate", 
    "avgProdDay", "expectedKnitEnd", "knitStartOtd", "knitEndOtd", "knitStartRemarks", "knitEndRemarks"
  ];

  if (!data || data.length === 0 || !data[0] || data[0].length === 0) {
    sheet.getRange(1, 1, 1, defaultHeaders.length).setValues([defaultHeaders]);
    data = [defaultHeaders];
  }

  const rawHeaders = data[0];
  const normHeaders = rawHeaders.map(function(h) { return normalizeHeaderName(h); });
  const idCol = normHeaders.indexOf("id");

  const existingMap = {};
  for (let i = 1; i < data.length; i++) {
    if (idCol >= 0 && data[i][idCol]) {
      existingMap[data[i][idCol].toString().trim()] = i + 1; // 1-based row index
    }
  }

  orders.forEach(function(ord) {
    const ordId = (ord.id || ("ord-" + Date.now() + "-" + Math.floor(Math.random() * 1000))).toString().trim();
    const newRow = normHeaders.map(function(h, idx) {
      const origHeader = rawHeaders[idx];
      let val = ord[h];
      if (val === undefined || val === null) val = ord[origHeader];
      if (val === undefined || val === null) return "";
      if (typeof val === "object") return JSON.stringify(val);
      return val;
    });

    if (existingMap[ordId]) {
      const rowIndex = existingMap[ordId];
      sheet.getRange(rowIndex, 1, 1, normHeaders.length).setValues([newRow]);
    } else {
      sheet.appendRow(newRow);
    }
  });

  return makeResponse({
    success: true,
    message: "Saved " + orders.length + " order plans to Google Sheets successfully.",
    count: orders.length
  });
}

/**
 * Deletes an order plan from 'Order Plan & Status' sheet.
 */
function handleDeleteOrderPlan(payload) {
  const sheet = getOrderPlanSheetInternal();
  if (!sheet) {
    return makeResponse({ success: false, message: "Order Plan & Status sheet does not exist." });
  }

  const id = payload.id || (payload.data && payload.data.id) || payload.ewo;
  if (!id) {
    return makeResponse({ success: false, message: "Order plan ID or EWO number is required for deletion." });
  }

  const data = sheet.getDataRange().getValues();
  if (!data || data.length < 2) {
    return makeResponse({ success: false, message: "No order plans found in sheet." });
  }

  const rawHeaders = data[0];
  const normHeaders = rawHeaders.map(function(h) { return normalizeHeaderName(h); });
  const idCol = normHeaders.indexOf("id");
  const ewoCol = normHeaders.indexOf("ewo");
  const targetId = id.toString().trim().toLowerCase();

  for (let i = 1; i < data.length; i++) {
    const rowId = (idCol >= 0 && data[i][idCol]) ? data[i][idCol].toString().trim().toLowerCase() : "";
    const rowEwo = (ewoCol >= 0 && data[i][ewoCol]) ? data[i][ewoCol].toString().trim().toLowerCase() : "";

    if ((rowId && rowId === targetId) || (rowEwo && rowEwo === targetId)) {
      sheet.deleteRow(i + 1);
      return makeResponse({
        success: true,
        message: "Order plan successfully deleted from Google Sheets."
      });
    }
  }

  return makeResponse({
    success: true,
    message: "Order plan deleted or not found in Google Sheets."
  });
}

// ==========================================================
// 2. YARN ALLOCATION HANDLERS
// ==========================================================

function getYarnSheetInternal() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName("Yarn Allocation") || ss.getSheetByName("Yarn_Allocation");
}

/**
 * Returns all yarn allocations from 'Yarn Allocation' sheet.
 */
function handleGetYarnAllocations(e) {
  const sheet = getYarnSheetInternal();
  if (!sheet) {
    return makeResponse({ success: true, data: [] });
  }

  const data = sheet.getDataRange().getValues();
  if (!data || data.length < 2) {
    return makeResponse({ success: true, data: [] });
  }

  const rawHeaders = data[0];
  const normalizedHeaders = rawHeaders.map(function(h) { return normalizeHeaderName(h); });
  const yarnAllocations = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const item = {};
    for (let j = 0; j < normalizedHeaders.length; j++) {
      let val = row[j];
      if (val instanceof Date) {
        val = val.toISOString().split('T')[0];
      }
      const propKey = normalizedHeaders[j] || ("col_" + j);
      item[propKey] = val;
    }
    if (item.id || item.orderNumber || item.allocationNo || item.buyer) {
      yarnAllocations.push(item);
    }
  }

  return makeResponse({
    success: true,
    count: yarnAllocations.length,
    data: yarnAllocations
  });
}

/**
 * Saves or updates yarn allocation records in 'Yarn Allocation' sheet.
 */
function handleSaveYarnAllocations(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = getYarnSheetInternal();
  if (!sheet) {
    sheet = ss.insertSheet("Yarn Allocation");
  }

  const items = payload.yarnAllocations || payload.data || (Array.isArray(payload) ? payload : [payload]);
  if (!Array.isArray(items)) {
    return makeResponse({ success: false, message: "Invalid payload format. Expected yarnAllocations array." });
  }

  let data = sheet.getDataRange().getValues();
  const defaultHeaders = [
    "id", "actualRequisitionDate", "buyer", "orderNumber", "fabricsType", "fabricShade", 
    "fabricGsm", "yarnRequired", "lotRef", "allocatedYarn", "lotNo", "spinnersName", 
    "allocationStatus", "yarnStockStatus", "yarnDeliveryStatus", "proposedAllocationDate", 
    "allocationDateRange", "allocationNo", "yarnRqQty", "allocatedQty", 
    "balance", "remarks"
  ];

  if (!data || data.length === 0 || !data[0] || data[0].length === 0) {
    sheet.getRange(1, 1, 1, defaultHeaders.length).setValues([defaultHeaders]);
    data = [defaultHeaders];
  }

  const rawHeaders = data[0];
  const normHeaders = rawHeaders.map(function(h) { return normalizeHeaderName(h); });
  const idCol = normHeaders.indexOf("id");

  const existingMap = {};
  for (let i = 1; i < data.length; i++) {
    if (idCol >= 0 && data[i][idCol]) {
      existingMap[data[i][idCol].toString().trim()] = i + 1; // 1-based row index
    }
  }

  items.forEach(function(yarnItem) {
    const itemId = (yarnItem.id || ("yarn-" + Date.now() + "-" + Math.floor(Math.random() * 1000))).toString().trim();
    const newRow = normHeaders.map(function(h, idx) {
      const origHeader = rawHeaders[idx];
      let val = yarnItem[h];
      if (val === undefined || val === null) val = yarnItem[origHeader];
      if (val === undefined || val === null) return "";
      if (typeof val === "object") return JSON.stringify(val);
      return val;
    });

    if (existingMap[itemId]) {
      const rowIndex = existingMap[itemId];
      sheet.getRange(rowIndex, 1, 1, normHeaders.length).setValues([newRow]);
    } else {
      sheet.appendRow(newRow);
    }
  });

  return makeResponse({
    success: true,
    message: "Saved " + items.length + " yarn allocation records to Google Sheets successfully.",
    count: items.length
  });
}

/**
 * Deletes a yarn allocation record from 'Yarn Allocation' sheet.
 */
function handleDeleteYarnAllocation(payload) {
  const sheet = getYarnSheetInternal();
  if (!sheet) {
    return makeResponse({ success: false, message: "Yarn Allocation sheet does not exist." });
  }

  const id = payload.id || (payload.data && payload.data.id) || payload.orderNumber;
  if (!id) {
    return makeResponse({ success: false, message: "Yarn allocation ID or Order Number is required for deletion." });
  }

  const data = sheet.getDataRange().getValues();
  if (!data || data.length < 2) {
    return makeResponse({ success: false, message: "No yarn allocations found in sheet." });
  }

  const rawHeaders = data[0];
  const normHeaders = rawHeaders.map(function(h) { return normalizeHeaderName(h); });
  const idCol = normHeaders.indexOf("id");
  const targetId = id.toString().trim().toLowerCase();

  for (let i = 1; i < data.length; i++) {
    const rowId = (idCol >= 0 && data[i][idCol]) ? data[i][idCol].toString().trim().toLowerCase() : "";

    if (rowId && rowId === targetId) {
      sheet.deleteRow(i + 1);
      return makeResponse({
        success: true,
        message: "Yarn allocation record successfully deleted from Google Sheets."
      });
    }
  }

  return makeResponse({
    success: true,
    message: "Yarn allocation record deleted or not found in Google Sheets."
  });
}
