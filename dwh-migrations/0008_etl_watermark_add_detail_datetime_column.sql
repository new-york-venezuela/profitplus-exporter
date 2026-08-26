IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dwh.EtlWatermark') AND name = 'LastValidatorDateTime'
)
BEGIN
    ALTER TABLE dwh.EtlWatermark ADD LastValidatorDateTime datetime2(3) NULL;
END
GO
