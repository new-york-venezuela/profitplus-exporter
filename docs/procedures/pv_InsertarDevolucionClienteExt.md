# SP: pv_InsertarDevolucionClienteExt
**Tipo**: PV-Insertar
**Módulo**: Ventas

## Tablas Referenciadas
- [`pvDevolucionClienteExt`](../tables/pvDevolucionClienteExt.md)
- [`pvTurnoExe`](../tables/pvTurnoExe.md)
- [`saDevolucionCliente`](../tables/saDevolucionCliente.md)

## Código (excerpt)
```sql
/*********************************************************************
*NOMBRE			:	[pv_InsertarDevolucionClienteExt]
*DESCRIPCIÓN	:	INSERTA UN REGISTRO EN LA TABLA EXTENDIDA DE DEVOLUCION DE CLIENTE
*AUTOR			:	SOFTECH SISTEMAS
*********************************************************************/ 
CREATE PROCEDURE [dbo].[pv_InsertarDevolucionClienteExt]
    (
		@sNumTurno			CHAR (20),
		@sDocNum			CHAR (20),
	
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
		
		DECLARE @rowGuidDev UNIQUEIDENTIFIER
		DECLARE @rowGuidTurno UNIQUEIDENTIFIER
	  
		SELECT @rowGuidTurno = rowguid FROM pvTurnoExe WHERE num_turno = @sNumTurno
		SELECT @rowGuidDev = rowguid FROM saDevolucionCliente WHERE doc_num = @sDocNum

		INSERT INTO pvDevolucionClienteExt
					(rowguid_doc_num, rowguid_num_turno, co_us_in, co_us_mo, fe_us_in, fe_us_mo) 
					OUTPUT  Inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
                INTO @TableTimestamp
			VALUES  (@rowGuidDev, @rowGuidTurno, @sCo_Us_In, @sCo_Sucu_In, GETDATE(), GETDATE())
	 
		DECLARE @dtFe_In		DATETIME
		DECLARE @rowGuidOri		UNIQUEIDENTIFIER
       
		SET @dtFe_In = GETDATE()
       
		SELECT
            @dtFe_In = fe_us_in, @rowGuidOri = rowguid
		FROM
            @TableTimestamp
                     
        IF @dtFe_In IS NOT NULL 
            BEGIN
			-- Insertar Pista
                EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_In, @dtFecha = @dtFe_In, 
					@sCo_Sucu = @sCo_Sucu_In, @sTablaOri = 'pvDevolucionClienteExt', 
					@rowguidOri = @rowGuidOri, @sTipo_Op = 'I', @sMaquina = @sMaquina
            END
    END
```
