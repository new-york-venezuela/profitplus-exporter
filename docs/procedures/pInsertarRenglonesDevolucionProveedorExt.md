# SP: pInsertarRenglonesDevolucionProveedorExt
**Tipo**: Insertar
**Módulo**: Compras

## Tablas Referenciadas
- [`saDevolucionProveedorRengExt`](../tables/saDevolucionProveedorRengExt.md)
- [`saFacturaCompraRengExt`](../tables/saFacturaCompraRengExt.md)

## Código (excerpt)
```sql
CREATE PROC [dbo].[pInsertarRenglonesDevolucionProveedorExt]
	@gRowGuid_Reng UNIQUEIDENTIFIER,
	--@bSin_Der_Cre_Fis BIT,
	@sCredito_fiscal VARCHAR(1),
	@sCampo1 VARCHAR(60) = NULL ,
    @sCampo2 VARCHAR(60) = NULL ,
    @sCampo3 VARCHAR(60) = NULL ,
    @sCampo4 VARCHAR(60) = NULL ,
    @sCampo5 VARCHAR(60) = NULL ,
    @sCampo6 VARCHAR(60) = NULL ,
    @sCampo7 VARCHAR(60) = NULL ,
    @sCampo8 VARCHAR(60) = NULL ,
    @sRevisado CHAR(1) ,
    @sTrasnfe CHAR(1) ,
    @sCo_Us_In CHAR(6) ,
    @sCo_Sucu_In CHAR(6) ,
    @sMaquina VARCHAR(60)
AS
BEGIN 
	DECLARE @TableTimestamp TABLE
            (
              validador VARBINARY(MAX) ,
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )

	DECLARE @bSin_Der_Cre_Fis BIT
	
	SET @bSin_Der_Cre_Fis = NULL
	
	IF EXISTS(SELECT rowguid_reng FROM saDevolucionProveedorRengExt WHERE rowguid_reng= @gRowGuid_Reng)
	BEGIN
		DELETE FROM saDevolucionProveedorRengExt WHERE rowguid_reng = @gRowGuid_Reng
	END

	--IF @bSin_Der_Cre_Fis = 1
	BEGIN
		INSERT INTO saDevolucionProveedorRengExt (
			rowguid_reng, sin_der_cre_fis, campo1, campo2, campo3, campo4, campo5, campo6, campo7, campo8, co_us_in, co_sucu_in,
			fe_us_in, co_us_mo, co_sucu_mo, fe_us_mo, revisado, transfe, credito_fiscal
		)
		OUTPUT  Inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
				INTO @TableTimestamp
		VALUES(
			@gRowGuid_Reng, @bSin_Der_Cre_Fis, @sCampo1, @sCampo2, @sCampo3, @sCampo4, @sCampo5, @sCampo6, @sCampo7, @sCampo8, @sCo_Us_In,
			@sCo_Sucu_In, GETDATE(), @sCo_Us_In, @sCo_Sucu_In, GETDATE(), @sRevisado, @sTrasnfe, @sCredito_fiscal
		)
		DECLARE @dtFe_In DATETIME
		DECLARE @rowGuidOri UNIQUEIDENTIFIER

		SELECT
			@dtFe_In = fe_us_in, @rowGuidOri = rowguid
		FROM
			@TableTimestamp

		-- Insertar Pista
		EXEC pInsertarPista @sUsuario_Id = @sCo_Us_In, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_in,
			@sTablaOri = 'saFacturaCompraRengExt', @rowguidOri = @rowGuidOri, @sTipo_Op = 'I', @sMaquina = @sMaquina,
			@sCampos = @gRowGuid_Reng
		
		SELECT
			*
		FROM
			@TableTimestamp
	END
END
```
