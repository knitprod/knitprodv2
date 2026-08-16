/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Epyllion Knitex Ltd. - Knitting Performance System
 * Dedicated Google Apps Script REST API Backend for:
 * 1. Order Plan & Status
 * 2. Yarn Allocation
 * 3. Production Ledger (Daily Unit Records & Shifts)
 */

// ==========================================================
// CONFIGURATION & GLOBAL CONSTANTS
// ==========================================================
const VERSION = "3.1.0-LedgerSyncOnly";

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
        message: "Action parameter is missing. Please specify an action (e.g. orders/list, yarn/list, ledger/list, health)."
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
      case "ledger/list":
      case "ledger":
      case "production/list":
      case "production":
        return handleGetLedgerRecords(e);
      case "health":
        return makeResponse({
          success: true,
          message: "Epyllion Knitting Performance REST API is online.",
          version: VERSION,
          connectedSheets: ["Order Plan & Status", "Yarn Allocation", "Production Ledger"]
        });
      default:
        return makeResponse({
          success: false,
          message: "Invalid action or endpoint: " + action + ". Allowed GET actions: orders/list, yarn/list, ledger/list, health."
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
      case "ledger/save":
      case "ledger/add":
      case "ledger/update":
      case "production/add":
      case "production/update":
        return handleSaveLedgerRecords(postData);
      case "ledger/delete":
      case "production/delete":
        return handleDeleteLedgerRecord(postData);
      default:
        return makeResponse({
          success: false,
          message: "Invalid POST action or endpoint: " + action + ". Allowed POST actions: orders/save, orders/delete, yarn/save, yarn/delete, ledger/save, ledger/delete."
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

  // Common ID
  if (str === "id" || str === "recordid" || str === "entryid") return "id";

  // Production Ledger field mappings
  if (str === "unit" || str === "unitname" || str === "unittype") return "unit";
  if (str === "year" || str === "calyear") return "year";
  if (str === "month" || str === "calmonth") return "month";
  if (str === "date" || str === "entrydate" || str === "productiondate") return "date";
  if (str === "day" || str === "dayofweek" || str === "weekday") return "day";
  if (str === "floor" || str === "floorname" || str === "factoryfloor") return "floor";
  if (str === "target" || str === "targettotal" || str === "totaltarget" || str === "targetkg") return "target";
  if (str === "shifta" || str === "shift1") return "shiftA";
  if (str === "shiftb" || str === "shift2") return "shiftB";
  if (str === "shiftc" || str === "shift3") return "shiftC";
  if (str === "totalproduction" || str === "totalprod" || str === "productionkg" || str === "productiontotal") return "totalProduction";
  if (str === "targetbulk" || str === "targetbulkkg" || str === "bulktarget") return "targetBulk";
  if (str === "bulkprod" || str === "bulkproduction" || str === "bulkproductionkg") return "bulkProd";
  if (str === "sampleprod" || str === "sampleproduction" || str === "sampleproductionkg") return "sampleProd";
  if (str === "totalmachines" || str === "totalmc" || str === "totalmachinesallocated" || str === "allocatedmachines") return "totalMachines";
  if (str === "runningbulk" || str === "runningbulkmc") return "runningBulk";
  if (str === "runningsample" || str === "runningsamplemc") return "runningSample";
  if (str === "runningmachine" || str === "runningmc" || str === "totalrunningmachine" || str === "activemachines") return "runningMachine";
  if (str === "idlemc" || str === "idlemachine" || str === "idlemachines") return "idleMc";
  if (str === "machineutilization" || str === "machineutil" || str === "utilizationrate" || str === "mcutilization") return "machineUtilization";
  if (str === "idlemcpct" || str === "idlemachinepct" || str === "idlemachinepercent" || str === "idlemcpct") return "idleMcPct";
  if (str === "idleproduction" || str === "idleproductionkg" || str === "lossidlemachine") return "idleProduction";
  if (str === "efficiency" || str === "efficiencypercent" || str === "netefficiency") return "efficiency";
  if (str === "propermc" || str === "productionpermachine" || str === "avgprodpermachine") return "proPerMc";
  if (str === "reject" || str === "rejectkg" || str === "rejectedfabric") return "reject";
  if (str === "rejectpct" || str === "rejectpercent" || str === "rejectratio") return "rejectPct";
  if (str === "hold" || str === "holdkg" || str === "holdfabric") return "hold";
  if (str === "holdpct" || str === "holdpercent" || str === "holdratio") return "holdPct";
  if (str === "jhutecutpcs" || str === "jhute" || str === "cutpcs") return "jhuteCutpcs";
  if (str === "jhutecutpcspct" || str === "jhutepct") return "jhuteCutpcsPct";
  if (str === "needlebroken" || str === "needlebreakage" || str === "needles") return "needleBroken";
  if (str === "needleperkg" || str === "needlebrokenperkg" || str === "needlebrokenkg") return "needlePerKg";
  if (str === "sinkerbroken" || str === "sinkerbreakage" || str === "sinkers") return "sinkerBroken";
  if (str === "sinkerperkg" || str === "sinkerbrokenperkg" || str === "sinkerbrokenkg") return "sinkerPerKg";
  if (str === "oilconsumption" || str === "oilconsumptionltr" || str === "oilltr") return "oilConsumption";
  if (str === "beltbroken" || str === "beltbreakage" || str === "belts") return "beltBroken";
  if (str === "othersparepartsname" || str === "sparepartsname" || str === "othersparepart") return "otherSparePartsName";
  if (str === "othersparepartsqty" || str === "sparepartsqty") return "otherSparePartsQty";
  if (str === "setchangepcs" || str === "setchange" || str === "setchangecount") return "setChangePcs";
  if (str === "productionlossforeff" || str === "productionlossforefficiency" || str === "lossforeff") return "productionLossForEff";
  if (str === "prodlossforsample" || str === "productionlossforsample" || str === "lossforsample") return "prodLossForSample";
  if (str === "capacityutilization" || str === "capacityutil" || str === "capacityutilpct") return "capacityUtilization";
  if (str === "totaloperator" || str === "totaloperators" || str === "operators") return "totalOperator";
  if (str === "absent" || str === "absentcount" || str === "absentoperators") return "absent";
  if (str === "absentpct" || str === "absentpercent") return "absentPct";
  if (str === "productionflatknit" || str === "flatknitproduction") return "productionFlatKnit";
  if (str === "achievmentcircular" || str === "circularachievement") return "achievmentCircular";
  if (str === "otd" || str === "otdstatus") return "otd";
  if (str === "yarnissued" || str === "yarnissuekg") return "yarnIssued";
  if (str === "totalrunningfactories" || str === "runningfactories") return "totalRunningFactories";
  if (str === "numbervehicles" || str === "vehicles") return "numberVehicles";
  if (str === "fabricreturn" || str === "fabricreturned") return "fabricReturn";
  if (str === "remarks" || str === "comment" || str === "comments" || str === "note" || str === "notes") return "remarks";
  if (str === "lastupdated" || str === "updatedat" || str === "timestamp") return "lastUpdated";

  // Yarn field mappings
  if (str.indexOf("actualreq") >= 0 || str.indexOf("requisitiondate") >= 0) return "actualRequisitionDate";
  if (str === "buyer" || str === "buyername") return "buyer";
  if (str === "ordernumber" || str === "orderno" || str === "order" || str === "ewo" || str === "ordernum") return "orderNumber";
  if (str === "fabricstype" || str === "fabricstypes" || str === "fabrictype" || str === "fabric") return "fabricsType";
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

  // Order Plan field mappings
  if (str === "planmonth") return "planMonth";
  if (str === "plantype") return "planType";
  if (str === "color") return "color";
  if (str === "knitstart" || str === "knitstartdate") return "knitStart";
  if (str === "knitend" || str === "knitenddate") return "knitEnd";
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
  if (str === "knitteamleaders" || str === "teamleader" || str === "teamleaders") return "knitTeamLeaders";

  return raw;
}

// ==========================================================
// DATABASE SETUP & AUTO-BOOTSTRAP MODULE
// ==========================================================

/**
 * Initializes 'Order Plan & Status', 'Yarn Allocation', and 'Production Ledger' sheets
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
      "avgProdDay", "expectedKnitEnd", "knitStartOtd", "knitEndOtd", "knitStartRemarks", "knitEndRemarks", "knitTeamLeaders"
    ];
    orderPlanSheet.getRange(1, 1, 1, orderHeaders.length).setValues([orderHeaders]);

    const seedOrderPlans = [
      [
        "ord-270258-1", "July", "Confirm", "270258", "Vogue Sourcin", "Mid Blue", "27-Jun-26", "15-Jul-26",
        314, 0, "5-May-26", "5-May-26", 336, 0, 334, 20, 314, "22-Jun-26", "15-Jul-26",
        5, "23-Sep-26", "Passed", "Passed", "Allocation complete", "Knit target met", "Jahidul Islam"
      ],
      [
        "ord-270258-2", "July", "Confirm", "270258", "Vogue Sourcin", "Blue Marl", "27-Jun-26", "15-Jul-26",
        3866, 0, "7-May-26", "15-Jul-26", 6253, 2, 5787, 3106, 2681, "29-Jun-26", "21-Jul-26",
        80, "25-Aug-26", "Failed", "Failed", "Yarn delay", "Production running", "Abdur Rahman"
      ],
      [
        "ord-270418", "July", "Confirm", "270418", "Vogue Sourcin", "Next Black", "10-Jun-26", "25-Jun-26",
        282, 0, "14-May-26", "24-May-26", 3124, 0, 2960, 2600, 359, "10-Jun-26", "25-Jun-26",
        45, "25-Jun-26", "Passed", "Passed", "On schedule", "Completed", "Jahidul Islam"
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

  // --------------------------------------------------------
  // 3. Production Ledger Sheet
  // --------------------------------------------------------
  let ledgerSheet = ss.getSheetByName("Production Ledger") || ss.getSheetByName("Production_Ledger") || ss.getSheetByName("Ledger");
  if (!ledgerSheet) {
    ledgerSheet = ss.insertSheet("Production Ledger");
    const ledgerHeaders = [
      "id", "unit", "year", "month", "date", "day", "floor", "target", "shiftA", "shiftB", "shiftC", 
      "totalProduction", "targetBulk", "bulkProd", "sampleProd", "totalMachines", "runningBulk", "runningSample", 
      "runningMachine", "idleMc", "machineUtilization", "idleMcPct", "idleProduction", "efficiency", 
      "proPerMc", "reject", "rejectPct", "hold", "holdPct", "jhuteCutpcs", "jhuteCutpcsPct", 
      "needleBroken", "needlePerKg", "sinkerBroken", "sinkerPerKg", "oilConsumption", "beltBroken", 
      "otherSparePartsName", "otherSparePartsQty", "setChangePcs", "productionLossForEff", 
      "prodLossForSample", "capacityUtilization", "totalOperator", "absent", "absentPct", 
      "productionFlatKnit", "achievmentCircular", "otd", "yarnIssued", "totalRunningFactories", 
      "numberVehicles", "fabricReturn", "remarks", "lastUpdated"
    ];
    ledgerSheet.getRange(1, 1, 1, ledgerHeaders.length).setValues([ledgerHeaders]);

    const seedLedgerRows = [
      [
        "rec-2026-08-11-ekl", "In-House", 2026, "August", "2026-08-11", "EKL", 6200, 1983, 1878, 1729,
        5590, 6080, 5540, 50, 19, 1, 20, 9, 69, 31, 2673, 91.12, 277, 13, 0.23, 62, 1.11, 0, 0,
        71, 78.7, 0, 0, 8, 0, "", 0, 0, -2890, 241.58, 62.11, 48, 2, 4.17, 0, 0, "100%", 0, 0, 0, 0, "Running smoothly", "2026-08-11 08:00 PM"
      ],
      [
        "rec-2026-08-11-efl", "In-House", 2026, "August", "2026-08-11", "EFL", 14053, 3177, 2909, 3424,
        9510, 10350, 9228, 282, 45, 6, 51, 15, 68, 23, 948, 89, 211.33, 13, 0.14, 77, 0.81, 0, 0,
        54, 176.1, 0, 0, 7, 0, "", 0, 0, -45050.61, 0, 58.92, 96, 4, 4.17, 0, 0, "100%", 0, 0, 0, 0, "", "2026-08-11 08:00 PM"
      ],
      [
        "rec-2026-08-11-efl-2", "In-House", 2026, "August", "2026-08-11", "EFL-2", 8627, 1644, 1516, 2352,
        5512, 8960, 5376, 136, 32, 2, 34, 17, 67, 33, 762, 60.00, 162.12, 10, 0.18, 55, 1.00, 0, 0,
        38, 145.0, 0, 0, 5, 0, "", 0, 0, -3448, 200.0, 52.50, 60, 3, 5.0, 0, 0, "100%", 0, 0, 0, 0, "", "2026-08-11 08:00 PM"
      ]
    ];

    for (let i = 0; i < seedLedgerRows.length; i++) {
      ledgerSheet.appendRow(seedLedgerRows[i]);
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

function formatDateCell(val, ss) {
  if (!val) return "";
  if (val instanceof Date) {
    try {
      var tz = ss ? ss.getSpreadsheetTimeZone() : Session.getScriptTimeZone();
      return Utilities.formatDate(val, tz || "GMT+6", "yyyy-MM-dd");
    } catch (e) {
      var year = val.getFullYear();
      var month = ("0" + (val.getMonth() + 1)).slice(-2);
      var day = ("0" + val.getDate()).slice(-2);
      return year + "-" + month + "-" + day;
    }
  }
  return val;
}

function handleGetOrderPlans(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
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
        val = formatDateCell(val, ss);
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

function handleSaveOrderPlans(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = getOrderPlanSheetInternal();
  if (!sheet) {
    sheet = ss.insertSheet("Order Plan & Status");
  }

  const orders = payload.orderPlans || (payload.data && payload.data.orderPlans) || (Array.isArray(payload.data) ? payload.data : null) || (Array.isArray(payload) ? payload : [payload]);
  if (!Array.isArray(orders)) {
    return makeResponse({ success: false, message: "Invalid payload format. Expected orderPlans array." });
  }

  const defaultHeaders = [
    "id", "planMonth", "planType", "ewo", "buyer", "color", "knitStart", "knitEnd", 
    "target", "targetNextMonth", "allocationStart", "allocationEnd", "allocatedQty", 
    "allocatedBal", "greyReq", "knitPro", "knitBal", "aKnitStart", "lastProductionDate", 
    "avgProdDay", "expectedKnitEnd", "knitStartOtd", "knitEndOtd", "knitStartRemarks", "knitEndRemarks", "knitTeamLeaders"
  ];

  let data = sheet.getDataRange().getValues();
  if (!data || data.length === 0 || !data[0] || data[0].length === 0) {
    sheet.getRange(1, 1, 1, defaultHeaders.length).setValues([defaultHeaders]);
    data = [defaultHeaders];
  }

  const rawHeaders = data[0];
  const normHeaders = rawHeaders.map(function(h) { return normalizeHeaderName(h); });

  const isReplace = payload.replace === true || payload.mode === "replace" || payload.overwrite === true || (payload.data && (payload.data.replace === true || payload.data.mode === "replace" || payload.data.overwrite === true));

  if (isReplace) {
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
    }

    if (orders.length === 0) {
      return makeResponse({ success: true, message: "Sheet cleared successfully.", count: 0 });
    }

    const matrix = orders.map(function(ord, idx) {
      const ordId = (ord.id || ("ord-" + Date.now() + "-" + (idx + 1))).toString().trim();
      return normHeaders.map(function(h, colIdx) {
        if (h === "id") return ordId;
        const origHeader = rawHeaders[colIdx];
        let val = ord[h];
        if (val === undefined || val === null) val = ord[origHeader];
        if (val === undefined || val === null) return "";
        if (typeof val === "object") return JSON.stringify(val);
        return val;
      });
    });

    sheet.getRange(2, 1, matrix.length, normHeaders.length).setValues(matrix);

    return makeResponse({
      success: true,
      message: "Successfully replaced " + orders.length + " order plans in Google Sheets.",
      count: orders.length
    });
  }

  const idCol = normHeaders.indexOf("id");
  const existingMap = {};
  for (let i = 1; i < data.length; i++) {
    if (idCol >= 0 && data[i][idCol]) {
      existingMap[data[i][idCol].toString().trim()] = i + 1;
    }
  }

  const newRowsToAppend = [];

  orders.forEach(function(ord, idx) {
    const ordId = (ord.id || ("ord-" + Date.now() + "-" + (idx + 1))).toString().trim();
    const newRow = normHeaders.map(function(h, colIdx) {
      if (h === "id") return ordId;
      const origHeader = rawHeaders[colIdx];
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
      newRowsToAppend.push(newRow);
    }
  });

  if (newRowsToAppend.length > 0) {
    const startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, newRowsToAppend.length, normHeaders.length).setValues(newRowsToAppend);
  }

  return makeResponse({
    success: true,
    message: "Saved " + orders.length + " order plans to Google Sheets successfully.",
    count: orders.length
  });
}

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

function handleGetYarnAllocations(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
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
        val = formatDateCell(val, ss);
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

function handleSaveYarnAllocations(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = getYarnSheetInternal();
  if (!sheet) {
    sheet = ss.insertSheet("Yarn Allocation");
  }

  const items = payload.yarnAllocations || (payload.data && payload.data.yarnAllocations) || (Array.isArray(payload.data) ? payload.data : null) || (Array.isArray(payload) ? payload : [payload]);
  if (!Array.isArray(items)) {
    return makeResponse({ success: false, message: "Invalid payload format. Expected yarnAllocations array." });
  }

  const defaultHeaders = [
    "id", "actualRequisitionDate", "buyer", "orderNumber", "fabricsType", "fabricShade", 
    "fabricGsm", "yarnRequired", "lotRef", "allocatedYarn", "lotNo", "spinnersName", 
    "allocationStatus", "yarnStockStatus", "yarnDeliveryStatus", "proposedAllocationDate", 
    "allocationDateRange", "allocationNo", "yarnRqQty", "allocatedQty", 
    "balance", "remarks"
  ];

  let data = sheet.getDataRange().getValues();
  if (!data || data.length === 0 || !data[0] || data[0].length === 0) {
    sheet.getRange(1, 1, 1, defaultHeaders.length).setValues([defaultHeaders]);
    data = [defaultHeaders];
  }

  const rawHeaders = data[0];
  const normHeaders = rawHeaders.map(function(h) { return normalizeHeaderName(h); });

  const isReplace = payload.replace === true || payload.mode === "replace" || payload.overwrite === true || (payload.data && (payload.data.replace === true || payload.data.mode === "replace" || payload.data.overwrite === true));

  if (isReplace) {
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
    }

    if (items.length === 0) {
      return makeResponse({ success: true, message: "Sheet cleared successfully.", count: 0 });
    }

    const matrix = items.map(function(yarnItem, idx) {
      const itemId = (yarnItem.id || ("yarn-" + Date.now() + "-" + (idx + 1))).toString().trim();
      return normHeaders.map(function(h, colIdx) {
        if (h === "id") return itemId;
        const origHeader = rawHeaders[colIdx];
        let val = yarnItem[h];
        if (val === undefined || val === null) val = yarnItem[origHeader];
        if (val === undefined || val === null) return "";
        if (typeof val === "object") return JSON.stringify(val);
        return val;
      });
    });

    sheet.getRange(2, 1, matrix.length, normHeaders.length).setValues(matrix);

    return makeResponse({
      success: true,
      message: "Successfully replaced " + items.length + " yarn allocation records in Google Sheets.",
      count: items.length
    });
  }

  const idCol = normHeaders.indexOf("id");
  const existingMap = {};
  for (let i = 1; i < data.length; i++) {
    if (idCol >= 0 && data[i][idCol]) {
      existingMap[data[i][idCol].toString().trim()] = i + 1;
    }
  }

  const newRowsToAppend = [];

  items.forEach(function(yarnItem, idx) {
    const itemId = (yarnItem.id || ("yarn-" + Date.now() + "-" + (idx + 1))).toString().trim();
    const newRow = normHeaders.map(function(h, colIdx) {
      if (h === "id") return itemId;
      const origHeader = rawHeaders[colIdx];
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
      newRowsToAppend.push(newRow);
    }
  });

  if (newRowsToAppend.length > 0) {
    const startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, newRowsToAppend.length, normHeaders.length).setValues(newRowsToAppend);
  }

  return makeResponse({
    success: true,
    message: "Saved " + items.length + " yarn allocation records to Google Sheets successfully.",
    count: items.length
  });
}

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

// ==========================================================
// 3. PRODUCTION LEDGER HANDLERS
// ==========================================================

function getLedgerSheetInternal() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName("Production Ledger") || ss.getSheetByName("Production_Ledger") || ss.getSheetByName("Ledger");
}

function handleGetLedgerRecords(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getLedgerSheetInternal();
  if (!sheet) {
    return makeResponse({ success: true, data: [] });
  }

  const data = sheet.getDataRange().getValues();
  if (!data || data.length < 2) {
    return makeResponse({ success: true, data: [] });
  }

  const rawHeaders = data[0];
  const normalizedHeaders = rawHeaders.map(function(h) { return normalizeHeaderName(h); });
  const ledgerRecords = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const item = {};
    for (let j = 0; j < normalizedHeaders.length; j++) {
      let val = row[j];
      if (val instanceof Date) {
        val = formatDateCell(val, ss);
      }
      const propKey = normalizedHeaders[j] || ("col_" + j);
      item[propKey] = val;
    }
    if (item.id || item.date || item.floor) {
      ledgerRecords.push(item);
    }
  }

  return makeResponse({
    success: true,
    count: ledgerRecords.length,
    data: ledgerRecords
  });
}

function handleSaveLedgerRecords(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = getLedgerSheetInternal();
  if (!sheet) {
    sheet = ss.insertSheet("Production Ledger");
  }

  let records = payload.records || payload.ledger || (payload.data && (payload.data.records || payload.data.ledger)) || (Array.isArray(payload.data) ? payload.data : null);
  if (!records && payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)) {
    records = [payload.data];
  } else if (!records && payload.id) {
    records = [payload];
  } else if (!Array.isArray(records)) {
    records = [records];
  }

  records = records.filter(function(r) { return r && typeof r === "object"; });

  const defaultHeaders = [
    "id", "unit", "year", "month", "date", "day", "floor", "target", "shiftA", "shiftB", "shiftC", 
    "totalProduction", "targetBulk", "bulkProd", "sampleProd", "totalMachines", "runningBulk", "runningSample", 
    "runningMachine", "idleMc", "machineUtilization", "idleMcPct", "idleProduction", "efficiency", 
    "proPerMc", "reject", "rejectPct", "hold", "holdPct", "jhuteCutpcs", "jhuteCutpcsPct", 
    "needleBroken", "needlePerKg", "sinkerBroken", "sinkerPerKg", "oilConsumption", "beltBroken", 
    "otherSparePartsName", "otherSparePartsQty", "setChangePcs", "productionLossForEff", 
    "prodLossForSample", "capacityUtilization", "totalOperator", "absent", "absentPct", 
    "productionFlatKnit", "achievmentCircular", "otd", "yarnIssued", "totalRunningFactories", 
    "numberVehicles", "fabricReturn", "remarks", "lastUpdated"
  ];

  let data = sheet.getDataRange().getValues();
  if (!data || data.length === 0 || !data[0] || data[0].length === 0) {
    sheet.getRange(1, 1, 1, defaultHeaders.length).setValues([defaultHeaders]);
    data = [defaultHeaders];
  }

  let rawHeaders = data[0].map(function(h) { return h ? h.toString().trim() : ""; });
  let normHeaders = rawHeaders.map(function(h) { return normalizeHeaderName(h); });

  // Auto-expand sheet headers if any default headers are missing in Google Sheet
  var missingHeaders = [];
  defaultHeaders.forEach(function(dh) {
    var normDh = normalizeHeaderName(dh);
    if (normHeaders.indexOf(normDh) === -1) {
      missingHeaders.push(dh);
    }
  });

  if (missingHeaders.length > 0) {
    var currentLastCol = sheet.getLastColumn();
    sheet.getRange(1, currentLastCol + 1, 1, missingHeaders.length).setValues([missingHeaders]);
    rawHeaders = rawHeaders.concat(missingHeaders);
    normHeaders = rawHeaders.map(function(h) { return normalizeHeaderName(h); });
  }

  const isReplace = payload.replace === true || payload.mode === "replace" || (payload.data && payload.data.replace === true);

  if (isReplace) {
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
    }

    if (records.length === 0) {
      return makeResponse({ success: true, message: "Ledger sheet cleared.", count: 0 });
    }

    const matrix = records.map(function(rec, idx) {
      const recId = (rec.id || ("rec-" + (rec.date || Date.now()) + "-" + (rec.floor || "unit") + "-" + (idx + 1))).toString().trim();
      return normHeaders.map(function(h, colIdx) {
        if (h === "id") return recId;
        const origHeader = rawHeaders[colIdx];
        return extractLedgerColumnValue(rec, h, origHeader);
      });
    });

    sheet.getRange(2, 1, matrix.length, normHeaders.length).setValues(matrix);

    return makeResponse({
      success: true,
      message: "Successfully replaced " + records.length + " ledger records in Google Sheets.",
      count: records.length
    });
  }

  const idCol = normHeaders.indexOf("id");
  const existingMap = {};
  for (let i = 1; i < data.length; i++) {
    if (idCol >= 0 && data[i][idCol]) {
      existingMap[data[i][idCol].toString().trim()] = i + 1;
    }
  }

  const newRowsToAppend = [];

  records.forEach(function(rec, idx) {
    const recId = (rec.id || ("rec-" + (rec.date || Date.now()) + "-" + (rec.floor || "unit") + "-" + (idx + 1))).toString().trim();
    const newRow = normHeaders.map(function(h, colIdx) {
      if (h === "id") return recId;
      const origHeader = rawHeaders[colIdx];
      return extractLedgerColumnValue(rec, h, origHeader);
    });

    if (existingMap[recId]) {
      const rowIndex = existingMap[recId];
      sheet.getRange(rowIndex, 1, 1, normHeaders.length).setValues([newRow]);
    } else {
      newRowsToAppend.push(newRow);
    }
  });

  if (newRowsToAppend.length > 0) {
    const startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, newRowsToAppend.length, normHeaders.length).setValues(newRowsToAppend);
  }

  return makeResponse({
    success: true,
    message: "Saved " + records.length + " production ledger records to Google Sheets successfully.",
    count: records.length,
    id: records[0] ? records[0].id : null
  });
}

function extractLedgerColumnValue(rec, normKey, origHeader) {
  if (!rec || typeof rec !== "object") return "";
  
  var val = rec[normKey];
  if (val === undefined || val === null || val === "") {
    if (origHeader && rec[origHeader] !== undefined && rec[origHeader] !== null) {
      val = rec[origHeader];
    }
  }

  // Alias & alternate naming lookups
  if (val === undefined || val === null || val === "") {
    if (normKey === "idleMc") val = rec.idleMachine;
    else if (normKey === "idleMcPct") val = rec.idleMachinePct;
    else if (normKey === "proPerMc") val = rec.productionPerMachine;
    else if (normKey === "setChangePcs") val = rec.setChange;
    else if (normKey === "productionLossForEff") val = rec.productionLossForEfficiency;
    else if (normKey === "totalRunningFactories") val = rec.runningFactories;
    else if (normKey === "achievmentCircular") val = rec.achievementCircular;
    else if (normKey === "day" && rec.date) {
      try {
        var d = new Date(rec.date);
        var days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        if (!isNaN(d.getDay())) val = days[d.getDay()];
      } catch (e) {}
    }
  }

  if (val === undefined || val === null) return "";
  if (typeof val === "object") return JSON.stringify(val);
  return val;
}

function handleDeleteLedgerRecord(payload) {
  const sheet = getLedgerSheetInternal();
  if (!sheet) {
    return makeResponse({ success: false, message: "Production Ledger sheet does not exist." });
  }

  const id = payload.id || (payload.data && payload.data.id);
  if (!id) {
    return makeResponse({ success: false, message: "Record ID is required for deletion." });
  }

  const data = sheet.getDataRange().getValues();
  if (!data || data.length < 2) {
    return makeResponse({ success: false, message: "No records found in sheet." });
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
        message: "Production record successfully deleted from Google Sheets."
      });
    }
  }

  return makeResponse({
    success: true,
    message: "Production record deleted or not found in Google Sheets."
  });
}
