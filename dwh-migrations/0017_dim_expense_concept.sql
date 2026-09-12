-- Classifies saCuentaIngEgr's 248 income/expense concepts (verified live
-- 2026-09-12) into a fixed category taxonomy for Fact_Expenses and the
-- Finanzas tab. See docs/superpowers/specs/2026-09-12-finanzas-compras-design.md
-- section 1.3 for the taxonomy and section 1.6 for why this is a maintained
-- seed table rather than a runtime keyword-matching rule: exactly one
-- reasonable category exists per concept given the fixed list below, and a
-- maintained table makes the EBITDA exclusion (WHERE IsExcludedFromEbitda = 0)
-- trivial and auditable.
--
-- ConceptType:
--   'Gasto'    - a real operating expense, categorized below
--   'Ingreso'  - money coming IN through the bank (e.g. "I-01|Ventas") - NOT
--                a business expense. Fact_Expenses excludes these entirely
--                (Task 2's ETL filters ConceptType <> 'Gasto') because sales
--                revenue already comes from Fact_Sales; including these here
--                would double-count revenue through a second, less-precise
--                channel.
--   'Traspaso' - a transfer between the company's OWN accounts (e.g.
--                "TRASP|Traspaso entre cuentas"), not real economic activity.
--                Also excluded entirely by Task 2's ETL - including these
--                would inflate both "expense" and "income" totals for money
--                that never left the business.
--
-- 'BANCO|Banesco (cheques)' looked transfer-like on first read but its
-- description doesn't actually confirm that (see spec section 1.2) - it is
-- deliberately classified 'Otros'/'Gasto' below, NOT 'Traspaso'. Flag this
-- one row for a human sanity check per spec section 1.6 before this data
-- is relied on for real financial reporting.
--
-- 'E-51|Intereses sobre Prestaciones Sociales' (verified live) is interest
-- expense, not payroll, despite the "E-" prefix shared with many Nomina
-- codes - classified 'Intereses' below (only once; an earlier duplicate
-- listing under 'Nomina' was a plan error and has been removed).
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Dim_ExpenseConcept' AND schema_id = SCHEMA_ID('dim'))
BEGIN
    CREATE TABLE dim.Dim_ExpenseConcept (
        ExpenseConceptKey     int IDENTITY(1,1) NOT NULL PRIMARY KEY,
        ConceptCode           char(20)      NOT NULL UNIQUE,
        ConceptName           varchar(60)   NULL,
        ConceptType           varchar(10)   NOT NULL,
        Category              varchar(20)   NULL,
        IsExcludedFromEbitda  bit           NOT NULL,
        LoadedAtUtc           datetime2(3)  NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_Dim_ExpenseConcept_ConceptCode ON dim.Dim_ExpenseConcept (ConceptCode);
END
GO

IF NOT EXISTS (SELECT 1 FROM dwh.EtlWatermark WHERE SourceTableName = 'saCuentaIngEgr')
    INSERT INTO dwh.EtlWatermark (SourceTableName, LastValidador, LastRunAtUtc, LastRowsProcessed)
    VALUES ('saCuentaIngEgr', 0x0000000000000000, SYSUTCDATETIME(), 0);
GO

-- Seed/classification table, keyed by the exact ConceptCode values found live
-- in saCuentaIngEgr on 2026-09-12 (248 rows). Load_Dim_ExpenseConcept (below)
-- LEFT JOINs the live source table against this seed by trimmed code; any
-- code that exists in the source but NOT in this seed lands as
-- Category='Otros', ConceptType='Gasto', IsExcludedFromEbitda=0 by default
-- (spec section 1.6) - covers future new concepts Profit Plus might add.
--
-- Kept as a permanent table (not a #temp table): dwh.Load_Dim_ExpenseConcept
-- is a stored procedure invoked from later, separate sessions (e.g. the SQL
-- Agent job), and a #temp table created by this migration script would not
-- survive past this script's own session. dim.ExpenseConceptSeed is the
-- durable, re-seedable source the procedure reads on every run.
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ExpenseConceptSeed' AND schema_id = SCHEMA_ID('dim'))
    CREATE TABLE dim.ExpenseConceptSeed (ConceptCode varchar(20) NOT NULL PRIMARY KEY, ConceptType varchar(10) NOT NULL, Category varchar(20) NULL);
GO

TRUNCATE TABLE dim.ExpenseConceptSeed;

INSERT INTO dim.ExpenseConceptSeed (ConceptCode, ConceptType, Category) VALUES
-- Nomina
('136', 'Gasto', 'Nomina'), ('144', 'Gasto', 'Nomina'), ('145', 'Gasto', 'Nomina'),
('146', 'Gasto', 'Nomina'), ('147', 'Gasto', 'Nomina'), ('148', 'Gasto', 'Nomina'),
('149', 'Gasto', 'Nomina'), ('150', 'Gasto', 'Nomina'), ('160', 'Gasto', 'Nomina'),
('161', 'Gasto', 'Nomina'), ('E-04', 'Gasto', 'Nomina'), ('E-13', 'Gasto', 'Nomina'),
('E-14', 'Gasto', 'Nomina'), ('E-100', 'Gasto', 'Nomina'), ('E-100A', 'Gasto', 'Nomina'),
('E-100B', 'Gasto', 'Nomina'), ('E-100C', 'Gasto', 'Nomina'), ('E-101', 'Gasto', 'Nomina'),
('E-101A', 'Gasto', 'Nomina'), ('E-102', 'Gasto', 'Nomina'), ('E-102A', 'Gasto', 'Nomina'),
('E-103', 'Gasto', 'Nomina'), ('E-106', 'Gasto', 'Nomina'), ('E-107', 'Gasto', 'Nomina'),
('E-108', 'Gasto', 'Nomina'), ('E-157', 'Gasto', 'Nomina'), ('E-158', 'Gasto', 'Nomina'),
('E-19', 'Gasto', 'Nomina'), ('E-211', 'Gasto', 'Nomina'), ('E-212', 'Gasto', 'Nomina'),
('E-214', 'Gasto', 'Nomina'), ('E-216', 'Gasto', 'Nomina'), ('E-217', 'Gasto', 'Nomina'),
('E-218', 'Gasto', 'Nomina'), ('E-221', 'Gasto', 'Nomina'), ('E-22', 'Gasto', 'Nomina'),
('E-23', 'Gasto', 'Nomina'),
('E-231', 'Gasto', 'Nomina'), ('E-236', 'Gasto', 'Nomina'), ('E-237', 'Gasto', 'Nomina'),
('E-239', 'Gasto', 'Nomina'), ('E-28', 'Gasto', 'Nomina'), ('E-35', 'Gasto', 'Nomina'),
('E-35A', 'Gasto', 'Nomina'), ('E-35B', 'Gasto', 'Nomina'), ('E-35C', 'Gasto', 'Nomina'),
('E-44', 'Gasto', 'Nomina'), ('E-44A', 'Gasto', 'Nomina'), ('E-44PV', 'Gasto', 'Nomina'),
('E-45', 'Gasto', 'Nomina'), ('E-45A', 'Gasto', 'Nomina'), ('E-45V', 'Gasto', 'Nomina'),
('E-46', 'Gasto', 'Nomina'), ('E-48', 'Gasto', 'Nomina'), ('E-60', 'Gasto', 'Nomina'),
('E-66', 'Gasto', 'Nomina'), ('E-71', 'Gasto', 'Nomina'), ('E-79', 'Gasto', 'Nomina'),
('E-84', 'Gasto', 'Nomina'), ('E-93', 'Gasto', 'Nomina'), ('E-94', 'Gasto', 'Nomina'),
('E-99', 'Gasto', 'Nomina'), ('E-43', 'Gasto', 'Nomina'),
('115', 'Gasto', 'Nomina'), ('117', 'Gasto', 'Nomina'), ('121', 'Gasto', 'Nomina'),
('125', 'Gasto', 'Nomina'), ('151', 'Gasto', 'Nomina'), ('E-38', 'Gasto', 'Nomina'),
('E-54', 'Gasto', 'Nomina'), ('E-55', 'Gasto', 'Nomina'), ('E-104', 'Gasto', 'Nomina'),
-- MateriaPrima
('E-01', 'Gasto', 'MateriaPrima'), ('E-02', 'Gasto', 'MateriaPrima'), ('113', 'Gasto', 'MateriaPrima'),
('120', 'Gasto', 'MateriaPrima'), ('155', 'Gasto', 'MateriaPrima'), ('E-18', 'Gasto', 'MateriaPrima'),
-- Alquileres
('E-10', 'Gasto', 'Alquileres'), ('E-34', 'Gasto', 'Alquileres'), ('E-56', 'Gasto', 'Alquileres'),
('E-57', 'Gasto', 'Alquileres'), ('E-90', 'Gasto', 'Alquileres'), ('E-92', 'Gasto', 'Alquileres'),
('E-95', 'Gasto', 'Alquileres'), ('E-97', 'Gasto', 'Alquileres'), ('128', 'Gasto', 'Alquileres'),
-- Servicios
('163', 'Gasto', 'Servicios'), ('E-25', 'Gasto', 'Servicios'), ('E-26', 'Gasto', 'Servicios'),
('E-27', 'Gasto', 'Servicios'), ('E-42', 'Gasto', 'Servicios'), ('E-52', 'Gasto', 'Servicios'),
('E-219', 'Gasto', 'Servicios'), ('E-220', 'Gasto', 'Servicios'), ('E-224', 'Gasto', 'Servicios'),
('E-238', 'Gasto', 'Servicios'), ('E-240', 'Gasto', 'Servicios'), ('153', 'Gasto', 'Servicios'),
('E-164', 'Gasto', 'Servicios'), ('E-215', 'Gasto', 'Servicios'), ('126', 'Gasto', 'Servicios'),
-- Mantenimiento
('E-30', 'Gasto', 'Mantenimiento'), ('E-32', 'Gasto', 'Mantenimiento'), ('E-59', 'Gasto', 'Mantenimiento'),
('E-72', 'Gasto', 'Mantenimiento'), ('E-96', 'Gasto', 'Mantenimiento'), ('162', 'Gasto', 'Mantenimiento'),
('E-17', 'Gasto', 'Mantenimiento'), ('E-37', 'Gasto', 'Mantenimiento'), ('E-75', 'Gasto', 'Mantenimiento'),
-- Publicidad
('140', 'Gasto', 'Publicidad'), ('E-33', 'Gasto', 'Publicidad'), ('E-226', 'Gasto', 'Publicidad'),
-- Honorarios
('E-61', 'Gasto', 'Honorarios'), ('E-62', 'Gasto', 'Honorarios'), ('E-63', 'Gasto', 'Honorarios'),
('E-65', 'Gasto', 'Honorarios'),
-- Intereses (excluded from EBITDA)
('119', 'Gasto', 'Intereses'), ('124', 'Gasto', 'Intereses'), ('138', 'Gasto', 'Intereses'),
('139', 'Gasto', 'Intereses'), ('143', 'Gasto', 'Intereses'), ('E-51', 'Gasto', 'Intereses'),
('E-69', 'Gasto', 'Intereses'), ('E-78', 'Gasto', 'Intereses'), ('E-100D', 'Gasto', 'Intereses'),
('I-05', 'Ingreso', NULL), ('I-22', 'Ingreso', NULL),
-- Impuestos (excluded from EBITDA)
('109', 'Gasto', 'Impuestos'), ('110', 'Gasto', 'Impuestos'), ('111', 'Gasto', 'Impuestos'),
('122', 'Gasto', 'Impuestos'), ('123', 'Gasto', 'Impuestos'), ('127', 'Gasto', 'Impuestos'),
('152', 'Gasto', 'Impuestos'), ('154', 'Gasto', 'Impuestos'), ('E-20', 'Gasto', 'Impuestos'),
('E-47', 'Gasto', 'Impuestos'), ('E-50', 'Gasto', 'Impuestos'), ('E-53', 'Gasto', 'Impuestos'),
('E-85', 'Gasto', 'Impuestos'), ('E-89', 'Gasto', 'Impuestos'), ('E-98', 'Gasto', 'Impuestos'),
('E-112', 'Gasto', 'Impuestos'), ('E-210', 'Gasto', 'Impuestos'), ('E-223', 'Gasto', 'Impuestos'),
('E-227', 'Gasto', 'Impuestos'), ('E-229', 'Gasto', 'Impuestos'), ('E-230', 'Gasto', 'Impuestos'),
('E-233', 'Gasto', 'Impuestos'), ('E-234', 'Gasto', 'Impuestos'), ('E-235', 'Gasto', 'Impuestos'),
('E-40', 'Gasto', 'Impuestos'), ('E-49', 'Gasto', 'Impuestos'), ('I-32', 'Ingreso', NULL),
-- Otros (real expenses that don't fit the above)
('107', 'Gasto', 'Otros'), ('108', 'Gasto', 'Otros'), ('114', 'Gasto', 'Otros'),
('116', 'Gasto', 'Otros'), ('130', 'Gasto', 'Otros'), ('131', 'Gasto', 'Otros'),
('133', 'Gasto', 'Otros'), ('134', 'Gasto', 'Otros'), ('135', 'Gasto', 'Otros'),
('137', 'Gasto', 'Otros'), ('141', 'Gasto', 'Otros'), ('142', 'Gasto', 'Otros'),
('156', 'Gasto', 'Otros'), ('157', 'Gasto', 'Otros'), ('158', 'Gasto', 'Otros'),
('159', 'Gasto', 'Otros'), ('BANCO', 'Gasto', 'Otros'), ('E-03', 'Gasto', 'Otros'),
('E-05', 'Gasto', 'Otros'), ('E-06', 'Gasto', 'Otros'), ('E-07', 'Gasto', 'Otros'),
('E-08', 'Gasto', 'Otros'), ('E-09', 'Gasto', 'Otros'), ('E-105', 'Gasto', 'Otros'),
('E-109', 'Gasto', 'Otros'), ('E-11', 'Gasto', 'Otros'), ('E-110', 'Gasto', 'Otros'),
('E-111', 'Gasto', 'Otros'), ('E-119', 'Gasto', 'Otros'), ('E-15', 'Gasto', 'Otros'),
('E-16', 'Gasto', 'Otros'), ('E-21', 'Gasto', 'Otros'), ('E-213', 'Gasto', 'Otros'),
('E-222', 'Gasto', 'Otros'), ('E-228', 'Gasto', 'Otros'), ('E-24', 'Gasto', 'Otros'),
('E-29', 'Gasto', 'Otros'), ('E-31', 'Gasto', 'Otros'), ('E-36', 'Gasto', 'Otros'),
('E-39', 'Gasto', 'Otros'), ('E-41', 'Gasto', 'Otros'), ('E-58', 'Gasto', 'Otros'),
('E-67', 'Gasto', 'Otros'), ('E-68', 'Gasto', 'Otros'), ('E-70', 'Gasto', 'Otros'),
('E-73', 'Gasto', 'Otros'), ('E-74', 'Gasto', 'Otros'), ('E-76', 'Gasto', 'Otros'),
('E-80', 'Gasto', 'Otros'), ('E-81', 'Gasto', 'Otros'), ('E-82', 'Gasto', 'Otros'),
('E-83', 'Gasto', 'Otros'), ('E-86', 'Gasto', 'Otros'), ('E-87', 'Gasto', 'Otros'),
('E-88', 'Gasto', 'Otros'), ('E-91', 'Gasto', 'Otros'), ('E232', 'Gasto', 'Otros'),
('129', 'Gasto', 'Otros'), ('132', 'Gasto', 'Otros'),
-- Ingresos (excluded from Fact_Expenses entirely)
('I-01', 'Ingreso', NULL), ('I-02', 'Ingreso', NULL), ('I-03', 'Ingreso', NULL),
('I-04', 'Ingreso', NULL), ('I-06', 'Ingreso', NULL), ('I-07', 'Ingreso', NULL),
('I-09', 'Ingreso', NULL), ('I-10', 'Ingreso', NULL), ('I-11', 'Ingreso', NULL),
('I-12', 'Ingreso', NULL), ('I-13', 'Ingreso', NULL), ('I-14', 'Ingreso', NULL),
('I-15', 'Ingreso', NULL), ('I-16', 'Ingreso', NULL), ('I-17', 'Ingreso', NULL),
('I-18', 'Ingreso', NULL), ('I-19', 'Ingreso', NULL), ('I-20', 'Ingreso', NULL),
('I-21', 'Ingreso', NULL), ('I-23', 'Ingreso', NULL), ('I-24', 'Ingreso', NULL),
('I-25', 'Ingreso', NULL), ('I-26', 'Ingreso', NULL), ('I-27', 'Ingreso', NULL),
('I-28', 'Ingreso', NULL), ('I-29', 'Ingreso', NULL), ('I-30', 'Ingreso', NULL),
('I-31', 'Ingreso', NULL),
-- Traspasos (excluded from Fact_Expenses entirely)
('TRASP', 'Traspaso', NULL), ('E-12', 'Traspaso', NULL), ('I-08', 'Traspaso', NULL);
GO

CREATE OR ALTER PROCEDURE dwh.Load_Dim_ExpenseConcept
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Watermark binary(8) = (SELECT LastValidador FROM dwh.EtlWatermark WHERE SourceTableName = 'saCuentaIngEgr');
    DECLARE @NewWatermark binary(8);
    DECLARE @RowCount int;

    MERGE dim.Dim_ExpenseConcept AS tgt
    USING (
        SELECT
            LTRIM(RTRIM(src.co_cta_ingr_egr)) AS ConceptCode,
            RTRIM(src.descrip) AS ConceptName,
            ISNULL(seed.ConceptType, 'Gasto') AS ConceptType,
            ISNULL(seed.Category, 'Otros') AS Category,
            CASE WHEN seed.Category IN ('Intereses', 'Impuestos') THEN 1 ELSE 0 END AS IsExcludedFromEbitda
        FROM Ncake_a.dbo.saCuentaIngEgr src
        LEFT JOIN dim.ExpenseConceptSeed seed ON LTRIM(RTRIM(seed.ConceptCode)) = LTRIM(RTRIM(src.co_cta_ingr_egr)) COLLATE SQL_Latin1_General_CP1_CI_AS
    ) AS src
        ON LTRIM(RTRIM(tgt.ConceptCode)) = LTRIM(RTRIM(src.ConceptCode)) COLLATE SQL_Latin1_General_CP1_CI_AS
    WHEN MATCHED THEN UPDATE SET
        tgt.ConceptName = src.ConceptName,
        tgt.ConceptType = src.ConceptType,
        tgt.Category = src.Category,
        tgt.IsExcludedFromEbitda = src.IsExcludedFromEbitda,
        tgt.LoadedAtUtc = SYSUTCDATETIME()
    WHEN NOT MATCHED BY TARGET THEN
        INSERT (ConceptCode, ConceptName, ConceptType, Category, IsExcludedFromEbitda)
        VALUES (src.ConceptCode, src.ConceptName, src.ConceptType, src.Category, src.IsExcludedFromEbitda);

    SET @RowCount = @@ROWCOUNT;
    SELECT @NewWatermark = ISNULL(MAX(validador), @Watermark) FROM Ncake_a.dbo.saCuentaIngEgr;

    UPDATE dwh.EtlWatermark
    SET LastValidador = @NewWatermark, LastRunAtUtc = SYSUTCDATETIME(), LastRowsProcessed = @RowCount
    WHERE SourceTableName = 'saCuentaIngEgr';
END
GO
