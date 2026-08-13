# SP: pv_ActualizarFacturaVentaExtEstado
**Tipo**: PV-Actualizar
**Módulo**: Ventas

## Tablas Referenciadas
- [`pvFacturaVentaExt`](../tables/pvFacturaVentaExt.md)
- [`pvTurnoExe`](../tables/pvTurnoExe.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)

## Código (excerpt)
```sql
/***********************************************************************
*NOMBRE			: [pv_ActualizarFacturaVentaExt]
*DESCRIPCIÓN	: ACTUALIZA EL ESTADO DE UNA FACTURA EN LA TABLA EXTENDIDA 'pvFacturaVentaExt' SEGUN EL 
				  ROWGUID DEL TURNO Y DE LA FACTURA. 'E': Espera, 'N': No procesado, 'P': Procesado
*AUTOR			: SOFTECH SISTEMAS
************************************************************************/ 
CREATE PROCEDURE [dbo].[pv_ActualizarFacturaVentaExtEstado]
    (
		@sCodigoTurno	CHAR (20),
		@sFactNum		CHAR (20),
		@estado         CHAR (1),
		@sCo_Us_Mo		CHAR(6) ,
		@sCo_Sucu_Mo	CHAR(6)				=	NULL ,
		@sMaquina		VARCHAR(60)			=	NULL ,
		@sCampos		VARCHAR(MAX)		=	NULL ,
		@sRevisado		CHAR(1) ,
		@sTrasnfe		CHAR(1) ,
		@tsValidador	TIMESTAMP			=	NULL ,
		@gRowguid		UNIQUEIDENTIFIER	=	NULL 
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

		DECLARE @rowGuidFact UNIQUEIDENTIFIER
		DECLARE @rowGuidTurno UNIQUEIDENTIFIER
	  
		SELECT @rowGuidTurno = rowguid FROM pvturnoExe WHERE num_turno = @sCodigoTurno
		SELECT @rowGuidFact = rowguid FROM safacturaventa WHERE doc_num = @sFactNum

		UPDATE pvFacturaVentaExt SET estado = @estado, co_us_mo = @sCo_Us_Mo, fe_us_mo = GETDATE() 
			OUTPUT inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
				      INTO @TableTimestamp
		WHERE rowguid_num_turno = @rowGuidTurno AND rowguid_doc_num = @rowGuidFact
	    
		DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

		SELECT
            @dtFe_In = fe_us_mo, @rowGuidOri = rowguid
			FROM
				@TableTimestamp

		   IF @dtFe_In IS NOT NULL 
            BEGIN
		-- Insertar PistaS
                EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_Mo,
                    @sTablaOri = 'pvFacturaVentaExt', @rowguidOri = @rowGuidOri, @sTipo_Op = 'M', @sMaquina = @sMaquina,
                    @sCampos = @sFactNum
			END
    END
```
