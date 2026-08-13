# SP: pv_ActualizarFactVtaVendedor
**Tipo**: PV-Actualizar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saFacturaVenta`](../tables/saFacturaVenta.md)

## Código (excerpt)
```sql
/*********************************************************************
*NOMBRE			:	pv_ActualizarFactVtaVendedor
*DESCRIPCIÓN	:	ACTUALIZA EL CODIGO DEL VENDEDOR EN UNA FACTURA DADA
*AUTOR			:	SOFTECH SISTEMAS
*********************************************************************/ 
CREATE PROCEDURE [dbo].[pv_ActualizarFactVtaVendedor]
    (
	  @sDocNum		CHAR(20),
	  @sCodVen		CHAR(6),

      @sCo_Us_Mo	CHAR(6),
      @sCo_Sucu_Mo	CHAR(6)				=	NULL ,
      @sMaquina		VARCHAR(60)			=	NULL ,
      @sCampos		VARCHAR(MAX)		=	NULL ,
      @sRevisado	CHAR(1),
      @sTrasnfe		CHAR(1),
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

		UPDATE saFacturaVenta
			SET co_ven = @sCodVen
			  OUTPUT
					inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
					INTO @TableTimestamp
			WHERE
				doc_num = @sDocNum

  		DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_mo, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

        IF @dtFe_In IS NOT NULL 
            BEGIN
		-- Insertar Pista
                EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_Mo,
                    @sTablaOri = 'saFacturaVenta', @rowguidOri = @rowGuidOri, @sTipo_Op = 'M', @sMaquina = @sMaquina,
                    @sCampos = @sDocNum
            END
	END
```
