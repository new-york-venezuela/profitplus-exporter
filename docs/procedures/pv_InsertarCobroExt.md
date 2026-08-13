# SP: pv_InsertarCobroExt
**Tipo**: PV-Insertar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`pvCobroExt`](../tables/pvCobroExt.md)
- [`pvTurnoExe`](../tables/pvTurnoExe.md)
- [`saCobro`](../tables/saCobro.md)

## Código (excerpt)
```sql
/***********************************************************************
*NOMBRE			: [pv_InsertarCobroExt]
*DESCRIPCIÓN	: INSERTA EL ROWGUID DEL COBRO EN LA TABLA EXTENDIDA 'pvCobroExt'
*AUTOR			: SOFTECH SISTEMAS
************************************************************************/ 
CREATE PROCEDURE [dbo].[pv_InsertarCobroExt]
    (
		@sCobNum			CHAR (20),
		@sNumTurno			CHAR (20),
		
		@sCampo1			VARCHAR(60) = NULL ,
		@sCampo2			VARCHAR(60) = NULL ,
		@sCampo3			VARCHAR(60) = NULL ,
		@sCampo4			VARCHAR(60) = NULL ,
		@sCampo5			VARCHAR(60) = NULL ,
		@sCampo6			VARCHAR(60) = NULL ,
		@sCampo7			VARCHAR(60) = NULL ,
		@sCampo8			VARCHAR(60) = NULL ,
		@sCo_Us_In			CHAR(6) ,
		@sCo_Sucu_In		CHAR(6) ,
		@sMaquina			VARCHAR(60) = NULL ,
		@sRevisado			CHAR(1) ,
		@sTrasnfe			CHAR(1)
    )
AS 
    BEGIN
    
	     DECLARE @TableTimestamp TABLE
            (
              validador VARBINARY(MAX) ,
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )
        
		DECLARE @rowGuidTurno	UNIQUEIDENTIFIER
		DECLARE @rowGuidCobro	UNIQUEIDENTIFIER
              
		SELECT @rowGuidTurno = rowguid FROM pvturnoExe WHERE num_turno = @sNumTurno
		SELECT @rowGuidCobro = rowguid FROM saCobro WHERE cob_num = @sCobNum
     
		INSERT  INTO pvCobroExt (rowguid_cob_num, rowguid_num_turno, co_us_in, fe_us_in, co_us_mo, fe_us_mo)
			OUTPUT  Inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
                INTO @TableTimestamp
						VALUES  (@rowGuidCobro, @rowGuidTurno, @sCo_Us_In, GETDATE(), @sCo_Us_In, GETDATE())
		
		DECLARE @dtFe_In		DATETIME
		DECLARE @rowGuidOri		UNIQUEIDENTIFIER
       
		SET @dtFe_In			= GETDATE()
       
		SELECT
            @dtFe_In = fe_us_in, @rowGuidOri = rowguid
		FROM
            @TableTimestamp
                     
        IF @dtFe_In IS NOT NULL 
            BEGIN
			-- Insertar Pista
                EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_In, @dtFecha = @dtFe_In, 
					@sCo_Sucu = @sCo_Sucu_In, @sTablaOri = 'pvCobroExt', 
					@rowguidOri = @rowGuidOri, @sTipo_Op = 'I', @sMaquina = @sMaquina
            END
    END
```
