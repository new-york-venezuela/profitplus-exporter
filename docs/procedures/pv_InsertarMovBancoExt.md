# SP: pv_InsertarMovBancoExt
**Tipo**: PV-Insertar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`pvMovimientoBancoExt`](../tables/pvMovimientoBancoExt.md)
- [`pvTurnoExe`](../tables/pvTurnoExe.md)
- [`saMovimientoBanco`](../tables/saMovimientoBanco.md)

## Código (excerpt)
```sql
/***********************************************************************
*NOMBRE			: [pv_InsertarMovBancoExt]
*DESCRIPCIÓN	: INSERTA UN NUEVO REGISTRO EN LA TABLA 'pvMovimientoBancoExt' ASOCIANDOLO AL TURNO Y NUMERO DE MOVIMIENTO DE Banco
				  POR MEDIO DEL ROWGUID DEL TURNO Y MOV DE Banco, SE DISPARA AL INSERTAR UN MOV DE Banco DESDE PUNTO DE VENTA
*AUTOR			: SOFTECH SISTEMAS
************************************************************************/
CREATE PROCEDURE [dbo].[pv_InsertarMovBancoExt]
    (
		@sNumTurno			CHAR (20),
		@sMovBanco			CHAR (20),
		
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
       DECLARE @rowGuidMovBanco	UNIQUEIDENTIFIER
	   DECLARE @rowGuidAJPA		UNIQUEIDENTIFIER
              
       SELECT @rowGuidTurno = rowguid FROM pvturnoExe WHERE num_turno = @sNumTurno
	   SELECT @rowGuidMovBanco = rowguid FROM saMovimientoBanco WHERE mov_num = @sMovBanco
 
     
       INSERT  INTO pvMovimientoBancoExt (rowguid_mov_num, rowguid_num_turno, co_us_in, fe_us_in, co_us_mo, fe_us_mo)
			OUTPUT  Inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
					INTO @TableTimestamp
			VALUES (@rowGuidMovBanco, @rowGuidTurno, @sCo_Us_In, GETDATE(), @sCo_Us_In, GETDATE())    
       
       DECLARE @dtFe_In		DATETIME
       DECLARE @rowGuidOri	UNIQUEIDENTIFIER
       
       SET @dtFe_In			= GETDATE()
       
       SELECT
            @dtFe_In = fe_us_in, @rowGuidOri = rowguid
       FROM
            @TableTimestamp
                     
        IF @dtFe_In IS NOT NULL 
            BEGIN
			-- Insertar Pista
                EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_In, @dtFecha = @dtFe_In, 
					@sCo_Sucu = @sCo_Sucu_In, @sTablaOri = 'pvMovimientoBancoExt', 
					@rowguidOri = @rowGuidOri, @sTipo_Op = 'I', @sMaquina = @sMaqu
```
