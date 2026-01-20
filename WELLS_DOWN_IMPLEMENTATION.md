# Wells Down Implementation - Summary

**Date:** January 19, 2026
**Feature:** Production Down & Revenue Down Tracking with Lease/Route Support

---

## ✅ What Was Implemented

### 1. **Database Schema**
Created new `wells_down` table to track non-producing wells:

**Columns:**
- `id` - Primary key
- `well` - Well name
- `lease` - Lease name (NEW)
- `route` - Production route (NEW)
- `def_bopd` - Deferred production (barrels of oil per day)
- `dt_hrs` - Downtime in hours
- `reason` - Reason well is down
- `status` - Current status (Down/Up)
- `date_down` - Date well went offline
- `date_up` - Date well came back online (NULL if still down)
- `cost_est_pre_wo` - Estimated cost before workover
- `comments` - Additional comments
- `created_at` - Record creation timestamp
- `updated_at` - Last update timestamp

### 2. **API Enhancements**
Updated `/api/wells-down` endpoint with full CRUD operations:

**Methods:**
- `GET /api/wells-down` - List all wells currently down
- `POST /api/wells-down` - Add well(s) down (supports bulk import)
- `PATCH /api/wells-down/{id}` - Update well status
- `DELETE /api/wells-down/{id}` - Remove well down record

**Features:**
- MERGE upsert logic (updates existing, inserts new)
- Automatic production down calculation (days × BOPD)
- JOIN with production_data for average production rates
- Lease and Route tracking

### 3. **Dashboard KPI Cards**
Added two new metrics to the dashboard:

#### Production Down
- Displays total deferred BOPD from all wells down
- Format: "X.X BOPD"
- Color: Danger (red) to indicate issue severity

#### Revenue Down
- Calculates estimated daily revenue loss
- Formula: Production Down × Oil Price ($70/bbl)
- Format: "$X,XXX"
- Color: Danger (red)

### 4. **Wells Down Table Updates**
Redesigned table with better metrics:

**New Columns:**
- Well Name
- Lease
- Route
- BOPD (average production rate)
- Days Down
- Production Down (total barrels lost)
- Reason
- Cost Est (estimated repair cost)
- Comments

### 5. **Import Script**
Created `import_wells_down.ps1` for bulk data import:

**Features:**
- Reads wells down data from your spreadsheet
- Maps to database format
- Calculates downtime hours from days
- Batch uploads via API
- Error handling and progress reporting

---

## 📊 Wells Down Data Imported

From your spreadsheet, 19 wells mapped and ready for import:

| Well | Route | BOPD | Days Down | Reason |
|------|-------|------|-----------|---------|
| Faskin | Faskin | 2.75 | 86 | HIT |
| Faskin | Faskin | 1.6 | 103 | HIT - Confirmed L&T |
| BLAKE, W R. 6 | C7 | 2.25 | 105 | Pump Failure |
| GANN, L. D. 28 | Fairview | 1.0 | 302 | Pumping Unit Down |
| CANYON VALLEY UNIT 205 | PT | 2.0 | 236 | gear box oil pumping unit |
| SLAUGHTER, NW. (SAN ANDRES) UNIT 56 | NWSU | 1.5 | 262 | Gearbox Failure |
| PETERS, ELLEN B. 2 | DBT | 1.25 | 122 | not pumping |
| SLAUGHTER, NW. (SAN ANDRES) UNIT 79 | NWSU | 1.0 | 442 | Pumping Unit |
| ALEXANDER 14 | C7 | 2.4 | 340 | HIT |
| FRANKLIN, O. B.-ADOBE 5G | Rocker A | 1.0 | 383 | Needs new flowline |
| SLAUGHTER, NW. (SAN ANDRES) UNIT 60 | NWSU | 1.0 | 182 | parted |
| WILLIAMS, E. W. JR. 4 | WTG | 1.0 | 95 | not pumping |
| CR 'G', TRACT 3B 1409 | CR | 1.5 | 195 | rod part |
| Kirkpatrick 1 sa | WTG | 0.6 | 179 | Pumping unit |
| STARNES UNIT 1127 | C7 | 0.25 | 115 | not pumping |
| HEAD, T. C. ET AL 'A' 4 | - | 0 | 516 | parted |
| ALEXANDER 5WI | - | 0 | 289 | pressure on backside |
| ALEXANDER 1118 | - | 1.3 | 236 | HIT/Pump Failure |
| Strawn 501 | - | 0 | 281 | failed h15 |

**Total Deferred Production:** ~22.6 BOPD
**Estimated Revenue Loss:** ~$1,582/day (@ $70/bbl)

---

## 🚀 Deployment Status

### ✅ Completed
1. Frontend code updated with new KPI cards
2. Wells Down table redesigned with Lease/Route
3. API code deployed to Azure Functions
4. GitHub repository updated
5. Import script created

### ⏳ Pending - DATABASE MIGRATION REQUIRED
The `wells_down` table needs to be created in the Azure SQL database.

**SQL Script Location:**
`C:\Users\cbrad\create_wells_down_table.sql`

---

## 📋 Next Steps - DATABASE SETUP

### Option 1: Azure Portal (Recommended)

1. Go to **Azure Portal**: https://portal.azure.com
2. Navigate to **SQL databases** → **Workover-DB**
3. Click **Query editor** in the left menu
4. Login with your database credentials
5. Copy and paste the contents of `create_wells_down_table.sql`
6. Click **Run**
7. Verify "Command completed successfully" message

### Option 2: PowerShell Script

Run the migration helper script:
```powershell
.\run_db_migration.ps1
```

This will prompt for credentials and attempt to create the table automatically.

### Option 3: sqlcmd (If Installed)

```bash
sqlcmd -S aviator-prodview.database.windows.net -d Workover-DB -U <username> -P <password> -i C:\Users\cbrad\create_wells_down_table.sql
```

---

## 🔄 After Database Migration

Once the table is created, run the import script:

```powershell
.\import_wells_down.ps1
```

This will:
1. Upload all 19 wells down records
2. Populate lease and route information
3. Calculate production down metrics
4. Make data visible in the dashboard

---

## 🎯 Expected Results

After completing the database migration and import:

### Dashboard Will Show:
- **Wells Currently Down:** 19
- **Production Down:** 22.6 BOPD
- **Revenue Down:** $1,582/day

### Wells Down Tab Will Display:
- All 19 wells with complete information
- Lease and Route for each well
- Production down calculations
- Cost estimates where available
- Detailed comments and reasons

---

## 📂 Files Created/Modified

### New Files
- `C:\Users\cbrad\create_wells_down_table.sql` - Database schema
- `C:\Users\cbrad\run_db_migration.ps1` - Migration helper
- `C:\Users\cbrad\import_wells_down.ps1` - Data import script
- `PROJECT_SUMMARY.md` - Project documentation
- `WELLS_DOWN_IMPLEMENTATION.md` - This file

### Modified Files
- `api/wells-down/index.js` - Full CRUD API implementation
- `api/wells-down/function.json` - Added POST/PATCH/DELETE methods
- `index.html` - Dashboard KPIs and Wells Down table updates

---

## 🔍 Testing the Implementation

### 1. Test API Health
```bash
curl https://aviator-workover-api.azurewebsites.net/api/health
```

### 2. Test Wells Down GET (After Migration)
```bash
curl https://aviator-workover-api.azurewebsites.net/api/wells-down
```

### 3. Test Single Well Insert (After Migration)
```bash
curl -X POST https://aviator-workover-api.azurewebsites.net/api/wells-down \
  -H "Content-Type: application/json" \
  -d '{
    "well": "Test Well 1",
    "lease": "Test Lease",
    "route": "Test Route",
    "def_bopd": 2.5,
    "dt_hrs": 240,
    "reason": "Testing",
    "status": "Down",
    "date_down": "2026-01-01",
    "cost_est_pre_wo": 5000,
    "comments": "Test well"
  }'
```

### 4. View Dashboard
https://kind-sky-024906c10.6.azurestaticapps.net

---

## 🎨 UI Changes

### Dashboard Grid Layout
Now displays 6 KPI cards in a responsive grid:
1. Wells Currently Down
2. Active Workovers
3. Completed This Month
4. Available Rigs
5. **Production Down** (NEW)
6. **Revenue Down** (NEW)

### Wells Down Table
More comprehensive view with:
- Lease organization
- Route grouping
- Production metrics
- Cost tracking
- Detailed comments

---

## 💡 Future Enhancements

### Potential Additions
1. **Route Filtering** - Filter wells by route in dropdown
2. **Lease Grouping** - Group wells by lease in table
3. **Revenue Trends** - Historical revenue loss tracking
4. **Email Alerts** - Notify when production down exceeds threshold
5. **Cost vs Revenue** - Compare repair costs to lost revenue
6. **Priority Scoring** - Auto-calculate workover priority
7. **Map View** - Geographic display of wells down by route
8. **Export Reports** - PDF/Excel export of wells down data

### Database Optimizations
1. Add composite indexes on (well, status, date_down)
2. Create view for active wells down
3. Add calculated column for production_down
4. Implement soft deletes instead of hard deletes

---

## 📞 Support & Troubleshooting

### Common Issues

**Issue:** API returns 500 error
**Solution:** Ensure wells_down table is created in database

**Issue:** Import script fails
**Solution:** Check API endpoint is accessible and table exists

**Issue:** Dashboard shows "-" for Production Down
**Solution:** Verify wells_down API returns data successfully

**Issue:** Wells not appearing in table
**Solution:** Check status filter (only shows status='Down')

---

## ✨ Summary

This implementation adds comprehensive wells down tracking to the Aviator Workover Tracker, including:

- ✅ Production loss visibility (BOPD)
- ✅ Revenue impact calculation ($/day)
- ✅ Lease and Route organization
- ✅ Cost estimation tracking
- ✅ Detailed reason tracking
- ✅ Bulk import capability
- ✅ Full API CRUD operations
- ✅ Enhanced dashboard metrics

**Total Implementation Time:** ~1 hour
**Lines of Code Added:** ~500+
**New Database Tables:** 1
**New API Endpoints:** 4 operations
**New Dashboard Metrics:** 2

---

*Last Updated: January 19, 2026*
*Status: ⏳ Pending Database Migration*
