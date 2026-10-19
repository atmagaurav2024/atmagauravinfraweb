-- =====================================================================
-- One-time import: historical Petty Cash from AIPL_Vouchers_2.xlsx
-- =====================================================================
-- 51 funding ('Payment In') rows + 313 expense rows, all for ONE
-- employee (the person who held the cash float: Shiv Borkar).
--
-- Everything is looked up by NAME in your new company, so no IDs to edit:
--   Old sheet site                          -> Project short name in the app
--   STMC on Jalna Pulgaon  (Dusarbid to Pimpri Sarad) -> Dusarbid-Pimpri Sarad
--   STMC on Khamgaon Deulgaon Sakharsha     -> Khamgaon-Deulgaon Sakharsha
--   STMC on Shegaon MP Border               -> Sangrampur-MP Border
--   FOB at Hiwra Ashram                     -> FOB at Hiwra Ashram
--   (Shegaon-Sangrampur gets no rows - the old sheet has no site for it.)
--
-- Expense categories are mapped onto the app's petty-cash heads:
--   Food->Food & Refreshment, Office->Office Expenses, Diesel/Transport->
--   Fuel & Transport, Material->Site Materials, Labour->Labour Wages,
--   Machinery->Equipment Repair, Other/Advance->Miscellaneous.
--
-- SAFE: it is ONE block - if any project/employee cannot be found, or the
-- data was already imported, it stops with a clear message and inserts
-- NOTHING. Run it in Supabase -> SQL Editor.
--
-- If the employee lookup fails (name differs), put the employee's Emp ID
-- (e.g. 'AIPL-002') in v_emp_override below.
-- Photos in the sheet are not imported.
-- =====================================================================
do $$
declare
  v_company      uuid := 'd8860938-2700-4505-bf73-6e0278760c07';
  v_emp_override text := null;          -- e.g. 'AIPL-002'
  v_emp          text;
  v_n            int;
  v_missing      text := '';
  v_key          text;
begin
  -- already imported?
  if exists (select 1 from petty_cash_in where company_id=v_company and remarks like '[Excel import]%')
     or exists (select 1 from petty_cash_expenses where company_id=v_company and remarks like '[Excel import]%') then
    raise exception 'Already imported - nothing was inserted. Delete the rows with remarks starting with [Excel import] first if you want to re-run.';
  end if;

  -- employee
  if v_emp_override is not null then
    v_emp := v_emp_override;
    if not exists (select 1 from employees where company_id=v_company and emp_id=v_emp) then
      raise exception 'Employee % not found in this company', v_emp;
    end if;
  else
    select count(*), min(emp_id) into v_n, v_emp from employees
      where company_id=v_company and coalesce(first_name,'') ilike 'shiv%' and coalesce(last_name,'') ilike '%borkar%';
    if v_n <> 1 then
      raise exception 'Found % employees matching Shiv Borkar (need exactly 1). Create the employee first, or set v_emp_override.', v_n;
    end if;
  end if;

  -- projects, matched on short name (dashes, spaces, dots and case are ignored)
  create temp table _pc_proj on commit drop as
    select regexp_replace(lower(short_name),'[^a-z0-9]','','g') as pkey, id, name
      from projects where company_id=v_company and short_name is not null;
  foreach v_key in array array['dusarbidpimprisarad','khamgaondeulgaonsakharsha','sangrampurmpborder','fobathiwraashram'] loop
    select count(*) into v_n from _pc_proj where _pc_proj.pkey = v_key;
    if v_n <> 1 then v_missing := v_missing || ' ['||v_key||': '||v_n||' found]'; end if;
  end loop;
  if v_missing <> '' then
    raise exception 'Project short-name problem (need exactly 1 each):%  -- run: select short_name from projects; and tell me what you see', v_missing;
  end if;

  -- STEP 1: funding rows (company-wide, like the app's own funding entries)
  insert into petty_cash_in (emp_id, company_id, amount, date, project, purpose, remarks, funded_by, funded_by_type, created_at)
  select v_emp, v_company, v.amount, v.date::date, 'All Projects', v.purpose, v.remarks, v.funded_by, v.funded_by_type,
         (v.entry_ts::timestamp at time zone 'Asia/Kolkata')
  from (values
  (6670.0,'2026-02-16','Ac seltament','[Excel import] STM-ON-JAL-PUL-001 | Category: Advance | Party: Shiv','Company — Cash in Hand','cash','2026-02-25 20:52:22.349000'),
  (25000.0,'2026-02-22','ETC','[Excel import] STM-ON-JAL-PUL-007 | Category: Advance | Party: Shiv borka','Company — Bank','bank','2026-02-25 21:21:55.050000'),
  (10000.0,'2026-02-25','Adwans','[Excel import] STM-ON-JAL-PUL-012 | Category: Advance | Party: Shiv borka','Company — Bank','bank','2026-02-25 21:36:19.519000'),
  (1040.0,'2026-02-26','Fasnar ritan 1040','[Excel import] STM-ON-JAL-PUL-013 | Category: Other | Party: Shiv borkar','Company — Cash in Hand','cash','2026-02-26 12:40:06.374000'),
  (10000.0,'2026-02-27','Advance for expenditures','[Excel import] STM-ON-JAL-PUL-017 | Category: Advance | Party: Shiv','Company — Bank','bank','2026-02-27 20:23:57.040000'),
  (5000.0,'2026-03-04','Nagesh parmale  kadun parat ghetale  advance vapps','[Excel import] STM-ON-JAL-PUL-020 | Category: Advance | Party: Shiv borkar','Company — Cash in Hand','cash','2026-03-04 13:30:21.381000'),
  (80.0,'2026-03-09','Rao saheb 10000 dile kharch sathi','[Excel import] STM-ON-JAL-PUL-033 | Category: Advance | Party: Shiv borkar','Company — Bank','bank','2026-03-09 20:25:21.000000'),
  (9920.0,'2026-03-09','Rao saheb 10000 dile kharch sathi','[Excel import] STM-ON-JAL-PUL-033 | Category: Advance | Party: Shiv borkar','Company — Bank','bank','2026-03-09 20:25:21.884000'),
  (10000.0,'2026-03-19','Delgon sakharsha said 
Advance dile','[Excel import] STM-ON-KHA-DEU-SAK-068 | Category: Advance | Party: Shiv borkar','Company — Bank','bank','2026-03-19 11:07:48.260000'),
  (30000.0,'2026-03-24','Rohit sir Amravati sathi','[Excel import] STM-ON-KHA-DEU-SAK-082 | Category: Advance | Party: Shiv borkar','Company — Cash in Hand','cash','2026-03-24 17:47:57.382000'),
  (40000.0,'2026-03-24','Anmol infra','[Excel import] STM-ON-KHA-DEU-SAK-083 | Category: Advance | Party: Shiv borkar','Company — Cash in Hand','cash','2026-03-24 17:49:00.841000'),
  (10000.0,'2026-04-13','Cash to shiv in office','[Excel import] STM-ON-JAL-PUL-100 | Category: Office | Party: Shiv','Company — Cash in Hand','cash','2026-04-13 11:47:10.504000'),
  (100.0,'2026-03-30','Sprait 4 contractor hivraasharam','[Excel import] FOB-AT-HIW-ASH-092 | Category: Food | Party: Shiv borkar','Company — Bank','bank','2026-03-30 12:28:36.902000'),
  (90000.0,'2026-04-19','60+30=90 Akola billa sathi dile','[Excel import] STM-ON-KHA-DEU-SAK-093 | Category: Office | Party: Shiv Borkar','Company — Bank','bank','2026-04-19 16:31:17.593000'),
  (10000.0,'2026-04-21','Petty','[Excel import] STM-ON-KHA-DEU-SAK-094 | Category: Office | Party: Shankar','Company — Cash in Hand','cash','2026-04-21 16:31:06.542000'),
  (18876.0,'2026-06-07','Adjustedfrom khamgaon deulgaon sakharsha','[Excel import] STM-ON-SHE-MP-BOR-147 | Category: Other | Party: Adjustment','Company — Cash in Hand','cash','2026-06-07 19:39:47.444000'),
  (5000.0,'2026-06-09','Rohit sir 5000 kharcha sathi dile','[Excel import] STM-ON-SHE-MP-BOR-157 | Category: Advance | Party: Shiv Borkar','Company — Bank','bank','2026-06-09 20:13:32.153000'),
  (497550.0,'2026-06-22','Shegaon hardware ghetale','[Excel import] STM-ON-SHE-MP-BOR-186 | Category: Advance | Party: Shiv Borkar','Company — Cash in Hand','cash','2026-06-25 19:51:10.977000'),
  (300000.0,'2026-07-10','Bundhe Saheb mehkar cash ghetali hardware la marlele','[Excel import] STM-ON-SHE-MP-BOR-198 | Category: Advance | Party: Shiv Borkar','Company — Cash in Hand','cash','2026-07-10 14:39:53.196000'),
  (10000.0,'2026-07-23','Rohit sir ne kharcha sathi dile','[Excel import] STM-ON-SHE-MP-BOR-204 | Category: Advance | Party: Shiv Borkar','Company — Bank','bank','2026-07-23 11:59:45.683000'),
  (100000.0,'2026-07-28','मातोश्री बँक cash घेतली','[Excel import] STM-ON-SHE-MP-BOR-210 | Category: Advance | Party: Shiv Borkar','Company — Cash in Hand','cash','2026-07-28 13:31:39.596000'),
  (100000.0,'2026-07-28','मातोश्री बँक कॅश्श काढली','[Excel import] STM-ON-SHE-MP-BOR-211 | Category: Advance | Party: Shiv Borkar','Company — Bank','bank','2026-07-28 13:33:13.992000'),
  (100000.0,'2026-08-12','Bhola hardware  GST','[Excel import] STM-ON-SHE-MP-BOR-260 | Category: Advance | Party: Shiv Borkar','Company — Cash in Hand','cash','2026-08-16 15:41:52.997000'),
  (500000.0,'2026-08-30','Sachin wagh chikhali','[Excel import] STM-ON-SHE-MP-BOR-272 | Category: Advance | Party: Shiv Borkar','Company — Cash in Hand','cash','2026-08-31 18:00:45.487000'),
  (90000.0,'2026-08-30','ATM pooja, shiv  kadhale','[Excel import] STM-ON-SHE-MP-BOR-273 | Category: Advance | Party: Shiv Borkar','Company — Cash in Hand','cash','2026-08-31 18:02:39.771000'),
  (199000.0,'2026-08-31','Pooja buldhana urban','[Excel import] STM-ON-SHE-MP-BOR-274 | Category: Advance | Party: Shiv Borkar','Company — Cash in Hand','cash','2026-08-31 18:04:02.341000'),
  (500000.0,'2026-09-01','Matoshri bank corant account','[Excel import] STM-ON-SHE-MP-BOR-275 | Category: Advance | Party: Shiv Borkar','Company — Cash in Hand','cash','2026-09-01 13:46:04.138000'),
  (100000.0,'2026-09-01','Matoshri bank sseving account shiv','[Excel import] STM-ON-SHE-MP-BOR-276 | Category: Advance | Party: Shiv Borkar','Company — Cash in Hand','cash','2026-09-01 13:47:59.211000'),
  (70000.0,'2026-09-01','Shiv and pooja account ATM ne kadhle','[Excel import] STM-ON-SHE-MP-BOR-277 | Category: Advance | Party: Shiv Borkar','Company — Cash in Hand','cash','2026-09-01 13:49:12.530000'),
  (199000.0,'2026-09-01','Buldhana urban bank sseving account pooja','[Excel import] STM-ON-SHE-MP-BOR-278 | Category: Advance | Party: Shiv Borkar','Company — Cash in Hand','cash','2026-09-01 13:50:14.161000'),
  (171000.0,'2026-09-01','Buldhana urban bank sseving account shiv','[Excel import] STM-ON-SHE-MP-BOR-279 | Category: Advance | Party: Shiv Borkar','Company — Cash in Hand','cash','2026-09-01 13:51:27.152000'),
  (100000.0,'2026-09-02','Bhola hardware cass ghetle','[Excel import] STM-ON-SHE-MP-BOR-281 | Category: Advance | Party: Shiv Borkar','Company — Cash in Hand','cash','2026-09-02 09:30:59.589000'),
  (60000.0,'2026-09-02','Shiv pooja ATM kadhale','[Excel import] STM-ON-SHE-MP-BOR-282 | Category: Advance | Party: Shiv Borkar','Company — Cash in Hand','cash','2026-09-02 17:34:11.766000'),
  (20000.0,'2026-09-02','Gajanan kakade ATM kadhale  sir','[Excel import] STM-ON-SHE-MP-BOR-283 | Category: Advance | Party: Shiv Borkar','Company — Cash in Hand','cash','2026-09-02 17:35:38.577000'),
  (278000.0,'2026-09-03','Shiv matoshri bank, ani saving','[Excel import] STM-ON-SHE-MP-BOR-285 | Category: Advance | Party: Shiv Borkar','Company — Cash in Hand','cash','2026-09-03 09:40:43.196000'),
  (138000.0,'2026-09-08','Pooja buldhana urban bank  kadhli cassh','[Excel import] STM-ON-SHE-MP-BOR-304 | Category: Advance | Party: Shiv Borkar','Company — Cash in Hand','cash','2026-09-08 15:03:26.972000'),
  (199000.0,'2026-09-09','Bhola hardware','[Excel import] STM-ON-SHE-MP-BOR-305 | Category: Advance | Party: Shiv Borkar','Company — Cash in Hand','cash','2026-09-10 17:20:01.016000'),
  (138000.0,'2026-09-09','Pooja buldhana urban bank sseving','[Excel import] STM-ON-SHE-MP-BOR-306 | Category: Advance | Party: Shiv Borkar','Company — Cash in Hand','cash','2026-09-10 17:21:56.841000'),
  (500000.0,'2026-09-09','Matoshri bank corant account','[Excel import] STM-ON-SHE-MP-BOR-307 | Category: Advance | Party: Shiv Borkar','Company — Cash in Hand','cash','2026-09-10 17:23:50.245000'),
  (199000.0,'2026-09-10','Bhola hardware','[Excel import] STM-ON-SHE-MP-BOR-308 | Category: Advance | Party: Shiv Borkar','Company — Cash in Hand','cash','2026-09-10 17:25:06.577000'),
  (400000.0,'2026-09-10','Matoshri bank corant account','[Excel import] STM-ON-SHE-MP-BOR-309 | Category: Advance | Party: Shiv Borkar','Company — Cash in Hand','cash','2026-09-10 17:26:07.165000'),
  (100000.0,'2026-09-11','Matoshri bank corant account','[Excel import] STM-ON-SHE-MP-BOR-314 | Category: Advance | Party: Shiv Borkar','Company — Cash in Hand','cash','2026-09-11 19:46:51.623000'),
  (102000.0,'2026-09-12','Bhola hardware 102000','[Excel import] STM-ON-SHE-MP-BOR-315 | Category: Advance | Party: Shiv Borkar','Company — Cash in Hand','cash','2026-09-12 11:21:36.530000'),
  (5000.0,'2026-09-15','Dabal entry zali hoti mhanun parat aad kele','[Excel import] STM-ON-SHE-MP-BOR-323 | Category: Advance | Party: Shiv Borkar','Company — Cash in Hand','cash','2026-09-15 18:21:39.179000'),
  (10000.0,'2026-09-16','खर्चा साठी dile','[Excel import] STM-ON-SHE-MP-BOR-324 | Category: Advance | Party: Shiv Borkar','Company — Cash in Hand','cash','2026-09-16 19:35:47.422000'),
  (80000.0,'2026-09-20','ATM ने  कॅश kadhali','[Excel import] STM-ON-SHE-MP-BOR-333 | Category: Advance | Party: Shiv Borkar','Company — Cash in Hand','cash','2026-09-20 13:02:47.170000'),
  (200000.0,'2026-09-21','Vinod mama khadse Risod cash','[Excel import] STM-ON-SHE-MP-BOR-342 | Category: Advance | Party: Shiv Borkar','Company — Cash in Hand','cash','2026-09-23 11:04:22.424000'),
  (200000.0,'2026-09-21','Vinod mama khadse Risod cash 
चुकी मूळे परत इन्ट्री करावी lagali','[Excel import] STM-ON-SHE-MP-BOR-345 | Category: Advance | Party: Shiv Borkar','Company — Cash in Hand','cash','2026-09-23 11:10:33.893000'),
  (100000.0,'2026-09-21','मुंबई वरून आणले मम्मी ने   कॅश','[Excel import] STM-ON-SHE-MP-BOR-346 | Category: Advance | Party: Shiv Borkar','Company — Cash in Hand','cash','2026-09-23 11:11:32.120000'),
  (500000.0,'2026-09-25','Bundhe sahba kadun cash ghetli','[Excel import] STM-ON-SHE-MP-BOR-351 | Category: Advance | Party: Shiv Borkar','Company — Cash in Hand','cash','2026-09-25 15:23:02.208000'),
  (3030.0,'2026-10-02','नवीन अँप अड्जस्ट','[Excel import] STM-ON-SHE-MP-BOR-358 | Category: Other | Party: Shankar','Company — Cash in Hand','cash','2026-10-02 16:12:15.397000')
  ) as v(amount, date, purpose, remarks, funded_by, funded_by_type, entry_ts);

  -- STEP 2: expense rows, each linked to its project
  insert into petty_cash_expenses (emp_id, company_id, category, amount, date, project, project_ids, project_allocations, description, remarks, payout_status, created_at)
  select v_emp, v_company, v.category, v.amount, v.date::date, p.name,
         '["'||p.id||'"]',
         '[{"id":"'||p.id||'","name":"'||replace(p.name,'"','\"')||'","amount":'||v.amount||'}]',
         v.description, v.remarks, 'not_applicable',
         (v.entry_ts::timestamp at time zone 'Asia/Kolkata')
  from (values
  ('Miscellaneous',810.0,'2026-02-17','dusarbidpimprisarad','Miting kharch','[Excel import] STM-ON-JAL-PUL-002 | Party/Vendor: Lumpsum | Payment: Cash','2026-02-25 20:57:09.961000'),
  ('Miscellaneous',100.0,'2026-02-18','dusarbidpimprisarad','ETC','[Excel import] STM-ON-JAL-PUL-003 | Party/Vendor: Deri tak pani | Payment: Cash','2026-02-25 21:04:16.679000'),
  ('Miscellaneous',2170.0,'2026-02-19','dusarbidpimprisarad','Program kharch','[Excel import] STM-ON-JAL-PUL-004 | Party/Vendor: Pani,jelebi ,envhatar pani | Payment: Cash','2026-02-25 21:08:12.535000'),
  ('Fuel & Transport',2030.0,'2026-02-21','dusarbidpimprisarad','Petrol Diesel ,stont  fixing','[Excel import] STM-ON-JAL-PUL-005 | Party/Vendor: Om  , shiv petrol Diesel tractor | Payment: Cash','2026-02-25 21:14:34.814000'),
  ('Miscellaneous',2745.0,'2026-02-22','dusarbidpimprisarad','Siment ,Devkate, nasta','[Excel import] STM-ON-JAL-PUL-006 | Party/Vendor: Siment  , Devkate | Payment: Cash','2026-02-25 21:18:10.702000'),
  ('Labour Wages',20000.0,'2026-02-22','dusarbidpimprisarad','Shiv borkar salery','[Excel import] STM-ON-JAL-PUL-008 | Party/Vendor: Shiv borka salery | Payment: UPI','2026-02-25 21:24:45.345000'),
  ('Site Materials',1116.0,'2026-02-23','dusarbidpimprisarad','Fasnar nat','[Excel import] STM-ON-JAL-PUL-009 | Party/Vendor: Fasnar nat | Payment: Cash','2026-02-25 21:26:27.906000'),
  ('Site Materials',5700.0,'2026-02-24','dusarbidpimprisarad','Murum and paip','[Excel import] STM-ON-JAL-PUL-010 | Party/Vendor: Murum vala chor bangara | Payment: Cash','2026-02-25 21:29:48.210000'),
  ('Site Materials',2324.0,'2026-02-25','dusarbidpimprisarad','Majury,prayar, fasnar nat','[Excel import] STM-ON-JAL-PUL-011 | Party/Vendor: Fasnar nat praymar  ston majury | Payment: Cash','2026-02-25 21:33:46.778000'),
  ('Food & Refreshment',40.0,'2026-02-26','dusarbidpimprisarad','Nasta','[Excel import] STM-ON-JAL-PUL-014 | Party/Vendor: Shiv borkar | Payment: Cash','2026-02-26 16:17:10.107000'),
  ('Fuel & Transport',1000.0,'2026-02-27','dusarbidpimprisarad','Petrol pump','[Excel import] STM-ON-JAL-PUL-015 | Party/Vendor: Shiv borkar | Payment: Cash','2026-02-27 14:14:24.293000'),
  ('Food & Refreshment',510.0,'2026-02-27','dusarbidpimprisarad','Pungase , kalmeghe visit','[Excel import] STM-ON-JAL-PUL-016 | Party/Vendor: Hotel | Payment: UPI','2026-02-27 20:21:24.082000'),
  ('Fuel & Transport',4000.0,'2026-02-28','dusarbidpimprisarad','Trackr bhad','[Excel import] STM-ON-JAL-PUL-018 | Party/Vendor: Om Borkar | Payment: Cash','2026-02-28 11:04:20.669000'),
  ('Site Materials',170.0,'2026-02-28','dusarbidpimprisarad','Colour black and white , bord','[Excel import] STM-ON-JAL-PUL-019 | Party/Vendor: Shiv borkar | Payment: UPI','2026-02-28 11:19:23.854000'),
  ('Fuel & Transport',900.0,'2026-03-04','dusarbidpimprisarad','Petrol takal gadi madhe','[Excel import] STM-ON-JAL-PUL-021 | Party/Vendor: Shiv borkar | Payment: UPI','2026-03-04 14:33:50.598000'),
  ('Food & Refreshment',25.0,'2026-03-04','dusarbidpimprisarad','Jush','[Excel import] STM-ON-JAL-PUL-022 | Party/Vendor: Shiv borkar | Payment: Cash','2026-03-04 15:07:38.790000'),
  ('Office Expenses',30.0,'2026-03-05','dusarbidpimprisarad','Print','[Excel import] STM-ON-JAL-PUL-023 | Party/Vendor: Shiv borkar | Payment: Cash','2026-03-05 08:40:45.296000'),
  ('Food & Refreshment',80.0,'2026-03-05','dusarbidpimprisarad','Nashta  ras','[Excel import] STM-ON-JAL-PUL-024 | Party/Vendor: Shiv borkar | Payment: Cash','2026-03-05 14:50:33.272000'),
  ('Labour Wages',500.0,'2026-03-05','dusarbidpimprisarad','Gollu majury 500','[Excel import] STM-ON-JAL-PUL-025 | Party/Vendor: Shiv borkar | Payment: Cash','2026-03-05 16:23:25.230000'),
  ('Equipment Repair',5520.0,'2026-03-07','dusarbidpimprisarad','Hamar machine bit','[Excel import] STM-ON-JAL-PUL-026 | Party/Vendor: Shiv borkar | Payment: Cash','2026-03-07 16:11:13.963000'),
  ('Equipment Repair',6185.0,'2026-03-07','dusarbidpimprisarad','Hamar brekar , bloar, taparia pechis','[Excel import] STM-ON-JAL-PUL-027 | Party/Vendor: Shiv borkar | Payment: Cash','2026-03-07 16:46:11.660000'),
  ('Office Expenses',30.0,'2026-03-08','dusarbidpimprisarad','Mejarment print marlya','[Excel import] STM-ON-JAL-PUL-028 | Party/Vendor: Shiv borkar | Payment: UPI','2026-03-08 18:19:52.302000'),
  ('Food & Refreshment',65.0,'2026-03-09','dusarbidpimprisarad','Ras du. Bid','[Excel import] STM-ON-JAL-PUL-029 | Party/Vendor: Shiv borkar | Payment: UPI','2026-03-09 11:21:54.010000'),
  ('Fuel & Transport',1200.0,'2026-03-09','dusarbidpimprisarad','Petrol','[Excel import] STM-ON-JAL-PUL-030 | Party/Vendor: Shiv borkar | Payment: UPI','2026-03-09 14:10:03.328000'),
  ('Food & Refreshment',500.0,'2026-03-09','dusarbidpimprisarad','Jevan Mayur hotel 🏨','[Excel import] STM-ON-JAL-PUL-031 | Party/Vendor: Shiv borkar | Payment: UPI','2026-03-09 15:08:09.241000'),
  ('Food & Refreshment',40.0,'2026-03-09','dusarbidpimprisarad','Pani botal 2','[Excel import] STM-ON-JAL-PUL-032 | Party/Vendor: Shiv borkar | Payment: Cash','2026-03-09 16:07:21.690000'),
  ('Fuel & Transport',720.0,'2026-03-10','khamgaondeulgaonsakharsha','Cat eyes and epoxy 
Con transport bhade','[Excel import] STM-ON-JAL-PUL-034 | Party/Vendor: Shiv borkar | Payment: UPI','2026-03-10 18:15:24.869000'),
  ('Miscellaneous',200.0,'2026-03-10','khamgaondeulgaonsakharsha','Loding rixa hamali','[Excel import] STM-ON-JAL-PUL-035 | Party/Vendor: Shiv borkar | Payment: Cash','2026-03-10 18:16:38.662000'),
  ('Site Materials',700.0,'2026-03-10','khamgaondeulgaonsakharsha','Vayar','[Excel import] STM-ON-JAL-PUL-036 | Party/Vendor: Shiv borkar | Payment: UPI','2026-03-10 18:18:10.871000'),
  ('Office Expenses',140.0,'2026-03-10','khamgaondeulgaonsakharsha','Panching mashin ,pen, fail','[Excel import] STM-ON-KHA-DEU-SAK-037 | Party/Vendor: Shiv borkar | Payment: Cash','2026-03-10 20:09:52.309000'),
  ('Food & Refreshment',60.0,'2026-03-11','khamgaondeulgaonsakharsha','Jalana polgaon mejarment 60 pani botal','[Excel import] STM-ON-KHA-DEU-SAK-038 | Party/Vendor: Shiv borkar | Payment: Cash','2026-03-11 13:08:50.391000'),
  ('Fuel & Transport',100.0,'2026-03-11','khamgaondeulgaonsakharsha','Mejarment sathi gadi madhe petrol','[Excel import] STM-ON-KHA-DEU-SAK-040 | Party/Vendor: Shiv borkar | Payment: UPI','2026-03-11 15:10:53.029000'),
  ('Food & Refreshment',80.0,'2026-03-11','khamgaondeulgaonsakharsha','Chaha kalmeghe   devkate risod chaukky','[Excel import] STM-ON-KHA-DEU-SAK-041 | Party/Vendor: Shiv borkar | Payment: Cash','2026-03-11 21:47:05.417000'),
  ('Labour Wages',220.0,'2026-03-11','khamgaondeulgaonsakharsha','Santosh  tep dharnara','[Excel import] STM-ON-KHA-DEU-SAK-042 | Party/Vendor: Shiv borkar | Payment: Cash','2026-03-11 21:48:11.760000'),
  ('Site Materials',475.0,'2026-03-13','khamgaondeulgaonsakharsha','Vayar ghetala 50 phut','[Excel import] STM-ON-KHA-DEU-SAK-043 | Party/Vendor: Shiv borkar | Payment: UPI','2026-03-13 11:02:04.789000'),
  ('Labour Wages',500.0,'2026-03-13','khamgaondeulgaonsakharsha','Majuri dili mejarment. Cha divashi chi','[Excel import] STM-ON-KHA-DEU-SAK-045 | Party/Vendor: Shiv borkar | Payment: UPI','2026-03-13 21:58:27.595000'),
  ('Food & Refreshment',40.0,'2026-03-13','khamgaondeulgaonsakharsha','40.0','[Excel import] STM-ON-KHA-DEU-SAK-046 | Party/Vendor: Shiv borkar | Payment: Cash','2026-03-13 22:00:21.310000'),
  ('Site Materials',50.0,'2026-03-13','khamgaondeulgaonsakharsha','Cat eyes map banaval','[Excel import] STM-ON-KHA-DEU-SAK-047 | Party/Vendor: Shiv borkar | Payment: Cash','2026-03-13 22:01:45.848000'),
  ('Site Materials',160.0,'2026-03-15','khamgaondeulgaonsakharsha','Hatudi ghetli','[Excel import] STM-ON-KHA-DEU-SAK-048 | Party/Vendor: Shiv borkar | Payment: UPI','2026-03-15 19:42:55.413000'),
  ('Fuel & Transport',1600.0,'2026-03-15','khamgaondeulgaonsakharsha','Gadi madhe diesel','[Excel import] STM-ON-KHA-DEU-SAK-049 | Party/Vendor: Shiv borkar | Payment: UPI','2026-03-15 19:44:45.292000'),
  ('Fuel & Transport',1000.0,'2026-03-15','khamgaondeulgaonsakharsha','Petrol ghadi madhe shiv borkar','[Excel import] STM-ON-KHA-DEU-SAK-050 | Party/Vendor: Shiv borkar | Payment: Cash','2026-03-15 19:45:44.931000'),
  ('Site Materials',660.0,'2026-03-15','khamgaondeulgaonsakharsha','Dril bit','[Excel import] STM-ON-KHA-DEU-SAK-051 | Party/Vendor: Shiv borkar | Payment: UPI','2026-03-15 19:47:16.419000'),
  ('Site Materials',20.0,'2026-03-15','khamgaondeulgaonsakharsha','Chikat tep vayar sathi','[Excel import] STM-ON-KHA-DEU-SAK-052 | Party/Vendor: Shiv borkar | Payment: Cash','2026-03-15 19:48:30.852000'),
  ('Food & Refreshment',175.0,'2026-03-15','khamgaondeulgaonsakharsha','Delgon sakharsha nasta kela','[Excel import] STM-ON-KHA-DEU-SAK-053 | Party/Vendor: Shiv borkar | Payment: Cash','2026-03-15 19:49:57.069000'),
  ('Site Materials',100.0,'2026-03-15','khamgaondeulgaonsakharsha','Laitgt vayar chiat tep','[Excel import] STM-ON-KHA-DEU-SAK-054 | Party/Vendor: Shiv borkar | Payment: Cash','2026-03-15 19:51:23.445000'),
  ('Food & Refreshment',750.0,'2026-03-15','khamgaondeulgaonsakharsha','Jevan ratri ch  14 /3 /26','[Excel import] STM-ON-KHA-DEU-SAK-055 | Party/Vendor: Shiv borkar | Payment: UPI','2026-03-15 19:53:08.338000'),
  ('Fuel & Transport',500.0,'2026-03-15','khamgaondeulgaonsakharsha','Diesel ratri  takal','[Excel import] STM-ON-KHA-DEU-SAK-056 | Party/Vendor: Shiv borkar | Payment: UPI','2026-03-15 19:54:20.675000'),
  ('Site Materials',660.0,'2026-03-15','khamgaondeulgaonsakharsha','Drilll bit mehakar varun neli delgon sakharsha','[Excel import] STM-ON-KHA-DEU-SAK-057 | Party/Vendor: Shiv borkar | Payment: Cash','2026-03-15 19:56:11.983000'),
  ('Food & Refreshment',540.0,'2026-03-15','khamgaondeulgaonsakharsha','Jevan 15/ 3/26','[Excel import] STM-ON-KHA-DEU-SAK-058 | Party/Vendor: Shiv borkar | Payment: Cash','2026-03-15 19:58:04.785000'),
  ('Food & Refreshment',40.0,'2026-03-15','khamgaondeulgaonsakharsha','Pani  jar 1  botal','[Excel import] STM-ON-KHA-DEU-SAK-059 | Party/Vendor: Shiv borkar | Payment: Cash','2026-03-15 19:59:04.565000'),
  ('Food & Refreshment',940.0,'2026-03-15','khamgaondeulgaonsakharsha','Ratri che Jevan kele','[Excel import] STM-ON-KHA-DEU-SAK-060 | Party/Vendor: Shiv borkar | Payment: UPI','2026-03-15 20:41:30.703000'),
  ('Labour Wages',1600.0,'2026-03-16','khamgaondeulgaonsakharsha','Majuri pandit ani  Arun','[Excel import] STM-ON-KHA-DEU-SAK-061 | Party/Vendor: Shiv borkar | Payment: Cash','2026-03-16 22:22:57.756000'),
  ('Site Materials',230.0,'2026-03-16','khamgaondeulgaonsakharsha','Sain bord nat ghetale','[Excel import] STM-ON-KHA-DEU-SAK-062 | Party/Vendor: Shiv borkar | Payment: UPI','2026-03-16 22:23:57.099000'),
  ('Food & Refreshment',95.0,'2026-03-17','dusarbidpimprisarad','Ras 3 pani botal samosa','[Excel import] STM-ON-JAL-PUL-063 | Party/Vendor: Shiv borkar | Payment: UPI','2026-03-17 13:45:53.880000'),
  ('Food & Refreshment',75.0,'2026-03-17','dusarbidpimprisarad','Ras3  pani bottle','[Excel import] STM-ON-JAL-PUL-064 | Party/Vendor: Shiv borkar | Payment: Cash','2026-03-17 21:59:44.516000'),
  ('Food & Refreshment',50.0,'2026-03-18','dusarbidpimprisarad','3 T 1 PANI bottle','[Excel import] STM-ON-JAL-PUL-065 | Party/Vendor: Shiv borkar | Payment: UPI','2026-03-18 17:51:50.960000'),
  ('Food & Refreshment',245.0,'2026-03-18','dusarbidpimprisarad','Kalmeghe  mejarment','[Excel import] STM-ON-JAL-PUL-066 | Party/Vendor: Shiv borkar | Payment: Cash','2026-03-18 17:54:02.463000'),
  ('Fuel & Transport',1000.0,'2026-03-18','khamgaondeulgaonsakharsha','Petrol takal gadi madhe','[Excel import] STM-ON-KHA-DEU-SAK-067 | Party/Vendor: Shiv borkar | Payment: UPI','2026-03-18 17:55:16.016000'),
  ('Site Materials',100.0,'2026-03-19','khamgaondeulgaonsakharsha','Gadi problem  ,band padli hoti','[Excel import] STM-ON-KHA-DEU-SAK-069 | Party/Vendor: Shiv borkar | Payment: UPI','2026-03-19 12:13:22.540000'),
  ('Labour Wages',900.0,'2026-03-20','dusarbidpimprisarad','Majuri mejarment 2 day','[Excel import] STM-ON-JAL-PUL-070 | Party/Vendor: Shiv borkar | Payment: Cash','2026-03-20 18:17:57.048000'),
  ('Site Materials',240.0,'2026-03-21','khamgaondeulgaonsakharsha','Colour for board','[Excel import] STM-ON-KHA-DEU-SAK-071 | Party/Vendor: Colour | Payment: UPI','2026-03-21 15:25:03.989000'),
  ('Office Expenses',30.0,'2026-03-21','khamgaondeulgaonsakharsha','Print','[Excel import] STM-ON-KHA-DEU-SAK-072 | Party/Vendor: Shiv borkar | Payment: Cash','2026-03-21 17:33:39.829000'),
  ('Food & Refreshment',70.0,'2026-03-21','khamgaondeulgaonsakharsha','Faral ani lasi','[Excel import] STM-ON-KHA-DEU-SAK-073 | Party/Vendor: Shiv borkar | Payment: Cash','2026-03-21 17:34:24.502000'),
  ('Fuel & Transport',1000.0,'2026-03-21','khamgaondeulgaonsakharsha','Petrol 2 wilar','[Excel import] STM-ON-KHA-DEU-SAK-074 | Party/Vendor: Shiv borkar | Payment: Cash','2026-03-21 20:14:49.833000'),
  ('Site Materials',500.0,'2026-03-22','khamgaondeulgaonsakharsha','500.0','[Excel import] STM-ON-KHA-DEU-SAK-075 | Party/Vendor: Shiv borkar | Payment: UPI','2026-03-22 15:47:10.257000'),
  ('Labour Wages',400.0,'2026-03-22','khamgaondeulgaonsakharsha','Majuri dili','[Excel import] STM-ON-KHA-DEU-SAK-076 | Party/Vendor: Shiv borkar | Payment: Cash','2026-03-22 15:48:04.299000'),
  ('Miscellaneous',985.0,'2026-03-23','dusarbidpimprisarad','Mejarment sathi  ras Ankur sir
Gadi bhad','[Excel import] STM-ON-JAL-PUL-077 | Party/Vendor: Shiv borkar | Payment: UPI','2026-03-23 22:05:39.867000'),
  ('Food & Refreshment',140.0,'2026-03-24','dusarbidpimprisarad','Nasta mehaar  3 ry bim','[Excel import] STM-ON-JAL-PUL-078 | Party/Vendor: Shiv borkar | Payment: Cash','2026-03-24 11:27:52.290000'),
  ('Labour Wages',1500.0,'2026-03-24','dusarbidpimprisarad','Majuri wbim mehakar varun anle','[Excel import] STM-ON-JAL-PUL-080 | Party/Vendor: Shiv borkar | Payment: Cash','2026-03-24 13:53:51.377000'),
  ('Office Expenses',3750.0,'2026-03-24','khamgaondeulgaonsakharsha','2. Dress ghetale','[Excel import] STM-ON-KHA-DEU-SAK-081 | Party/Vendor: Shiv borkar | Payment: Cash','2026-03-24 17:39:18.298000'),
  ('Office Expenses',1050.0,'2026-03-24','dusarbidpimprisarad','Room stay rixa','[Excel import] STM-ON-JAL-PUL-084 | Party/Vendor: Shiv borkar | Payment: Cash','2026-03-25 02:57:13.469000'),
  ('Site Materials',110.0,'2026-03-25','dusarbidpimprisarad','Brass colget tel','[Excel import] STM-ON-JAL-PUL-086 | Party/Vendor: Shiv borkar | Payment: Cash','2026-03-25 08:31:59.008000'),
  ('Office Expenses',1758.0,'2026-03-25','dusarbidpimprisarad','Amravati khachrch 110 chi entry ahe','[Excel import] STM-ON-JAL-PUL-087 | Party/Vendor: Shiv borkar | Payment: Cash','2026-03-25 22:36:52.666000'),
  ('Fuel & Transport',1200.0,'2026-03-27','khamgaondeulgaonsakharsha','D. Sakharsha varun bord anle  bess plyat post anale gadi bhad','[Excel import] STM-ON-KHA-DEU-SAK-088 | Party/Vendor: Shiv borkar | Payment: Cash','2026-03-27 14:02:49.472000'),
  ('Fuel & Transport',2000.0,'2026-03-29','dusarbidpimprisarad','Nilesh gund  tryacatr  bhad mehakar','[Excel import] STM-ON-JAL-PUL-089 | Party/Vendor: Shiv borkar | Payment: Cash','2026-03-29 13:58:02.070000'),
  ('Miscellaneous',100.0,'2026-03-29','khamgaondeulgaonsakharsha','Gopal deshmukh  invhatar problem','[Excel import] STM-ON-KHA-DEU-SAK-090 | Party/Vendor: Shiv borkar | Payment: UPI','2026-03-29 18:09:09.004000'),
  ('Food & Refreshment',100.0,'2026-03-30','fobathiwraashram','Sprait 4 contractor hivraasharam','[Excel import] FOB-AT-HIW-ASH-092 | Party/Vendor: Shiv borkar | Payment: UPI','2026-03-30 12:28:36.902000'),
  ('Food & Refreshment',480.0,'2026-03-30','khamgaondeulgaonsakharsha','Jevan anal bhumi putra hotel','[Excel import] STM-ON-KHA-DEU-SAK-093 | Party/Vendor: Shiv borkar | Payment: UPI','2026-03-30 19:35:28.282000'),
  ('Food & Refreshment',30.0,'2026-03-30','khamgaondeulgaonsakharsha','30 dudha che  payment  dil','[Excel import] STM-ON-KHA-DEU-SAK-094 | Party/Vendor: Shiv borkar | Payment: UPI','2026-03-30 20:50:43.899000'),
  ('Office Expenses',1170.0,'2026-04-06','dusarbidpimprisarad','Amravati PWD Bill','[Excel import] STM-ON-JAL-PUL-095 | Party/Vendor: Shiv borkar | Payment: Cash','2026-04-08 18:02:59.007000'),
  ('Office Expenses',11330.0,'2026-04-07','dusarbidpimprisarad','Amravati PWD accountant','[Excel import] STM-ON-JAL-PUL-096 | Party/Vendor: Shiv borkar | Payment: Cash','2026-04-08 18:06:10.323000'),
  ('Office Expenses',19070.0,'2026-04-08','dusarbidpimprisarad','7/8 epr 26 ektar kharch room office','[Excel import] STM-ON-JAL-PUL-097 | Party/Vendor: Shiv borkar | Payment: Cash','2026-04-08 18:23:41.314000'),
  ('Food & Refreshment',120.0,'2026-04-08','dusarbidpimprisarad','Biryani','[Excel import] STM-ON-JAL-PUL-098 | Party/Vendor: Shiv borkar | Payment: Cash','2026-04-08 21:24:42.720000'),
  ('Office Expenses',5460.0,'2026-04-09','dusarbidpimprisarad','Amravti  and mehakar  
Saheb,Jevan, petrol,','[Excel import] STM-ON-JAL-PUL-099 | Party/Vendor: Shiv borkar | Payment: Cash','2026-04-10 21:13:28.358000'),
  ('Food & Refreshment',60.0,'2026-04-12','dusarbidpimprisarad','Jush ani pani botal','[Excel import] STM-ON-JAL-PUL-101 | Party/Vendor: Shiv borkar | Payment: Cash','2026-04-15 14:09:13.211000'),
  ('Food & Refreshment',120.0,'2026-04-12','dusarbidpimprisarad','Pani ani chay mumbai la yetan','[Excel import] STM-ON-JAL-PUL-102 | Party/Vendor: Shiv borkar | Payment: Cash','2026-04-15 20:57:05.967000'),
  ('Office Expenses',2770.0,'2026-04-13','dusarbidpimprisarad','RO office  and j1','[Excel import] STM-ON-JAL-PUL-103 | Party/Vendor: Shiv borkar | Payment: Cash','2026-04-15 20:59:37.109000'),
  ('Food & Refreshment',180.0,'2026-04-14','khamgaondeulgaonsakharsha','Nasta ani chay','[Excel import] STM-ON-KHA-DEU-SAK-104 | Party/Vendor: Shiv borkar | Payment: Cash','2026-04-15 21:00:41.746000'),
  ('Food & Refreshment',39108.0,'2026-04-14','khamgaondeulgaonsakharsha','Adjustment','[Excel import] STM-ON-KHA-DEU-SAK-105 | Party/Vendor: Shiv borkar | Payment: Cash','2026-04-15 21:00:41.746000'),
  ('Office Expenses',-39008.0,'2026-04-13','dusarbidpimprisarad','adjustment','[Excel import] STM-ON-KHA-DEU-SAK-103 | Party/Vendor: Shiv borkar | Payment: Cash','2026-04-15 20:59:37.109000'),
  ('Fuel & Transport',150.0,'2026-04-20','khamgaondeulgaonsakharsha','Riksha bhad Akola. Sagal','[Excel import] STM-ON-KHA-DEU-SAK-095 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-04-21 20:37:39.782000'),
  ('Office Expenses',60.0,'2026-04-20','khamgaondeulgaonsakharsha','Pen ani Thand lassi pani botal','[Excel import] STM-ON-KHA-DEU-SAK-096 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-04-21 20:39:00.518000'),
  ('Miscellaneous',235.0,'2026-04-20','khamgaondeulgaonsakharsha','Shendurja te akola','[Excel import] STM-ON-KHA-DEU-SAK-097 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-04-21 20:40:31.425000'),
  ('Office Expenses',15000.0,'2026-04-20','khamgaondeulgaonsakharsha','Komal athavle','[Excel import] STM-ON-KHA-DEU-SAK-098 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-04-21 20:41:26.759000'),
  ('Office Expenses',45000.0,'2026-04-20','khamgaondeulgaonsakharsha','Partunde  saheb bill from sathi','[Excel import] STM-ON-KHA-DEU-SAK-099 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-04-21 20:42:55.953000'),
  ('Office Expenses',15000.0,'2026-04-20','khamgaondeulgaonsakharsha','Padhye saheb Sain sathi','[Excel import] STM-ON-KHA-DEU-SAK-100 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-04-21 20:44:28.025000'),
  ('Office Expenses',20000.0,'2026-04-20','khamgaondeulgaonsakharsha','Acauntat saheb','[Excel import] STM-ON-KHA-DEU-SAK-101 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-04-21 20:46:06.174000'),
  ('Food & Refreshment',220.0,'2026-04-20','khamgaondeulgaonsakharsha','Jevan , pani botal','[Excel import] STM-ON-KHA-DEU-SAK-102 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-04-21 20:47:53.830000'),
  ('Miscellaneous',265.0,'2026-04-20','khamgaondeulgaonsakharsha','Riksha , tren  thane to  Ghar saheb','[Excel import] STM-ON-KHA-DEU-SAK-103 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-04-21 20:49:42.017000'),
  ('Food & Refreshment',700.0,'2026-04-21','khamgaondeulgaonsakharsha','Rohit  sir and mi Jevan','[Excel import] STM-ON-KHA-DEU-SAK-104 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-04-21 20:51:30.070000'),
  ('Office Expenses',2000.0,'2026-04-21','khamgaondeulgaonsakharsha','Arvind pande   swaf  aproval.','[Excel import] STM-ON-KHA-DEU-SAK-105 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-04-21 20:52:57.723000'),
  ('Office Expenses',2000.0,'2026-04-21','khamgaondeulgaonsakharsha','Ro  office girish saheb','[Excel import] STM-ON-KHA-DEU-SAK-106 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-04-21 20:54:15.214000'),
  ('Food & Refreshment',1600.0,'2026-04-21','khamgaondeulgaonsakharsha','Rohit sir and mi fish  jevan','[Excel import] STM-ON-KHA-DEU-SAK-107 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-04-21 20:55:11.185000'),
  ('Food & Refreshment',60.0,'2026-04-22','khamgaondeulgaonsakharsha','Nasta sauth india','[Excel import] STM-ON-KHA-DEU-SAK-108 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-04-22 09:42:10.461000'),
  ('Food & Refreshment',400.0,'2026-04-22','khamgaondeulgaonsakharsha','Pav bhaji khali 2 ghani','[Excel import] STM-ON-KHA-DEU-SAK-109 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-04-22 15:08:09.971000'),
  ('Food & Refreshment',300.0,'2026-04-23','khamgaondeulgaonsakharsha','Unlimited Jevan 2','[Excel import] STM-ON-KHA-DEU-SAK-110 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-04-23 16:52:18.677000'),
  ('Site Materials',100.0,'2026-04-23','khamgaondeulgaonsakharsha','Gadi vafar majury','[Excel import] STM-ON-KHA-DEU-SAK-111 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-04-23 17:46:19.366000'),
  ('Food & Refreshment',400.0,'2026-04-24','khamgaondeulgaonsakharsha','Shankar palyas   2 jevan','[Excel import] STM-ON-KHA-DEU-SAK-112 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-04-24 14:26:35.770000'),
  ('Food & Refreshment',1106.0,'2026-04-25','khamgaondeulgaonsakharsha','Nasta. And toll   bharala','[Excel import] STM-ON-KHA-DEU-SAK-113 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-04-25 10:39:01.257000'),
  ('Fuel & Transport',5000.0,'2026-04-25','khamgaondeulgaonsakharsha','Petrol creta','[Excel import] STM-ON-KHA-DEU-SAK-114 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-04-25 14:15:50.484000'),
  ('Food & Refreshment',70.0,'2026-05-02','khamgaondeulgaonsakharsha','Dudha gheta s. Kherda','[Excel import] STM-ON-KHA-DEU-SAK-115 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-05-02 19:55:46.376000'),
  ('Site Materials',930.0,'2026-05-13','khamgaondeulgaonsakharsha','L bo and chek nat  vaysar petrol 500','[Excel import] STM-ON-KHA-DEU-SAK-116 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-05-13 18:16:48.918000'),
  ('Fuel & Transport',1000.0,'2026-05-26','sangrampurmpborder','Petrol gadit 1000','[Excel import] STM-ON-SHE-MP-BOR-117 | Party/Vendor: Shiv Borkar | Payment: UPI','2026-05-26 10:34:44.878000'),
  ('Food & Refreshment',120.0,'2026-05-26','sangrampurmpborder','Pani botal 3 and jevan','[Excel import] STM-ON-SHE-MP-BOR-118 | Party/Vendor: Shiv Borkar | Payment: UPI','2026-05-26 17:30:15.805000'),
  ('Food & Refreshment',1400.0,'2026-05-26','sangrampurmpborder','Hotel room','[Excel import] STM-ON-SHE-MP-BOR-119 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-05-26 21:15:55.669000'),
  ('Food & Refreshment',190.0,'2026-05-26','sangrampurmpborder','Jevan kel ratri ch','[Excel import] STM-ON-SHE-MP-BOR-120 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-05-26 21:59:34.821000'),
  ('Food & Refreshment',180.0,'2026-05-27','sangrampurmpborder','Jevan ani pani boatal','[Excel import] STM-ON-SHE-MP-BOR-121 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-05-27 12:28:00.014000'),
  ('Fuel & Transport',1000.0,'2026-05-29','sangrampurmpborder','Petrol gadit','[Excel import] STM-ON-SHE-MP-BOR-123 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-05-29 11:22:33.820000'),
  ('Miscellaneous',1600.0,'2026-05-29','sangrampurmpborder','Room hotel','[Excel import] STM-ON-SHE-MP-BOR-124 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-05-29 15:43:34.883000'),
  ('Food & Refreshment',210.0,'2026-05-29','sangrampurmpborder','Jevan ,botal pani','[Excel import] STM-ON-SHE-MP-BOR-125 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-05-29 15:45:20.447000'),
  ('Food & Refreshment',88.0,'2026-05-29','sangrampurmpborder','Rahul ,mi , JE dhondge. Saheb thand ghetal','[Excel import] STM-ON-SHE-MP-BOR-126 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-05-29 18:49:15.619000'),
  ('Food & Refreshment',65.0,'2026-05-27','sangrampurmpborder','Dupari thand ghet 2 pani botal ghetlya','[Excel import] STM-ON-SHE-MP-BOR-127 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-05-29 19:22:39.109000'),
  ('Food & Refreshment',120.0,'2026-05-29','sangrampurmpborder','Jevan ani pani botal','[Excel import] STM-ON-SHE-MP-BOR-128 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-05-29 21:15:35.571000'),
  ('Food & Refreshment',260.0,'2026-05-30','sangrampurmpborder','Jevan , pani botal','[Excel import] STM-ON-SHE-MP-BOR-129 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-05-30 18:07:55.388000'),
  ('Miscellaneous',1600.0,'2026-05-30','sangrampurmpborder','Room hotel','[Excel import] STM-ON-SHE-MP-BOR-130 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-05-30 19:02:37.392000'),
  ('Food & Refreshment',260.0,'2026-05-31','sangrampurmpborder','Jevan sakali','[Excel import] STM-ON-SHE-MP-BOR-131 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-05-31 17:28:56.556000'),
  ('Food & Refreshment',1600.0,'2026-05-31','sangrampurmpborder','Room hotel','[Excel import] STM-ON-SHE-MP-BOR-132 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-05-31 17:29:59.202000'),
  ('Food & Refreshment',550.0,'2026-05-31','sangrampurmpborder','Rahul khete and mi 2','[Excel import] STM-ON-SHE-MP-BOR-133 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-05-31 17:30:46.164000'),
  ('Food & Refreshment',230.0,'2026-06-01','sangrampurmpborder','Jevan sakali ch','[Excel import] STM-ON-SHE-MP-BOR-134 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-06-01 17:19:40.204000'),
  ('Food & Refreshment',165.0,'2026-06-01','sangrampurmpborder','Pani thand ghetal rahul mi ani saheb','[Excel import] STM-ON-SHE-MP-BOR-135 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-06-01 17:21:22.382000'),
  ('Food & Refreshment',285.0,'2026-06-01','sangrampurmpborder','Jevan pani botal 2','[Excel import] STM-ON-JAL-PUL-136 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-06-01 19:44:20.602000'),
  ('Fuel & Transport',550.0,'2026-06-02','sangrampurmpborder','Petrol gadit ghari jatana','[Excel import] STM-ON-SHE-MP-BOR-137 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-06-02 07:30:57.838000'),
  ('Site Materials',190.0,'2026-06-04','sangrampurmpborder','Likiz kadhle  matrel sahitya ghetal
Kapling sulochan lotta  aripata','[Excel import] STM-ON-JAL-PUL-138 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-06-04 16:07:30.426000'),
  ('Labour Wages',500.0,'2026-06-04','sangrampurmpborder','Paip lain likij kadhale','[Excel import] STM-ON-SHE-MP-BOR-139 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-06-04 16:59:26.469000'),
  ('Miscellaneous',500.0,'2026-06-01','sangrampurmpborder','Room rest shegaon','[Excel import] STM-ON-SHE-MP-BOR-140 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-06-06 21:42:32.170000'),
  ('Food & Refreshment',80.0,'2026-06-07','sangrampurmpborder','Nasta  pani botal','[Excel import] STM-ON-SHE-MP-BOR-141 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-06-07 10:38:25.199000'),
  ('Miscellaneous',40.0,'2026-06-07','sangrampurmpborder','Dayry ghetli pakit','[Excel import] STM-ON-SHE-MP-BOR-142 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-06-07 10:45:30.617000'),
  ('Fuel & Transport',1000.0,'2026-06-07','sangrampurmpborder','Petrol gadit','[Excel import] STM-ON-SHE-MP-BOR-143 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-06-07 11:36:52.876000'),
  ('Food & Refreshment',20.0,'2026-06-07','sangrampurmpborder','Pani botal','[Excel import] STM-ON-SHE-MP-BOR-144 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-06-07 16:08:44.676000'),
  ('Miscellaneous',1800.0,'2026-06-07','sangrampurmpborder','Room hotel','[Excel import] STM-ON-SHE-MP-BOR-145 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-06-07 18:05:18.719000'),
  ('Miscellaneous',18876.0,'2026-06-07','khamgaondeulgaonsakharsha','Adjusted to Shegaon Sangrampur','[Excel import] STM-ON-KHA-DEU-SAK-146 | Party/Vendor: Adjustment to shegaon sangrampur | Payment: Cash','2026-06-07 19:39:00.574000'),
  ('Food & Refreshment',270.0,'2026-06-07','sangrampurmpborder','Jevan','[Excel import] STM-ON-SHE-MP-BOR-148 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-06-07 20:39:20.505000'),
  ('Food & Refreshment',20.0,'2026-06-07','sangrampurmpborder','Pani botal','[Excel import] STM-ON-SHE-MP-BOR-149 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-06-07 20:53:32.766000'),
  ('Food & Refreshment',240.0,'2026-06-08','sangrampurmpborder','Jevan','[Excel import] STM-ON-SHE-MP-BOR-150 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-06-08 11:54:19.847000'),
  ('Food & Refreshment',30.0,'2026-06-08','sangrampurmpborder','Nasta kela','[Excel import] STM-ON-SHE-MP-BOR-151 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-06-08 15:58:27.371000'),
  ('Miscellaneous',1600.0,'2026-06-08','sangrampurmpborder','Room hotel','[Excel import] STM-ON-SHE-MP-BOR-152 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-06-08 21:07:58.684000'),
  ('Food & Refreshment',280.0,'2026-06-08','sangrampurmpborder','Jevan','[Excel import] STM-ON-SHE-MP-BOR-153 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-06-08 21:08:41.299000'),
  ('Miscellaneous',10.0,'2026-06-08','sangrampurmpborder','Saban','[Excel import] STM-ON-SHE-MP-BOR-154 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-06-08 21:11:10.051000'),
  ('Food & Refreshment',100.0,'2026-06-09','sangrampurmpborder','Nasta','[Excel import] STM-ON-SHE-MP-BOR-155 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-06-09 15:22:43.065000'),
  ('Food & Refreshment',675.0,'2026-06-09','sangrampurmpborder','Jevan 3','[Excel import] STM-ON-SHE-MP-BOR-156 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-06-09 19:46:27.163000'),
  ('Miscellaneous',1600.0,'2026-06-09','sangrampurmpborder','Room hotel','[Excel import] STM-ON-SHE-MP-BOR-159 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-06-09 20:26:14.910000'),
  ('Food & Refreshment',20.0,'2026-06-09','sangrampurmpborder','Pani botal','[Excel import] STM-ON-SHE-MP-BOR-160 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-06-09 20:28:39.362000'),
  ('Food & Refreshment',210.0,'2026-06-10','sangrampurmpborder','Thand ghetal freind bhetale','[Excel import] STM-ON-SHE-MP-BOR-162 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-06-10 13:52:27.060000'),
  ('Food & Refreshment',280.0,'2026-06-10','sangrampurmpborder','Jevan','[Excel import] STM-ON-SHE-MP-BOR-163 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-06-10 13:54:11.518000'),
  ('Food & Refreshment',430.0,'2026-06-10','sangrampurmpborder','Jevan kel 2','[Excel import] STM-ON-SHE-MP-BOR-164 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-06-10 16:14:13.603000'),
  ('Food & Refreshment',80.0,'2026-06-10','sangrampurmpborder','Nasta','[Excel import] STM-ON-SHE-MP-BOR-165 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-06-10 16:15:51.792000'),
  ('Food & Refreshment',40.0,'2026-06-10','sangrampurmpborder','Pani botal 2','[Excel import] STM-ON-SHE-MP-BOR-166 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-06-10 16:16:34.439000'),
  ('Food & Refreshment',970.0,'2026-06-10','sangrampurmpborder','Petrol gadit','[Excel import] STM-ON-SHE-MP-BOR-167 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-06-10 16:28:45.053000'),
  ('Food & Refreshment',105.0,'2026-06-13','sangrampurmpborder','Jush  105','[Excel import] STM-ON-SHE-MP-BOR-168 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-06-13 17:28:00.604000'),
  ('Food & Refreshment',60.0,'2026-06-16','sangrampurmpborder','Thand ... Ani pani botal','[Excel import] STM-ON-SHE-MP-BOR-169 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-06-16 13:44:06.200000'),
  ('Fuel & Transport',1000.0,'2026-06-17','sangrampurmpborder','Petrol  casshhh anayala jatana. Ambetakli','[Excel import] STM-ON-SHE-MP-BOR-170 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-06-17 14:37:47.709000'),
  ('Food & Refreshment',260.0,'2026-06-19','sangrampurmpborder','Jevan 2 zan','[Excel import] STM-ON-SHE-MP-BOR-171 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-06-19 13:19:50.375000'),
  ('Fuel & Transport',1000.0,'2026-06-19','sangrampurmpborder','Petrol gadit','[Excel import] STM-ON-SHE-MP-BOR-172 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-06-19 13:20:48.326000'),
  ('Food & Refreshment',20.0,'2026-06-19','sangrampurmpborder','Pani botal','[Excel import] STM-ON-SHE-MP-BOR-173 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-06-19 13:21:21.961000'),
  ('Labour Wages',500.0,'2026-06-19','sangrampurmpborder','Majury','[Excel import] STM-ON-SHE-MP-BOR-174 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-06-20 11:58:19.457000'),
  ('Food & Refreshment',80.0,'2026-06-22','sangrampurmpborder','Nasta ani pani botal','[Excel import] STM-ON-SHE-MP-BOR-175 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-06-22 08:34:37.753000'),
  ('Fuel & Transport',1200.0,'2026-06-22','sangrampurmpborder','Petrol gadit','[Excel import] STM-ON-SHE-MP-BOR-176 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-06-22 11:41:42.819000'),
  ('Food & Refreshment',570.0,'2026-06-22','sangrampurmpborder','Jevan 3  zan','[Excel import] STM-ON-SHE-MP-BOR-177 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-06-22 20:09:21.427000'),
  ('Food & Refreshment',20.0,'2026-06-22','sangrampurmpborder','Pani botal','[Excel import] STM-ON-SHE-MP-BOR-178 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-06-22 20:10:00.374000'),
  ('Food & Refreshment',20.0,'2026-06-22','sangrampurmpborder','Chay, ani pani botal','[Excel import] STM-ON-SHE-MP-BOR-179 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-06-22 20:10:54.390000'),
  ('Food & Refreshment',90.0,'2026-06-24','sangrampurmpborder','Nasta ani chay ghetala  poretar rahul','[Excel import] STM-ON-SHE-MP-BOR-180 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-06-25 09:20:14.440000'),
  ('Food & Refreshment',130.0,'2026-06-24','sangrampurmpborder','Pani botal ani nasta Dupari   opretar ani mi','[Excel import] STM-ON-SHE-MP-BOR-181 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-06-25 09:22:08.216000'),
  ('Fuel & Transport',1000.0,'2026-06-25','sangrampurmpborder','Petrol gadit mejar','[Excel import] STM-ON-SHE-MP-BOR-182 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-06-25 09:22:58.465000'),
  ('Miscellaneous',100.0,'2026-06-25','sangrampurmpborder','Gadi repering kel gadi problem','[Excel import] STM-ON-SHE-MP-BOR-183 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-06-25 09:25:10.324000'),
  ('Food & Refreshment',20.0,'2026-06-19','sangrampurmpborder','Pani boatl','[Excel import] STM-ON-SHE-MP-BOR-184 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-06-25 19:46:56.929000'),
  ('Food & Refreshment',10.0,'2026-06-22','sangrampurmpborder','Pani boatal','[Excel import] STM-ON-SHE-MP-BOR-185 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-06-25 19:47:40.094000'),
  ('Office Expenses',200000.0,'2026-06-22','sangrampurmpborder','Akola Chawhan EE','[Excel import] STM-ON-SHE-MP-BOR-187 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-06-25 19:52:43.845000'),
  ('Miscellaneous',2970.0,'2026-06-26','sangrampurmpborder','Gadi repering','[Excel import] STM-ON-SHE-MP-BOR-189 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-06-26 19:26:12.094000'),
  ('Office Expenses',970.0,'2026-06-26','sangrampurmpborder','Ren cot','[Excel import] STM-ON-SHE-MP-BOR-190 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-06-26 19:27:36.370000'),
  ('Fuel & Transport',1000.0,'2026-06-28','sangrampurmpborder','Petrol gadit jalgaon jamod sangaram pur','[Excel import] STM-ON-SHE-MP-BOR-191 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-06-28 12:44:11.899000'),
  ('Office Expenses',280000.0,'2026-06-30','sangrampurmpborder','Nilesh kokare sir mehakar  neun dile','[Excel import] STM-ON-SHE-MP-BOR-192 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-07-01 11:13:28.533000'),
  ('Miscellaneous',100.0,'2026-07-07','sangrampurmpborder','Gadi no. Plyet','[Excel import] STM-ON-SHE-MP-BOR-193 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-07-07 14:29:12.509000'),
  ('Office Expenses',1000.0,'2026-07-07','sangrampurmpborder','Cash','[Excel import] STM-ON-SHE-MP-BOR-194 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-07-07 14:57:22.893000'),
  ('Miscellaneous',1050.0,'2026-07-07','sangrampurmpborder','Helmet ⛑️ getal','[Excel import] STM-ON-SHE-MP-BOR-196 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-07-07 17:00:27.418000'),
  ('Miscellaneous',25.0,'2026-07-07','sangrampurmpborder','Rabar pakit','[Excel import] STM-ON-SHE-MP-BOR-197 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-07-07 17:53:12.350000'),
  ('Office Expenses',300000.0,'2026-07-10','sangrampurmpborder','Kachale saheb indri la neun dile','[Excel import] STM-ON-SHE-MP-BOR-199 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-07-10 14:40:50.233000'),
  ('Miscellaneous',300.0,'2026-07-21','sangrampurmpborder','Seving ac open shiv ch','[Excel import] STM-ON-SHE-MP-BOR-200 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-07-21 14:45:32.860000'),
  ('Miscellaneous',2000.0,'2026-07-22','sangrampurmpborder','Bill anun dil   tyala. Dile','[Excel import] STM-ON-SHE-MP-BOR-201 | Party/Vendor: Shiv Borkar | Payment: UPI','2026-07-22 16:32:40.091000'),
  ('Food & Refreshment',80.0,'2026-07-22','sangrampurmpborder','Nasta. Nai chay','[Excel import] STM-ON-SHE-MP-BOR-202 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-07-22 16:33:13.664000'),
  ('Office Expenses',2000.0,'2026-07-22','sangrampurmpborder','Gadi bhade dile jalna  bila sathi','[Excel import] STM-ON-SHE-MP-BOR-203 | Party/Vendor: Shiv Borkar | Payment: UPI','2026-07-22 18:01:45.843000'),
  ('Fuel & Transport',1000.0,'2026-07-23','sangrampurmpborder','Petrol gadit takal','[Excel import] STM-ON-SHE-MP-BOR-205 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-07-23 12:00:46.733000'),
  ('Office Expenses',1000.0,'2026-07-26','sangrampurmpborder','Nottry bond. Var keli mehkar','[Excel import] STM-ON-SHE-MP-BOR-206 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-07-26 19:19:20.115000'),
  ('Office Expenses',2700.0,'2026-07-27','sangrampurmpborder','Matoshri bank carant account opne','[Excel import] STM-ON-SHE-MP-BOR-207 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-07-27 10:56:01.292000'),
  ('Office Expenses',100.0,'2026-07-27','sangrampurmpborder','Chek book carant account','[Excel import] STM-ON-SHE-MP-BOR-208 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-07-27 13:19:31.042000'),
  ('Office Expenses',100000.0,'2026-07-28','sangrampurmpborder','मातोश्री बँक   cass घेतली','[Excel import] STM-ON-SHE-MP-BOR-209 | Party/Vendor: Shiv Borkar | Payment: UPI','2026-07-28 13:30:28.003000'),
  ('Fuel & Transport',365.0,'2026-08-03','sangrampurmpborder','Shendurja to khamgaon to akola','[Excel import] STM-ON-SHE-MP-BOR-212 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-08-03 20:45:17.450000'),
  ('Food & Refreshment',140.0,'2026-08-03','sangrampurmpborder','Jevan','[Excel import] STM-ON-SHE-MP-BOR-213 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-08-03 20:46:24.163000'),
  ('Fuel & Transport',50.0,'2026-08-03','sangrampurmpborder','Riksha','[Excel import] STM-ON-SHE-MP-BOR-214 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-08-03 20:48:59.784000'),
  ('Office Expenses',55.0,'2026-08-03','sangrampurmpborder','Zerox','[Excel import] STM-ON-SHE-MP-BOR-215 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-08-03 20:51:45.499000'),
  ('Fuel & Transport',50.0,'2026-08-03','sangrampurmpborder','Riksha','[Excel import] STM-ON-SHE-MP-BOR-216 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-08-03 20:53:02.083000'),
  ('Food & Refreshment',25.0,'2026-08-03','sangrampurmpborder','Nasta  kela','[Excel import] STM-ON-SHE-MP-BOR-217 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-08-03 20:55:36.954000'),
  ('Fuel & Transport',30.0,'2026-08-03','sangrampurmpborder','Riksha','[Excel import] STM-ON-SHE-MP-BOR-218 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-08-03 20:57:35.189000'),
  ('Fuel & Transport',20.0,'2026-08-03','sangrampurmpborder','Riksha','[Excel import] STM-ON-SHE-MP-BOR-219 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-08-03 20:59:04.688000'),
  ('Office Expenses',1100.0,'2026-08-03','sangrampurmpborder','Room Akola','[Excel import] STM-ON-SHE-MP-BOR-220 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-08-03 21:07:43.340000'),
  ('Food & Refreshment',230.0,'2026-08-03','sangrampurmpborder','Jevan pani botal','[Excel import] STM-ON-SHE-MP-BOR-221 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-08-03 21:09:03.855000'),
  ('Office Expenses',30.0,'2026-08-04','sangrampurmpborder','Riksh','[Excel import] STM-ON-SHE-MP-BOR-222 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-08-06 06:16:28.585000'),
  ('Office Expenses',488.0,'2026-08-04','sangrampurmpborder','Zerox','[Excel import] STM-ON-SHE-MP-BOR-223 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-08-06 06:17:29.460000'),
  ('Office Expenses',30000.0,'2026-08-04','sangrampurmpborder','Paturde la 30000 dile','[Excel import] STM-ON-SHE-MP-BOR-224 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-08-06 06:18:56.528000'),
  ('Office Expenses',170.0,'2026-08-04','sangrampurmpborder','Jevan kel','[Excel import] STM-ON-SHE-MP-BOR-225 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-08-06 06:20:04.905000'),
  ('Office Expenses',30.0,'2026-08-04','sangrampurmpborder','Riksh','[Excel import] STM-ON-SHE-MP-BOR-226 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-08-06 06:21:44.016000'),
  ('Office Expenses',240.0,'2026-08-04','sangrampurmpborder','Jevan ratry ch pani botal','[Excel import] STM-ON-SHE-MP-BOR-227 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-08-06 06:23:30.173000'),
  ('Office Expenses',105.0,'2026-08-04','sangrampurmpborder','Khamgao band','[Excel import] STM-ON-SHE-MP-BOR-228 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-08-06 06:25:21.644000'),
  ('Office Expenses',30.0,'2026-08-04','sangrampurmpborder','Riksh bhad khamgon','[Excel import] STM-ON-SHE-MP-BOR-229 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-08-06 06:28:34.953000'),
  ('Office Expenses',1700.0,'2026-08-04','sangrampurmpborder','Room keli khamgon mahde','[Excel import] STM-ON-SHE-MP-BOR-230 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-08-06 06:29:56.938000'),
  ('Office Expenses',20.0,'2026-08-05','sangrampurmpborder','Riksha','[Excel import] STM-ON-SHE-MP-BOR-231 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-08-06 06:41:57.257000'),
  ('Food & Refreshment',80.0,'2026-08-05','sangrampurmpborder','Nasta','[Excel import] STM-ON-SHE-MP-BOR-232 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-08-06 06:43:33.915000'),
  ('Office Expenses',678.0,'2026-08-05','sangrampurmpborder','Prind yellow colour','[Excel import] STM-ON-SHE-MP-BOR-233 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-08-06 06:45:17.244000'),
  ('Office Expenses',50.0,'2026-08-05','sangrampurmpborder','Riksh 2 vela','[Excel import] STM-ON-SHE-MP-BOR-234 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-08-06 06:47:55.385000'),
  ('Food & Refreshment',280.0,'2026-08-05','sangrampurmpborder','Jevan pani botal','[Excel import] STM-ON-SHE-MP-BOR-235 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-08-06 06:50:56.523000'),
  ('Office Expenses',280.0,'2026-08-05','sangrampurmpborder','Print yellow colour  ani pen','[Excel import] STM-ON-SHE-MP-BOR-236 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-08-06 06:54:51.176000'),
  ('Office Expenses',80.0,'2026-08-05','sangrampurmpborder','Riksh 3 vela','[Excel import] STM-ON-SHE-MP-BOR-237 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-08-06 06:59:24.929000'),
  ('Office Expenses',40.0,'2026-08-05','sangrampurmpborder','Coffee gheyali dhondge , mi','[Excel import] STM-ON-SHE-MP-BOR-238 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-08-06 07:02:40.037000'),
  ('Miscellaneous',1400.0,'2026-08-05','sangrampurmpborder','Room','[Excel import] STM-ON-SHE-MP-BOR-239 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-08-06 07:04:49.451000'),
  ('Miscellaneous',30.0,'2026-08-05','sangrampurmpborder','Riksha','[Excel import] STM-ON-SHE-MP-BOR-240 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-08-06 07:05:41.250000'),
  ('Miscellaneous',30.0,'2026-08-05','sangrampurmpborder','Riksha','[Excel import] STM-ON-SHE-MP-BOR-241 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-08-06 07:05:59.195000'),
  ('Miscellaneous',30.0,'2026-08-05','sangrampurmpborder','Riksha','[Excel import] STM-ON-SHE-MP-BOR-242 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-08-06 07:06:31.141000'),
  ('Food & Refreshment',330.0,'2026-08-05','sangrampurmpborder','Jevan tuljai hotel','[Excel import] STM-ON-SHE-MP-BOR-243 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-08-06 07:08:14.446000'),
  ('Miscellaneous',30.0,'2026-08-06','sangrampurmpborder','Riksha','[Excel import] STM-ON-SHE-MP-BOR-244 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-08-06 10:28:54.059000'),
  ('Food & Refreshment',20.0,'2026-08-06','sangrampurmpborder','Pani botal','[Excel import] STM-ON-SHE-MP-BOR-245 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-08-06 10:30:53.193000'),
  ('Miscellaneous',135.0,'2026-08-06','sangrampurmpborder','Khamgon to akola shivshahi bas','[Excel import] STM-ON-SHE-MP-BOR-246 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-08-06 10:33:18.957000'),
  ('Office Expenses',30.0,'2026-08-06','sangrampurmpborder','Riksha','[Excel import] STM-ON-SHE-MP-BOR-247 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-08-06 10:34:29.321000'),
  ('Food & Refreshment',250.0,'2026-08-06','sangrampurmpborder','Riksha jevan pani botal','[Excel import] STM-ON-SHE-MP-BOR-248 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-08-07 16:16:24.636000'),
  ('Office Expenses',30000.0,'2026-08-06','sangrampurmpborder','Paturde  Bill','[Excel import] STM-ON-SHE-MP-BOR-249 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-08-07 16:17:55.309000'),
  ('Office Expenses',15000.0,'2026-08-06','sangrampurmpborder','Komal Athavle technical','[Excel import] STM-ON-SHE-MP-BOR-250 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-08-07 16:19:02.789000'),
  ('Food & Refreshment',250.0,'2026-08-06','sangrampurmpborder','Jevan, pani botal','[Excel import] STM-ON-SHE-MP-BOR-251 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-08-07 16:19:59.001000'),
  ('Fuel & Transport',185.0,'2026-08-06','sangrampurmpborder','Travling','[Excel import] STM-ON-SHE-MP-BOR-252 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-08-07 16:21:29.283000'),
  ('Office Expenses',1200.0,'2026-08-06','sangrampurmpborder','Room','[Excel import] STM-ON-SHE-MP-BOR-253 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-08-07 16:22:18.433000'),
  ('Food & Refreshment',180.0,'2026-08-07','sangrampurmpborder','Jevan','[Excel import] STM-ON-SHE-MP-BOR-254 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-08-07 16:23:49.233000'),
  ('Fuel & Transport',400.0,'2026-08-07','sangrampurmpborder','30+370=400
Traveling kharch','[Excel import] STM-ON-SHE-MP-BOR-255 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-08-07 16:26:59.272000'),
  ('Office Expenses',1030.0,'2026-08-09','sangrampurmpborder','Petrol sanyak pani botal','[Excel import] STM-ON-SHE-MP-BOR-256 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-08-11 12:33:37.218000'),
  ('Fuel & Transport',590.0,'2026-08-10','sangrampurmpborder','Riksha ola 3 vela','[Excel import] STM-ON-SHE-MP-BOR-257 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-08-11 12:34:59.479000'),
  ('Office Expenses',3000.0,'2026-08-10','sangrampurmpborder','Pande RO office','[Excel import] STM-ON-SHE-MP-BOR-258 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-08-11 12:36:16.808000'),
  ('Food & Refreshment',140.0,'2026-08-11','sangrampurmpborder','Jevan pani botal','[Excel import] STM-ON-SHE-MP-BOR-259 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-08-11 12:37:44.712000'),
  ('Office Expenses',100000.0,'2026-08-16','sangrampurmpborder','Dhiraj malpani la  dile cash','[Excel import] STM-ON-SHE-MP-BOR-261 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-08-16 15:43:20.541000'),
  ('Office Expenses',260.0,'2026-08-15','sangrampurmpborder','Agreement print ghetlya bond var','[Excel import] STM-ON-SHE-MP-BOR-262 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-08-16 15:44:56.774000'),
  ('Fuel & Transport',1000.0,'2026-08-16','sangrampurmpborder','Petrol wshim jatan','[Excel import] STM-ON-SHE-MP-BOR-263 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-08-23 14:12:19.104000'),
  ('Food & Refreshment',160.0,'2026-08-16','sangrampurmpborder','Jevan pani botal','[Excel import] STM-ON-SHE-MP-BOR-264 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-08-23 14:13:27.801000'),
  ('Office Expenses',20.0,'2026-08-16','sangrampurmpborder','Print ghetali','[Excel import] STM-ON-SHE-MP-BOR-265 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-08-23 14:14:06.984000'),
  ('Office Expenses',500.0,'2026-08-16','sangrampurmpborder','Shikke ani styamp','[Excel import] STM-ON-SHE-MP-BOR-266 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-08-23 14:14:52.064000'),
  ('Office Expenses',3850.0,'2026-08-24','sangrampurmpborder','Bond anle','[Excel import] STM-ON-SHE-MP-BOR-267 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-08-31 17:43:45.810000'),
  ('Food & Refreshment',180.0,'2026-08-26','sangrampurmpborder','Nasta chay','[Excel import] STM-ON-SHE-MP-BOR-268 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-08-31 17:48:15.158000'),
  ('Fuel & Transport',1000.0,'2026-08-26','sangrampurmpborder','Petrol','[Excel import] STM-ON-SHE-MP-BOR-269 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-08-31 17:49:16.097000'),
  ('Miscellaneous',50.0,'2026-08-28','sangrampurmpborder','Rakshabandhan rakhya mammi','[Excel import] STM-ON-SHE-MP-BOR-270 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-08-31 17:51:22.691000'),
  ('Food & Refreshment',130.0,'2026-08-30','sangrampurmpborder','Chikhali, dudha ,','[Excel import] STM-ON-SHE-MP-BOR-271 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-08-31 17:53:05.417000'),
  ('Food & Refreshment',90.0,'2026-09-02','sangrampurmpborder','Dudha ani pani jar anun dila','[Excel import] STM-ON-SHE-MP-BOR-280 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-09-02 09:28:58.533000'),
  ('Office Expenses',2009000.0,'2026-09-02','sangrampurmpborder','Dhiraj malpani cass dili washim','[Excel import] STM-ON-SHE-MP-BOR-284 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-09-02 17:38:30.901000'),
  ('Fuel & Transport',6000.0,'2026-09-03','sangrampurmpborder','Petrol shendurjan to Mumbai','[Excel import] STM-ON-SHE-MP-BOR-286 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-09-04 10:05:20.324000'),
  ('Food & Refreshment',170.0,'2026-09-04','sangrampurmpborder','Chay snyak','[Excel import] STM-ON-SHE-MP-BOR-287 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-09-04 10:06:23.453000'),
  ('Food & Refreshment',1550.0,'2026-09-03','sangrampurmpborder','Jevan 3 malvani tadka','[Excel import] STM-ON-SHE-MP-BOR-288 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-09-04 10:07:42.030000'),
  ('Food & Refreshment',220.0,'2026-09-04','sangrampurmpborder','Nasta dosa','[Excel import] STM-ON-SHE-MP-BOR-289 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-09-04 10:09:06.077000'),
  ('Miscellaneous',150000.0,'2026-09-06','sangrampurmpborder','Hand to hand cash','[Excel import] STM-ON-SHE-MP-BOR-290 | Party/Vendor: Swapnil | Payment: Cash','2026-09-06 12:46:10.518000'),
  ('Food & Refreshment',260.0,'2026-09-06','sangrampurmpborder','Food','[Excel import] STM-ON-SHE-MP-BOR-291 | Party/Vendor: Food | Payment: Cash','2026-09-06 12:47:30.107000'),
  ('Fuel & Transport',34000.0,'2026-09-06','sangrampurmpborder','Packers and movers','[Excel import] STM-ON-SHE-MP-BOR-292 | Party/Vendor: Packers navi | Payment: Cash','2026-09-06 12:48:08.674000'),
  ('Fuel & Transport',5350.0,'2026-09-06','sangrampurmpborder','Petrol','[Excel import] STM-ON-SHE-MP-BOR-293 | Party/Vendor: Petrol | Payment: Cash','2026-09-06 12:48:38.932000'),
  ('Food & Refreshment',600.0,'2026-09-06','sangrampurmpborder','Driver thali','[Excel import] STM-ON-SHE-MP-BOR-294 | Party/Vendor: Food | Payment: Cash','2026-09-06 12:49:06.783000'),
  ('Food & Refreshment',120.0,'2026-09-06','sangrampurmpborder','Food','[Excel import] STM-ON-SHE-MP-BOR-295 | Party/Vendor: Nasta | Payment: Cash','2026-09-06 12:49:39.938000'),
  ('Labour Wages',400.0,'2026-09-06','sangrampurmpborder','Labour','[Excel import] STM-ON-SHE-MP-BOR-296 | Party/Vendor: Labour | Payment: Cash','2026-09-06 12:50:41.973000'),
  ('Site Materials',10000.0,'2026-09-06','sangrampurmpborder','Fan and gyser','[Excel import] STM-ON-SHE-MP-BOR-297 | Party/Vendor: Fan gyser | Payment: Cash','2026-09-06 12:51:12.224000'),
  ('Food & Refreshment',140.0,'2026-09-06','sangrampurmpborder','Bakery','[Excel import] STM-ON-SHE-MP-BOR-298 | Party/Vendor: Bakery | Payment: Cash','2026-09-06 12:51:53.313000'),
  ('Site Materials',240.0,'2026-09-06','sangrampurmpborder','Hardware','[Excel import] STM-ON-SHE-MP-BOR-299 | Party/Vendor: Hardware | Payment: Cash','2026-09-06 12:52:38.306000'),
  ('Labour Wages',2500.0,'2026-09-06','sangrampurmpborder','Rahul  khete levar','[Excel import] STM-ON-SHE-MP-BOR-300 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-09-06 13:14:29.416000'),
  ('Fuel & Transport',260.0,'2026-09-06','sangrampurmpborder','Akola to shendurjan 
Pani botal','[Excel import] STM-ON-SHE-MP-BOR-301 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-09-06 18:50:52.402000'),
  ('Fuel & Transport',1000.0,'2026-09-07','sangrampurmpborder','Petrol gadit','[Excel import] STM-ON-SHE-MP-BOR-302 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-09-07 16:37:41.786000'),
  ('Labour Wages',2000.0,'2026-09-07','sangrampurmpborder','Mayur borkar Mumbai and akola','[Excel import] STM-ON-SHE-MP-BOR-303 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-09-07 16:39:21.368000'),
  ('Miscellaneous',33500.0,'2026-09-11','sangrampurmpborder','Splinckr set and paip','[Excel import] STM-ON-SHE-MP-BOR-310 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-09-11 14:08:27.607000'),
  ('Fuel & Transport',900.0,'2026-09-11','sangrampurmpborder','Gadi bhad hamali fiting','[Excel import] STM-ON-SHE-MP-BOR-311 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-09-11 14:09:41.514000'),
  ('Miscellaneous',120.0,'2026-09-11','sangrampurmpborder','Kadi bend zapdi','[Excel import] STM-ON-SHE-MP-BOR-312 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-09-11 14:10:37.471000'),
  ('Miscellaneous',40.0,'2026-09-11','sangrampurmpborder','Hol tait','[Excel import] STM-ON-SHE-MP-BOR-313 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-09-11 14:11:17.088000'),
  ('Fuel & Transport',2790.0,'2026-09-12','sangrampurmpborder','Gadi bhad ani faral nasta','[Excel import] STM-ON-SHE-MP-BOR-316 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-09-12 17:40:53.053000'),
  ('Office Expenses',1800000.0,'2026-09-12','sangrampurmpborder','Udya dhondge JE','[Excel import] STM-ON-SHE-MP-BOR-317 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-09-12 17:42:15.179000'),
  ('Miscellaneous',237.0,'2026-09-12','sangrampurmpborder','Chota chota kharch','[Excel import] STM-ON-SHE-MP-BOR-318 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-09-12 23:16:53.474000'),
  ('Fuel & Transport',1000.0,'2026-09-14','sangrampurmpborder','Petrol gadit','[Excel import] STM-ON-SHE-MP-BOR-319 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-09-15 18:15:14.422000'),
  ('Food & Refreshment',140.0,'2026-09-14','sangrampurmpborder','Nasta pani botal','[Excel import] STM-ON-SHE-MP-BOR-320 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-09-15 18:16:15.606000'),
  ('Fuel & Transport',5000.0,'2026-09-15','sangrampurmpborder','Akola to deulgaon sakharsha 
Paip C chanal','[Excel import] STM-ON-SHE-MP-BOR-321 | Party/Vendor: Shiv Borkar | Payment: UPI','2026-09-15 18:17:23.274000'),
  ('Fuel & Transport',5000.0,'2026-09-15','sangrampurmpborder','Akola to deulgaon sakharsha 
Paip C chanal','[Excel import] STM-ON-SHE-MP-BOR-322 | Party/Vendor: Shiv Borkar | Payment: UPI','2026-09-15 18:17:59.291000'),
  ('Site Materials',1600.0,'2026-09-16','sangrampurmpborder','सिमेंट','[Excel import] STM-ON-SHE-MP-BOR-325 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-09-16 20:15:34.547000'),
  ('Site Materials',530.0,'2026-09-16','sangrampurmpborder','वेल्डिंग rod कट्टर pan','[Excel import] STM-ON-SHE-MP-BOR-326 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-09-16 20:17:24.370000'),
  ('Fuel & Transport',1500.0,'2026-09-16','sangrampurmpborder','रेती  खडी गाडी भाड,','[Excel import] STM-ON-SHE-MP-BOR-327 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-09-16 20:20:59.440000'),
  ('Food & Refreshment',90.0,'2026-09-16','sangrampurmpborder','चाय  nasta','[Excel import] STM-ON-SHE-MP-BOR-328 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-09-16 20:22:47.507000'),
  ('Site Materials',3200.0,'2026-09-16','sangrampurmpborder','दीपक जाधव ला grandar','[Excel import] STM-ON-SHE-MP-BOR-329 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-09-16 20:24:44.082000'),
  ('Site Materials',1800.0,'2026-09-16','sangrampurmpborder','रेती चे  1800  dile','[Excel import] STM-ON-SHE-MP-BOR-330 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-09-16 20:28:48.176000'),
  ('Fuel & Transport',1000.0,'2026-09-17','sangrampurmpborder','Petrol gadit','[Excel import] STM-ON-SHE-MP-BOR-331 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-09-17 14:19:21.693000'),
  ('Food & Refreshment',80.0,'2026-09-17','sangrampurmpborder','FOB chay nasta','[Excel import] STM-ON-SHE-MP-BOR-332 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-09-17 14:20:10.777000'),
  ('Miscellaneous',500.0,'2026-09-18','sangrampurmpborder','Petrol sathi dile dipak jadhav la','[Excel import] STM-ON-SHE-MP-BOR-334 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-09-20 18:47:29.066000'),
  ('Food & Refreshment',150.0,'2026-09-18','sangrampurmpborder','Chay nasta kela 3','[Excel import] STM-ON-SHE-MP-BOR-335 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-09-20 18:48:12.738000'),
  ('Site Materials',780.0,'2026-09-19','sangrampurmpborder','Colour yellow and black','[Excel import] STM-ON-SHE-MP-BOR-336 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-09-20 18:49:48.580000'),
  ('Food & Refreshment',60.0,'2026-09-19','sangrampurmpborder','Faral ani chay lebar','[Excel import] STM-ON-SHE-MP-BOR-337 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-09-20 18:51:45.228000'),
  ('Food & Refreshment',60.0,'2026-09-19','sangrampurmpborder','Faral ani chay lebar','[Excel import] STM-ON-SHE-MP-BOR-338 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-09-20 18:52:19.447000'),
  ('Fuel & Transport',1200.0,'2026-09-21','sangrampurmpborder','Petrol gadit','[Excel import] STM-ON-SHE-MP-BOR-339 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-09-22 15:06:02.561000'),
  ('Food & Refreshment',185.0,'2026-09-21','sangrampurmpborder','Jevan kel 2jan','[Excel import] STM-ON-SHE-MP-BOR-340 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-09-22 15:06:39.617000'),
  ('Site Materials',1300.0,'2026-09-23','sangrampurmpborder','Colour yellow block raling sathi thinar','[Excel import] STM-ON-SHE-MP-BOR-341 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-09-23 09:22:28.532000'),
  ('Miscellaneous',100000.0,'2026-09-21','sangrampurmpborder','Mammiii kadun ghetle cash  Mumbai varun anale  mammi ne','[Excel import] STM-ON-SHE-MP-BOR-343 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-09-23 11:05:37.933000'),
  ('Miscellaneous',100000.0,'2026-09-21','sangrampurmpborder','Mammy kadu ghetale cash','[Excel import] STM-ON-SHE-MP-BOR-344 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-09-23 11:07:47.266000'),
  ('Food & Refreshment',70.0,'2026-09-21','sangrampurmpborder','मम्मी ला जिनात दुध नेऊन दिले','[Excel import] STM-ON-SHE-MP-BOR-347 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-09-23 14:09:52.830000'),
  ('Food & Refreshment',70.0,'2026-09-21','sangrampurmpborder','मम्मी ला जिनात दुध नेऊन दिले','[Excel import] STM-ON-SHE-MP-BOR-348 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-09-23 14:10:04.077000'),
  ('Labour Wages',1500.0,'2026-09-24','sangrampurmpborder','Rasvanti vala','[Excel import] STM-ON-SHE-MP-BOR-349 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-09-25 07:32:46.929000'),
  ('Food & Refreshment',130.0,'2026-09-25','sangrampurmpborder','Lebar la chay nasta  ratry kam kel tyani','[Excel import] STM-ON-SHE-MP-BOR-350 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-09-25 07:33:46.144000'),
  ('Office Expenses',880000.0,'2026-09-25','sangrampurmpborder','Rohit sir kade jama kele cash gari dele','[Excel import] STM-ON-SHE-MP-BOR-352 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-09-25 15:24:50.263000'),
  ('Office Expenses',100.0,'2026-09-28','sangrampurmpborder','Documents sambhaji nagar to shendurjan','[Excel import] STM-ON-SHE-MP-BOR-353 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-09-28 19:14:35.598000'),
  ('Office Expenses',100.0,'2026-09-28','sangrampurmpborder','Documents sambhaji nagar to shendurjan','[Excel import] STM-ON-SHE-MP-BOR-354 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-09-28 19:15:15.306000'),
  ('Office Expenses',40.0,'2026-09-28','sangrampurmpborder','Agreement copy','[Excel import] STM-ON-SHE-MP-BOR-355 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-09-28 19:18:46.653000'),
  ('Fuel & Transport',1000.0,'2026-09-29','sangrampurmpborder','Petrol gadit','[Excel import] STM-ON-SHE-MP-BOR-356 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-09-29 09:55:26.019000'),
  ('Food & Refreshment',70.0,'2026-09-21','sangrampurmpborder','Mammy la dhudh neundile','[Excel import] STM-ON-SHE-MP-BOR-357 | Party/Vendor: Shiv Borkar | Payment: Cash','2026-09-30 07:45:05.172000')
  ) as v(category, amount, date, pkey, description, remarks, entry_ts)
  join _pc_proj p on p.pkey = v.pkey;
end $$;

-- ---------------------------------------------------------------------
-- VERIFY - compare with the numbers below
-- ---------------------------------------------------------------------
select count(*) as funding_rows, sum(amount) as total_funded
  from petty_cash_in where remarks like '[Excel import]%';
select count(*) as expense_rows, sum(amount) as total_spent
  from petty_cash_expenses where remarks like '[Excel import]%';
select project, count(*), sum(amount) from petty_cash_expenses
  where remarks like '[Excel import]%' group by project order by 1;
-- Expected: funding 51 rows / 6550266.00 ; expenses 313 rows / 6550266.00
