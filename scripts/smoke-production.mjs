import ExcelJS from "exceljs";

import { CAMPAIGN_XLSX_VERSION, openM2CampaignApplication } from "../dist/index.js";

if (CAMPAIGN_XLSX_VERSION !== 1 || typeof ExcelJS.Workbook !== "function") {
  throw new Error("Production XLSX module interop is invalid.");
}

const application = openM2CampaignApplication({ filename: ":memory:" });
application.close();
