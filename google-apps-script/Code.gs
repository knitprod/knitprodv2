/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Epyllion Knitex Ltd. - Knitting Performance System
 * High-Concurrency Production Google Apps Script (GAS) Web App Backend
 * 
 * Optimized for:
 * 1. Single-request bulk fetching of all datasets (Order Plans, Yarn Allocations, Production Ledger, Dashboard)
 * 2. High-performance CacheService zero-cost caching (10s read cache)
 * 3. LockService write queuing (10,000ms timeout) to prevent multi-user write conflicts
 * 4. Automatic cache invalidation upon mutation
 */

// ==========================================================
// CONFIGURATION & GLOBAL CONSTANTS
// ==========================================================
var VERSION = "4.0.0-BulkSyncAndLock";
var CACHE_TTL_SECONDS = 10; // 10-second raw read cache in CacheService
var LOCK_TIMEOUT_MS = 10000; // 10,000ms timeout for script write lock

// Cache keys for invalidation
var CACHE_KEYS = [
  "bulk_read_all",
  "bulk_read_orders",
  "bulk_read_yarn",
  "bulk_read_ledger",
  "bulk_read_dashboard",
  "bulk_read_health"
];

// ==========================================================
// WEB APP ROUTING HOOKS (GET & POST)
// ==========================================================

/**
 * Handles all HTTP GET requests.
 * By default (or with action=all / action=bulk), fetches all sheets in ONE single JSON payload.
 * Uses CacheService to serve reads instantly with zero Google API quota consumption.
 */
function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) ? e.parameter.action.toString().trim() : "all";
    var forceRefresh = (e && e.parameter && (e.parameter.refresh === "true" || e.parameter.force === "true"));
    var cacheKey = "bulk_read_" + (action ? action.replace(/[^a-zA-Z0-9_]/g, "_") : "all");

    // 1. Check CacheService (unless forceRefresh is requested)
    if (!forceRefresh) {
      try {
        var cache = CacheService.getScriptCache();
        var cachedData = cache.get(cacheKey);
        if (cachedData) {
          return ContentService.createTextOutput(cachedData)
            .setMimeType(ContentService.MimeType.JSON);
        }
      } catch (cacheErr) {
        // Cache read fallback to live sheet read
      }
    }

    // Auto-bootstrap required sheets if missing
    initializeDatabase();

    var responseObj;

    // Route requests
    switch (action) {
      case "all":
      case "bulk":
      case "":
        responseObj = handleGetAllDatasets(e);
        break;
      case "orders/list":
      case "orders":
        responseObj = handleGetOrderPlans(e);
        break;
      case "yarn/list":
      case "yarn":
        responseObj = handleGetYarnAllocations(e);
        break;
      case "ledger/list":
      case "ledger":
      case "production/list":
      case "production":
        responseObj = handleGetLedgerRecords(e);
        break;
      case "health":
        responseObj = {
          success: true,
          message: "Epyllion Knitting Performance REST API is online.",
          version: VERSION,
          timestamp: new Date().toISOString(),
          connectedSheets: ["Order Plan & Status", "Yarn Allocation", "Production Ledger"]
        };
        break;
      default:
        // Default to all datasets for any unmatched action
        responseObj = handleGetAllDatasets(e);
        break;
    }

    var jsonString = JSON.stringify(responseObj);

    // Store in CacheService for 10 seconds (if within 100KB limit)
    try {
      if (jsonString.length < 98000) {
        var cache = CacheService.getScriptCache();
        cache.put(cacheKey, jsonString, CACHE_TTL_SECONDS);
        if (action !== "all" && action !== "bulk") {
          // Keep bulk_read_all updated
        }
      }
    } catch (cachePutErr) {
      // Ignore cache put overflow
    }

    return ContentService.createTextOutput(jsonString)
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return makeResponse({
      success: false,
      message: "Server Error: " + error.toString(),
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Handles all HTTP POST requests with LockService concurrency protection.
 * Queues concurrent saves from 10–15 users, executes atomic updates, and purges read caches.
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  var hasLock = false;

  try {
    // Acquire exclusive write lock with 10,000ms timeout
    hasLock = lock.waitLock(LOCK_TIMEOUT_MS);
    if (!hasLock) {
      return makeResponse({
        success: false,
        message: "Server is busy processing another update. Please retry in a moment.",
        code: "LOCK_TIMEOUT"
      });
    }

    // Auto-bootstrap required sheets if missing
    initializeDatabase();

    var postData = {};
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

    var action = postData.action || (e && e.parameter ? e.parameter.action : "");
    if (!action) {
      return makeResponse({
        success: false,
        message: "Action parameter is missing in POST request."
      });
    }

    var result;

    // Route POST actions
    switch (action) {
      case "bulk/save":
        result = handleSaveBulkDatasets(postData);
        break;
      case "orders/save":
        result = handleSaveOrderPlans(postData);
        break;
      case "orders/delete":
        result = handleDeleteOrderPlan(postData);
        break;
      case "yarn/save":
        result = handleSaveYarnAllocations(postData);
        break;
      case "yarn/delete":
        result = handleDeleteYarnAllocation(postData);
        break;
      case "ledger/save":
      case "ledger/add":
      case "ledger/update":
      case "production/add":
      case "production/update":
        result = handleSaveLedgerRecords(postData);
        break;
      case "ledger/delete":
      case "production/delete":
        result = handleDeleteLedgerRecord(postData);
        break;
      default:
        result = {
          success: false,
          message: "Invalid POST action: " + action
        };
        break;
    }

    // On successful write mutation, purge read cache so next reads fetch fresh data immediately
    if (result && result.success !== false) {
      purgeReadCache();
    }

    return makeResponse(result);

  } catch (error) {
    return makeResponse({
      success: false,
      message: "Server POST Error: " + error.toString()
    });
  } finally {
    // Release the script lock immediately in finally block
    if (hasLock) {
      try {
        lock.releaseLock();
      } catch (lockReleaseErr) {
        // Ignored
      }
    }
  }
}

/**
 * Purges all read cache entries in CacheService.
 */
function purgeReadCache() {
  try {
    var cache = CacheService.getScriptCache();
    cache.removeAll(CACHE_KEYS);
  } catch (e) {
    // Cache purge safe fallback
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
// BULK DATASET HANDLER (ALL TABS IN SINGLE ROUND TRIP)
// ==========================================================

/**
 * Fetches all sheets and summaries in ONE single spreadsheet call.
 */
function handleGetAllDatasets(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  var orderPlans = getOrderPlansInternal(ss);
  var yarnAllocations = getYarnAllocationsInternal(ss);
  var ledger = getLedgerRecordsInternal(ss);

  // Compute floor & KPI summary
  var summary = computeDashboardSummary(ledger);

  return {
    success: true,
    version: VERSION,
    timestamp: new Date().toISOString(),
    data: {
      orderPlans: orderPlans,
      yarnAllocations: yarnAllocations,
      ledger: ledger,
      floors: summary.floors,
      kpis: summary.kpis,
      totalOrders: orderPlans.length,
      totalYarn: yarnAllocations.length,
      totalLedger: ledger.length
    }
  };
}

/**
 * Handles bulk save of multiple collections in one atomic lock.
 */
function handleSaveBulkDatasets(payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var saved = { orders: 0, yarn: 0, ledger: 0 };

  if (payload.orderPlans && Array.isArray(payload.orderPlans)) {
    handleSaveOrderPlansInternal(ss, payload.orderPlans, payload.replace === true);
    saved.orders = payload.orderPlans.length;
  }

  if (payload.yarnAllocations && Array.isArray(payload.yarnAllocations)) {
    handleSaveYarnAllocationsInternal(ss, payload.yarnAllocations, payload.replace === true);
    saved.yarn = payload.yarnAllocations.length;
  }

  if (payload.ledger && Array.isArray(payload.ledger)) {
    handleSaveLedgerRecordsInternal(ss, payload.ledger, payload.replace === true);
    saved.ledger = payload.ledger.length;
  }

  return {
    success: true,
    message: "Bulk datasets saved successfully with lock protection.",
    saved: saved
  };
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
  if (str === "idlemcpct" || str === "idlemachinepct" || str === "idlemachinepercent") return "idleMcPct";
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

function getSheetCaseInsensitive(ss, candidateNames) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  for (var c = 0; c < candidateNames.length; c++) {
    var s = ss.getSheetByName(candidateNames[c]);
    if (s) return s;
  }
  // Try case-insensitive / whitespace-trimmed matching
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var name = sheets[i].getName().trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    for (var j = 0; j < candidateNames.length; j++) {
      var cand = candidateNames[j].trim().toLowerCase().replace(/[^a-z0-9]/g, "");
      if (name === cand || name.indexOf(cand) >= 0 || cand.indexOf(name) >= 0) {
        return sheets[i];
      }
    }
  }
  return null;
}

// ==========================================================
// 1. ORDER PLAN & STATUS MODULE
// ==========================================================

function getOrderPlanSheetInternal(ss) {
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();
  return getSheetCaseInsensitive(ss, ["Order Plan & Status", "Order_Plans", "Order Plan", "Order Plans", "Orders"]);
}

function getOrderPlansInternal(ss) {
  var sheet = getOrderPlanSheetInternal(ss);
  if (!sheet) return [];

  var data = sheet.getDataRange().getValues();
  if (!data || data.length < 2) return [];

  var rawHeaders = data[0];
  var normalizedHeaders = rawHeaders.map(function(h) { return normalizeHeaderName(h); });
  var orderPlans = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var item = {};
    for (var j = 0; j < normalizedHeaders.length; j++) {
      var val = row[j];
      if (val instanceof Date) {
        val = formatDateCell(val, ss);
      }
      var propKey = normalizedHeaders[j] || ("col_" + j);
      item[propKey] = val;
    }
    if (!item.id || item.id === "") {
      item.id = "ord-" + (item.ewo || item.buyer || "order") + "-" + (item.color || "") + "-" + i;
    }
    if (item.id || item.ewo || item.buyer) {
      orderPlans.push(item);
    }
  }
  return orderPlans;
}

function handleGetOrderPlans(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var orders = getOrderPlansInternal(ss);
  return {
    success: true,
    count: orders.length,
    data: orders
  };
}

function handleSaveOrderPlans(payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var orders = payload.orderPlans || (payload.data && payload.data.orderPlans) || (Array.isArray(payload.data) ? payload.data : null) || (Array.isArray(payload) ? payload : [payload]);
  if (!Array.isArray(orders)) {
    return { success: false, message: "Invalid payload format. Expected orderPlans array." };
  }
  var isReplace = payload.replace === true || payload.mode === "replace" || payload.overwrite === true || (payload.data && (payload.data.replace === true || payload.data.mode === "replace"));
  return handleSaveOrderPlansInternal(ss, orders, isReplace);
}

function handleSaveOrderPlansInternal(ss, orders, isReplace) {
  var sheet = getOrderPlanSheetInternal(ss);
  if (!sheet) {
    sheet = ss.insertSheet("Order Plan & Status");
  }

  var defaultHeaders = [
    "id", "planMonth", "planType", "ewo", "buyer", "color", "knitStart", "knitEnd", 
    "target", "targetNextMonth", "allocationStart", "allocationEnd", "allocatedQty", 
    "allocatedBal", "greyReq", "knitPro", "knitBal", "aKnitStart", "lastProductionDate", 
    "avgProdDay", "expectedKnitEnd", "knitStartOtd", "knitEndOtd", "knitStartRemarks", "knitEndRemarks", "knitTeamLeaders"
  ];

  var data = sheet.getDataRange().getValues();
  if (!data || data.length === 0 || !data[0] || data[0].length === 0) {
    sheet.getRange(1, 1, 1, defaultHeaders.length).setValues([defaultHeaders]);
    data = [defaultHeaders];
  }

  var rawHeaders = data[0];
  var normHeaders = rawHeaders.map(function(h) { return normalizeHeaderName(h); });

  if (isReplace) {
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
    }

    if (orders.length === 0) {
      return { success: true, message: "Sheet cleared successfully.", count: 0 };
    }

    var matrix = orders.map(function(ord, idx) {
      var ordId = (ord.id || ("ord-" + (ord.ewo || Date.now()) + "-" + (idx + 1))).toString().trim();
      return normHeaders.map(function(h, colIdx) {
        if (h === "id") return ordId;
        var origHeader = rawHeaders[colIdx];
        var val = ord[h];
        if (val === undefined || val === null) val = ord[origHeader];
        if (val === undefined || val === null) return "";
        if (typeof val === "object") return JSON.stringify(val);
        return val;
      });
    });

    sheet.getRange(2, 1, matrix.length, normHeaders.length).setValues(matrix);
    return {
      success: true,
      message: "Successfully replaced " + orders.length + " order plans in Google Sheets.",
      count: orders.length
    };
  }

  var idCol = normHeaders.indexOf("id");
  var ewoCol = normHeaders.indexOf("ewo");
  var colorCol = normHeaders.indexOf("color");
  var buyerCol = normHeaders.indexOf("buyer");
  var planMonthCol = normHeaders.indexOf("planMonth");

  var existingMap = {};
  for (var i = 1; i < data.length; i++) {
    var rIndex = i + 1;
    var row = data[i];
    var rId = (idCol >= 0 && row[idCol]) ? row[idCol].toString().trim() : "";
    var rEwo = (ewoCol >= 0 && row[ewoCol]) ? row[ewoCol].toString().trim() : "";
    var rColor = (colorCol >= 0 && row[colorCol]) ? row[colorCol].toString().trim() : "";
    var rBuyer = (buyerCol >= 0 && row[buyerCol]) ? row[buyerCol].toString().trim() : "";
    var rMonth = (planMonthCol >= 0 && row[planMonthCol]) ? row[planMonthCol].toString().trim() : "";

    if (rId) existingMap["id:" + rId.toLowerCase()] = rIndex;
    if (rEwo) existingMap["ewo:" + rEwo.toLowerCase()] = rIndex;
    if (rEwo && rColor) existingMap["ewoColor:" + (rEwo + "|" + rColor).toLowerCase()] = rIndex;
    if (rBuyer && rColor && rMonth) existingMap["buyerColorMonth:" + (rBuyer + "|" + rColor + "|" + rMonth).toLowerCase()] = rIndex;
  }

  var newRowsToAppend = [];

  orders.forEach(function(ord, idx) {
    var ordId = (ord.id || ("ord-" + (ord.ewo || Date.now()) + "-" + (idx + 1))).toString().trim();
    var ordEwo = (ord.ewo || "").toString().trim();
    var ordColor = (ord.color || "").toString().trim();
    var ordBuyer = (ord.buyer || "").toString().trim();
    var ordMonth = (ord.planMonth || "").toString().trim();

    var matchedRowIndex = existingMap["id:" + ordId.toLowerCase()] ||
      (ordEwo && ordColor ? existingMap["ewoColor:" + (ordEwo + "|" + ordColor).toLowerCase()] : 0) ||
      (ordEwo ? existingMap["ewo:" + ordEwo.toLowerCase()] : 0) ||
      (ordBuyer && ordColor && ordMonth ? existingMap["buyerColorMonth:" + (ordBuyer + "|" + ordColor + "|" + ordMonth).toLowerCase()] : 0);

    var newRow = normHeaders.map(function(h, colIdx) {
      if (h === "id") return ordId;
      var origHeader = rawHeaders[colIdx];
      var val = ord[h];
      if (val === undefined || val === null) val = ord[origHeader];
      if (val === undefined || val === null) return "";
      if (typeof val === "object") return JSON.stringify(val);
      return val;
    });

    if (matchedRowIndex && matchedRowIndex > 1) {
      sheet.getRange(matchedRowIndex, 1, 1, normHeaders.length).setValues([newRow]);
    } else {
      newRowsToAppend.push(newRow);
    }
  });

  if (newRowsToAppend.length > 0) {
    var startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, newRowsToAppend.length, normHeaders.length).setValues(newRowsToAppend);
  }

  return {
    success: true,
    message: "Saved " + orders.length + " order plans to Google Sheets successfully.",
    count: orders.length
  };
}

function handleDeleteOrderPlan(payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getOrderPlanSheetInternal(ss);
  if (!sheet) {
    return { success: false, message: "Order Plan & Status sheet does not exist." };
  }

  var id = payload.id || (payload.data && payload.data.id) || payload.ewo;
  if (!id) {
    return { success: false, message: "Order plan ID or EWO number is required for deletion." };
  }

  var data = sheet.getDataRange().getValues();
  if (!data || data.length < 2) {
    return { success: false, message: "No order plans found in sheet." };
  }

  var rawHeaders = data[0];
  var normHeaders = rawHeaders.map(function(h) { return normalizeHeaderName(h); });
  var idCol = normHeaders.indexOf("id");
  var ewoCol = normHeaders.indexOf("ewo");
  var targetId = id.toString().trim().toLowerCase();

  for (var i = 1; i < data.length; i++) {
    var rowId = (idCol >= 0 && data[i][idCol]) ? data[i][idCol].toString().trim().toLowerCase() : "";
    var rowEwo = (ewoCol >= 0 && data[i][ewoCol]) ? data[i][ewoCol].toString().trim().toLowerCase() : "";

    if ((rowId && rowId === targetId) || (rowEwo && rowEwo === targetId)) {
      sheet.deleteRow(i + 1);
      return {
        success: true,
        message: "Order plan successfully deleted from Google Sheets."
      };
    }
  }

  return {
    success: true,
    message: "Order plan deleted or not found in Google Sheets."
  };
}

// ==========================================================
// 2. YARN ALLOCATION MODULE
// ==========================================================

function getYarnSheetInternal(ss) {
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();
  return getSheetCaseInsensitive(ss, ["Yarn Allocation", "Yarn_Allocation", "YarnAllocation", "Yarn", "Yarn Allocation Summary"]);
}

function getYarnAllocationsInternal(ss) {
  var sheet = getYarnSheetInternal(ss);
  if (!sheet) return [];

  var data = sheet.getDataRange().getValues();
  if (!data || data.length < 2) return [];

  var rawHeaders = data[0];
  var normalizedHeaders = rawHeaders.map(function(h) { return normalizeHeaderName(h); });
  var yarnAllocations = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var item = {};
    for (var j = 0; j < normalizedHeaders.length; j++) {
      var val = row[j];
      if (val instanceof Date) {
        val = formatDateCell(val, ss);
      }
      var propKey = normalizedHeaders[j] || ("col_" + j);
      item[propKey] = val;
    }
    if (!item.id || item.id === "") {
      item.id = "yarn-" + (item.orderNumber || "ord") + "-" + (item.allocationNo || item.fabricShade || item.lotNo || i);
    }
    if (item.id || item.orderNumber || item.allocationNo || item.buyer) {
      yarnAllocations.push(item);
    }
  }
  return yarnAllocations;
}

function handleGetYarnAllocations(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var yarn = getYarnAllocationsInternal(ss);
  return {
    success: true,
    count: yarn.length,
    data: yarn
  };
}

function handleSaveYarnAllocations(payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var items = payload.yarnAllocations || (payload.data && payload.data.yarnAllocations) || (Array.isArray(payload.data) ? payload.data : null) || (Array.isArray(payload) ? payload : [payload]);
  if (!Array.isArray(items)) {
    return { success: false, message: "Invalid payload format. Expected yarnAllocations array." };
  }
  var isReplace = payload.replace === true || payload.mode === "replace" || payload.overwrite === true || (payload.data && (payload.data.replace === true || payload.data.mode === "replace"));
  return handleSaveYarnAllocationsInternal(ss, items, isReplace);
}

function handleSaveYarnAllocationsInternal(ss, items, isReplace) {
  var sheet = getYarnSheetInternal(ss);
  if (!sheet) {
    sheet = ss.insertSheet("Yarn Allocation");
  }

  var defaultHeaders = [
    "id", "actualRequisitionDate", "buyer", "orderNumber", "fabricsType", "fabricShade", 
    "fabricGsm", "yarnRequired", "lotRef", "allocatedYarn", "lotNo", "spinnersName", 
    "allocationStatus", "yarnStockStatus", "yarnDeliveryStatus", "proposedAllocationDate", 
    "allocationDateRange", "allocationNo", "yarnRqQty", "allocatedQty", 
    "balance", "remarks"
  ];

  var data = sheet.getDataRange().getValues();
  if (!data || data.length === 0 || !data[0] || data[0].length === 0) {
    sheet.getRange(1, 1, 1, defaultHeaders.length).setValues([defaultHeaders]);
    data = [defaultHeaders];
  }

  var rawHeaders = data[0];
  var normHeaders = rawHeaders.map(function(h) { return normalizeHeaderName(h); });

  if (isReplace) {
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
    }

    if (items.length === 0) {
      return { success: true, message: "Sheet cleared successfully.", count: 0 };
    }

    var matrix = items.map(function(yarnItem, idx) {
      var itemId = (yarnItem.id || ("yarn-" + (yarnItem.orderNumber || Date.now()) + "-" + (idx + 1))).toString().trim();
      return normHeaders.map(function(h, colIdx) {
        if (h === "id") return itemId;
        var origHeader = rawHeaders[colIdx];
        var val = yarnItem[h];
        if (val === undefined || val === null) val = yarnItem[origHeader];
        if (val === undefined || val === null) return "";
        if (typeof val === "object") return JSON.stringify(val);
        return val;
      });
    });

    sheet.getRange(2, 1, matrix.length, normHeaders.length).setValues(matrix);
    return {
      success: true,
      message: "Successfully replaced " + items.length + " yarn allocation records in Google Sheets.",
      count: items.length
    };
  }

  var idCol = normHeaders.indexOf("id");
  var orderNoCol = normHeaders.indexOf("orderNumber");
  var shadeCol = normHeaders.indexOf("fabricShade");
  var allocNoCol = normHeaders.indexOf("allocationNo");
  var yarnReqCol = normHeaders.indexOf("yarnRequired");
  var lotNoCol = normHeaders.indexOf("lotNo");

  var existingMap = {};
  for (var i = 1; i < data.length; i++) {
    var rIndex = i + 1;
    var row = data[i];
    var rId = (idCol >= 0 && row[idCol]) ? row[idCol].toString().trim() : "";
    var rOrder = (orderNoCol >= 0 && row[orderNoCol]) ? row[orderNoCol].toString().trim() : "";
    var rShade = (shadeCol >= 0 && row[shadeCol]) ? row[shadeCol].toString().trim() : "";
    var rAllocNo = (allocNoCol >= 0 && row[allocNoCol]) ? row[allocNoCol].toString().trim() : "";
    var rYarnReq = (yarnReqCol >= 0 && row[yarnReqCol]) ? row[yarnReqCol].toString().trim() : "";
    var rLotNo = (lotNoCol >= 0 && row[lotNoCol]) ? row[lotNoCol].toString().trim() : "";

    if (rId) existingMap["id:" + rId.toLowerCase()] = rIndex;
    if (rAllocNo) existingMap["allocNo:" + rAllocNo.toLowerCase()] = rIndex;
    if (rOrder && rShade && rYarnReq) existingMap["comp:" + (rOrder + "|" + rShade + "|" + rYarnReq).toLowerCase()] = rIndex;
    if (rOrder && rShade && rLotNo) existingMap["comp2:" + (rOrder + "|" + rShade + "|" + rLotNo).toLowerCase()] = rIndex;
    if (rOrder && rAllocNo) existingMap["comp3:" + (rOrder + "|" + rAllocNo).toLowerCase()] = rIndex;
    if (rOrder && rShade) existingMap["orderShade:" + (rOrder + "|" + rShade).toLowerCase()] = rIndex;
  }

  var newRowsToAppend = [];

  items.forEach(function(yarnItem, idx) {
    var itemId = (yarnItem.id || ("yarn-" + (yarnItem.orderNumber || Date.now()) + "-" + (idx + 1))).toString().trim();
    var itemAllocNo = (yarnItem.allocationNo || "").toString().trim();
    var itemOrder = (yarnItem.orderNumber || "").toString().trim();
    var itemShade = (yarnItem.fabricShade || "").toString().trim();
    var itemYarnReq = (yarnItem.yarnRequired || "").toString().trim();
    var itemLotNo = (yarnItem.lotNo || "").toString().trim();

    var matchedRowIndex = existingMap["id:" + itemId.toLowerCase()] ||
      (itemAllocNo ? existingMap["allocNo:" + itemAllocNo.toLowerCase()] : 0) ||
      (itemOrder && itemShade && itemYarnReq ? existingMap["comp:" + (itemOrder + "|" + itemShade + "|" + itemYarnReq).toLowerCase()] : 0) ||
      (itemOrder && itemShade && itemLotNo ? existingMap["comp2:" + (itemOrder + "|" + itemShade + "|" + itemLotNo).toLowerCase()] : 0) ||
      (itemOrder && itemAllocNo ? existingMap["comp3:" + (itemOrder + "|" + itemAllocNo).toLowerCase()] : 0) ||
      (itemOrder && itemShade ? existingMap["orderShade:" + (itemOrder + "|" + itemShade).toLowerCase()] : 0);

    var newRow = normHeaders.map(function(h, colIdx) {
      if (h === "id") return itemId;
      var origHeader = rawHeaders[colIdx];
      var val = yarnItem[h];
      if (val === undefined || val === null) val = yarnItem[origHeader];
      if (val === undefined || val === null) return "";
      if (typeof val === "object") return JSON.stringify(val);
      return val;
    });

    if (matchedRowIndex && matchedRowIndex > 1) {
      sheet.getRange(matchedRowIndex, 1, 1, normHeaders.length).setValues([newRow]);
    } else {
      newRowsToAppend.push(newRow);
    }
  });

  if (newRowsToAppend.length > 0) {
    var startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, newRowsToAppend.length, normHeaders.length).setValues(newRowsToAppend);
  }

  return {
    success: true,
    message: "Saved " + items.length + " yarn allocation records to Google Sheets successfully.",
    count: items.length
  };
}

function handleDeleteYarnAllocation(payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getYarnSheetInternal(ss);
  if (!sheet) {
    return { success: false, message: "Yarn Allocation sheet does not exist." };
  }

  var id = payload.id || (payload.data && payload.data.id) || payload.orderNumber;
  if (!id) {
    return { success: false, message: "Yarn allocation ID or Order Number is required for deletion." };
  }

  var data = sheet.getDataRange().getValues();
  if (!data || data.length < 2) {
    return { success: false, message: "No yarn allocations found in sheet." };
  }

  var rawHeaders = data[0];
  var normHeaders = rawHeaders.map(function(h) { return normalizeHeaderName(h); });
  var idCol = normHeaders.indexOf("id");
  var orderNoCol = normHeaders.indexOf("orderNumber");
  var allocNoCol = normHeaders.indexOf("allocationNo");
  var targetId = id.toString().trim().toLowerCase();

  for (var i = 1; i < data.length; i++) {
    var rowId = (idCol >= 0 && data[i][idCol]) ? data[i][idCol].toString().trim().toLowerCase() : "";
    var rowOrder = (orderNoCol >= 0 && data[i][orderNoCol]) ? data[i][orderNoCol].toString().trim().toLowerCase() : "";
    var rowAlloc = (allocNoCol >= 0 && data[i][allocNoCol]) ? data[i][allocNoCol].toString().trim().toLowerCase() : "";

    if ((rowId && rowId === targetId) || (rowOrder && rowOrder === targetId) || (rowAlloc && rowAlloc === targetId)) {
      sheet.deleteRow(i + 1);
      return {
        success: true,
        message: "Yarn allocation record successfully deleted from Google Sheets."
      };
    }
  }

  return {
    success: true,
    message: "Yarn allocation record deleted or not found in Google Sheets."
  };
}

// ==========================================================
// 3. PRODUCTION LEDGER MODULE
// ==========================================================

function getLedgerSheetInternal(ss) {
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();
  return getSheetCaseInsensitive(ss, ["Production Ledger", "Production_Ledger", "Ledger", "Daily Production Ledger"]);
}

function getLedgerRecordsInternal(ss) {
  var sheet = getLedgerSheetInternal(ss);
  if (!sheet) return [];

  var data = sheet.getDataRange().getValues();
  if (!data || data.length < 2) return [];

  var rawHeaders = data[0];
  var normalizedHeaders = rawHeaders.map(function(h) { return normalizeHeaderName(h); });
  var ledgerRecords = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var item = {};
    for (var j = 0; j < normalizedHeaders.length; j++) {
      var val = row[j];
      if (val instanceof Date) {
        val = formatDateCell(val, ss);
      }
      var propKey = normalizedHeaders[j] || ("col_" + j);
      item[propKey] = val;
    }
    if (!item.id || item.id === "") {
      item.id = "rec-" + (item.date || "nodate") + "-" + (item.floor || "unit") + "-" + i;
    }
    if (item.id || item.date || item.floor) {
      ledgerRecords.push(item);
    }
  }
  return ledgerRecords;
}

function handleGetLedgerRecords(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var records = getLedgerRecordsInternal(ss);
  return {
    success: true,
    count: records.length,
    data: records
  };
}

function handleSaveLedgerRecords(payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var records = payload.records || payload.ledger || (payload.data && (payload.data.records || payload.data.ledger)) || (Array.isArray(payload.data) ? payload.data : null);
  if (!records && payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)) {
    records = [payload.data];
  } else if (!records && payload.id) {
    records = [payload];
  } else if (!Array.isArray(records)) {
    records = [records];
  }
  records = records.filter(function(r) { return r && typeof r === "object"; });
  var isReplace = payload.replace === true || payload.mode === "replace" || (payload.data && payload.data.replace === true);
  return handleSaveLedgerRecordsInternal(ss, records, isReplace);
}

function handleSaveLedgerRecordsInternal(ss, records, isReplace) {
  var sheet = getLedgerSheetInternal(ss);
  if (!sheet) {
    sheet = ss.insertSheet("Production Ledger");
  }

  var defaultHeaders = [
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

  var data = sheet.getDataRange().getValues();
  if (!data || data.length === 0 || !data[0] || data[0].length === 0) {
    sheet.getRange(1, 1, 1, defaultHeaders.length).setValues([defaultHeaders]);
    data = [defaultHeaders];
  }

  var rawHeaders = data[0].map(function(h) { return h ? h.toString().trim() : ""; });
  var normHeaders = rawHeaders.map(function(h) { return normalizeHeaderName(h); });

  // Auto-expand sheet headers if any default headers are missing
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

  if (isReplace) {
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
    }

    if (records.length === 0) {
      return { success: true, message: "Ledger sheet cleared.", count: 0 };
    }

    var matrix = records.map(function(rec, idx) {
      var recId = (rec.id || ("rec-" + (rec.date || Date.now()) + "-" + (rec.floor || "unit") + "-" + (idx + 1))).toString().trim();
      return normHeaders.map(function(h, colIdx) {
        if (h === "id") return recId;
        var origHeader = rawHeaders[colIdx];
        return extractLedgerColumnValue(rec, h, origHeader);
      });
    });

    sheet.getRange(2, 1, matrix.length, normHeaders.length).setValues(matrix);
    return {
      success: true,
      message: "Successfully replaced " + records.length + " ledger records in Google Sheets.",
      count: records.length
    };
  }

  var idCol = normHeaders.indexOf("id");
  var dateCol = normHeaders.indexOf("date");
  var floorCol = normHeaders.indexOf("floor");
  var unitCol = normHeaders.indexOf("unit");

  var existingMap = {};
  for (var i = 1; i < data.length; i++) {
    var rIndex = i + 1;
    var row = data[i];
    var rId = (idCol >= 0 && row[idCol]) ? row[idCol].toString().trim() : "";
    var rDate = (dateCol >= 0 && row[dateCol]) ? row[dateCol].toString().trim() : "";
    var rFloor = (floorCol >= 0 && row[floorCol]) ? row[floorCol].toString().trim() : "";
    var rUnit = (unitCol >= 0 && row[unitCol]) ? row[unitCol].toString().trim() : "";

    if (rId) existingMap["id:" + rId.toLowerCase()] = rIndex;
    if (rDate && rFloor) existingMap["dateFloor:" + (rDate + "_" + rFloor).toLowerCase()] = rIndex;
    if (rDate && rFloor && rUnit) existingMap["dateFloorUnit:" + (rDate + "_" + rFloor + "_" + rUnit).toLowerCase()] = rIndex;
  }

  var newRowsToAppend = [];

  records.forEach(function(rec, idx) {
    var recId = (rec.id || ("rec-" + (rec.date || Date.now()) + "-" + (rec.floor || "unit") + "-" + (idx + 1))).toString().trim();
    var recDate = (rec.date || "").toString().trim();
    var recFloor = (rec.floor || "").toString().trim();
    var recUnit = (rec.unit || "").toString().trim();

    var matchedRowIndex = existingMap["id:" + recId.toLowerCase()] ||
      (recDate && recFloor ? existingMap["dateFloor:" + (recDate + "_" + recFloor).toLowerCase()] : 0) ||
      (recDate && recFloor && recUnit ? existingMap["dateFloorUnit:" + (recDate + "_" + recFloor + "_" + recUnit).toLowerCase()] : 0);

    var newRow = normHeaders.map(function(h, colIdx) {
      if (h === "id") return recId;
      var origHeader = rawHeaders[colIdx];
      return extractLedgerColumnValue(rec, h, origHeader);
    });

    if (matchedRowIndex && matchedRowIndex > 1) {
      sheet.getRange(matchedRowIndex, 1, 1, normHeaders.length).setValues([newRow]);
    } else {
      newRowsToAppend.push(newRow);
    }
  });

  if (newRowsToAppend.length > 0) {
    var startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, newRowsToAppend.length, normHeaders.length).setValues(newRowsToAppend);
  }

  return {
    success: true,
    message: "Saved " + records.length + " production ledger records to Google Sheets successfully.",
    count: records.length,
    id: records[0] ? records[0].id : null
  };
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
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getLedgerSheetInternal(ss);
  if (!sheet) {
    return { success: false, message: "Production Ledger sheet does not exist." };
  }

  var id = payload.id || (payload.data && payload.data.id);
  if (!id) {
    return { success: false, message: "Record ID is required for deletion." };
  }

  var data = sheet.getDataRange().getValues();
  if (!data || data.length < 2) {
    return { success: false, message: "No records found in sheet." };
  }

  var rawHeaders = data[0];
  var normHeaders = rawHeaders.map(function(h) { return normalizeHeaderName(h); });
  var idCol = normHeaders.indexOf("id");
  var targetId = id.toString().trim().toLowerCase();

  for (var i = 1; i < data.length; i++) {
    var rowId = (idCol >= 0 && data[i][idCol]) ? data[i][idCol].toString().trim().toLowerCase() : "";

    if (rowId && rowId === targetId) {
      sheet.deleteRow(i + 1);
      return {
        success: true,
        message: "Production record successfully deleted from Google Sheets."
      };
    }
  }

  return {
    success: true,
    message: "Production record deleted or not found in Google Sheets."
  };
}

// ==========================================================
// 4. DASHBOARD & KPI COMPUTATION HELPER
// ==========================================================

function computeDashboardSummary(ledgerRecords) {
  var floorConfigs = [
    { id: "ekl", name: "EKL", targetKg: 7500, totalMachines: 48, operators: 110 },
    { id: "efl", name: "EFL", targetKg: 15000, totalMachines: 40, operators: 95 },
    { id: "efl-2", name: "EFL-2", targetKg: 15000, totalMachines: 35, operators: 85 },
    { id: "auto-stripe", name: "Auto Stripe", targetKg: 12000, totalMachines: 24, operators: 50 },
    { id: "efl-ext", name: "EFL-Extension", targetKg: 15000, totalMachines: 32, operators: 65 },
    { id: "esl-ext", name: "ESL-Extension", targetKg: 10000, totalMachines: 18, operators: 40 },
    { id: "sub-contact", name: "Sub-Contact", targetKg: 15000, totalMachines: 0, operators: 0 }
  ];

  if (!ledgerRecords || ledgerRecords.length === 0) {
    var defaultFloors = floorConfigs.map(function(fc) {
      return {
        id: fc.id,
        name: fc.name,
        targetKg: fc.targetKg,
        productionKg: 0,
        runningMachines: fc.totalMachines,
        totalMachines: fc.totalMachines,
        idleMachines: 0,
        achievementPct: 0,
        rejectPct: 0,
        lastUpdated: "Default"
      };
    });
    return { floors: defaultFloors, kpis: [] };
  }

  // Get most recent records per floor
  var latestByFloor = {};
  ledgerRecords.forEach(function(rec) {
    var fName = (rec.floor || "").toString().trim().toUpperCase();
    if (!latestByFloor[fName] || (rec.date && rec.date > (latestByFloor[fName].date || ""))) {
      latestByFloor[fName] = rec;
    }
  });

  var computedFloors = floorConfigs.map(function(fc) {
    var rec = latestByFloor[fc.name.toUpperCase()];
    var prodKg = rec ? (Number(rec.totalProduction) || 0) : 0;
    var target = rec ? (Number(rec.target) || fc.targetKg) : fc.targetKg;
    var runningM = rec ? (Number(rec.runningMachine) || fc.totalMachines) : fc.totalMachines;
    var totalM = rec ? (Number(rec.totalMachines) || fc.totalMachines) : fc.totalMachines;
    var idleM = Math.max(0, totalM - runningM);
    var achPct = target > 0 ? parseFloat(((prodKg / target) * 100).toFixed(1)) : 0;
    var rejPct = rec ? (Number(rec.rejectPct) || 0) : 0;

    return {
      id: fc.id,
      name: fc.name,
      targetKg: target,
      productionKg: prodKg,
      runningMachines: runningM,
      totalMachines: totalM,
      idleMachines: idleM,
      achievementPct: achPct,
      rejectPct: rejPct,
      lastUpdated: rec ? (rec.date || "Synced") : "Synced"
    };
  });

  return { floors: computedFloors, kpis: [] };
}

// ==========================================================
// 5. DATABASE AUTO-INITIALIZER
// ==========================================================

function initializeDatabase() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Order Plan & Status
  var orderPlanSheet = ss.getSheetByName("Order Plan & Status") || ss.getSheetByName("Order_Plans");
  if (!orderPlanSheet) {
    orderPlanSheet = ss.insertSheet("Order Plan & Status");
    var orderHeaders = [
      "id", "planMonth", "planType", "ewo", "buyer", "color", "knitStart", "knitEnd", 
      "target", "targetNextMonth", "allocationStart", "allocationEnd", "allocatedQty", 
      "allocatedBal", "greyReq", "knitPro", "knitBal", "aKnitStart", "lastProductionDate", 
      "avgProdDay", "expectedKnitEnd", "knitStartOtd", "knitEndOtd", "knitStartRemarks", "knitEndRemarks", "knitTeamLeaders"
    ];
    orderPlanSheet.getRange(1, 1, 1, orderHeaders.length).setValues([orderHeaders]);
  }

  // 2. Yarn Allocation
  var yarnSheet = ss.getSheetByName("Yarn Allocation") || ss.getSheetByName("Yarn_Allocation");
  if (!yarnSheet) {
    yarnSheet = ss.insertSheet("Yarn Allocation");
    var yarnHeaders = [
      "id", "actualRequisitionDate", "buyer", "orderNumber", "fabricsType", "fabricShade", 
      "fabricGsm", "yarnRequired", "lotRef", "allocatedYarn", "lotNo", "spinnersName", 
      "allocationStatus", "yarnStockStatus", "yarnDeliveryStatus", "proposedAllocationDate", 
      "allocationDateRange", "allocationNo", "yarnRqQty", "allocatedQty", 
      "balance", "remarks"
    ];
    yarnSheet.getRange(1, 1, 1, yarnHeaders.length).setValues([yarnHeaders]);
  }

  // 3. Production Ledger
  var ledgerSheet = ss.getSheetByName("Production Ledger") || ss.getSheetByName("Production_Ledger") || ss.getSheetByName("Ledger");
  if (!ledgerSheet) {
    ledgerSheet = ss.insertSheet("Production Ledger");
    var ledgerHeaders = [
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
  }
}
