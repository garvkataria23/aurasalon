# Data Migration Center

Route: `/data-migration`

This module imports old salon software data into Aura Salon CRM without losing source traceability.

## Supported source
- DINGG Excel format
- Zenoti/Salonist/Flexi/custom Excel can be mapped through the same engine later

## Flow
1. Open **Data Migration** from sidebar.
2. Select **DINGG**.
3. Upload Excel `.xlsx`.
4. Click **Analyze** to detect sheets and entities.
5. Click **Dry run** to save a validation report without changing live data.
6. Click **Final import** to save data into live backend tables.
7. Check Clients, Services, Products, Inventory, Memberships, POS history, Dashboard and Reports.
8. Use **Rollback** if the import batch needs to be removed.

## Data imported
- Customers -> Clients
- Staff -> Staff
- Services -> Services
- Products -> Products + opening stock transaction
- Service History -> Sales + Invoices + Payments
- Membership -> Memberships
- Package Balance -> Membership/credits
- Prepaid Voucher -> Gift cards/wallet style value

## Safety rules
- Duplicates are detected by phone/email/name.
- Existing clients are merged instead of blindly overwritten.
- Every row keeps source sheet, row number, old external ID, and import batch ID.
- Import report is stored in migration tables.
- Rollback is available for records created by an import batch.
