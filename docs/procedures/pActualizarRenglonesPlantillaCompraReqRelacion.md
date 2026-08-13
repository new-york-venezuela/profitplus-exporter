# SP: pActualizarRenglonesPlantillaCompraReqRelacion
**Tipo**: Actualizar
**Módulo**: General

## Tablas Referenciadas
- [`saPlantillaCompraReqRelacion`](../tables/saPlantillaCompraReqRelacion.md)

## Código (excerpt)
```sql
/***********************************************************************
*NOMBRE			:	pActualizarRenglonesPlantillaCompraReqRelacion
*DESCRIPCIÓN	:	Actualiza los renglones de la relacion de requisicioones
*AUTOR			:	SOFTECH SISTEMAS
*MODIFICADO POR	:	SOFTECH SISTEMAS
************************************************************************/

CREATE PROCEDURE [dbo].[pActualizarRenglonesPlantillaCompraReqRelacion]
    (
		@gRowguid_Reng_Req UNIQUEIDENTIFIER,
		@gRowguid_Reng_Imp UNIQUEIDENTIFIER,
		@bEntregado BIT,
		@dFecha_Real_Entrega DateTime,
		@sDocumento char(30),
		@sDoc_Num char(30),
		@dFecha_Doc DateTime,
		@sProv_Des char(120),
		@sCo_Art char(30),
		@sArt_Des char(120),
		@sCo_Uni char(6),
		@sComentario char(512),
		@iRENG_NUMOri int,
		@iRENG_NUM int,
		@sREVISADO char(1),
		@sTRASNFE char(1),
		@sco_sucu_mo char(6),
		@sco_us_mo char(6),
		@growguid UNIQUEIDENTIFIER,
		@sMaquina VARCHAR(60),
		@sCampos VARCHAR(MAX),
		@sEstatus CHAR(1) = '0',
		@deTotal_Art decimal(18,5)
    )
AS 
    BEGIN
        DECLARE @TableTimestamp TABLE
            (
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )
			DECLARE @sCo_Tipo_Doc CHAR (6)
			if @sDocumento = 'Cotización'
				SET @sCo_Tipo_Doc = 'CPRO'
			else if @sDocumento = 'Factura'
				SET @sCo_Tipo_Doc = 'COMP'
			else if @sDocumento = 'Nota de recepcion'
				SET @sCo_Tipo_Doc = 'NREC'
			else if @sDocumento = 'Orden de Compra'
				SET @sCo_Tipo_Doc = 'OCOM'

        UPDATE
            saPlantillaCompraReqRelacion
        SET 
			co_tipo_doc = @sCo_Tipo_Doc, entregado = @bEntregado,fecha_real_entrega = @dFecha_Real_Entrega, comentario = @sComentario,
			revisado = @sREVISADO, TRASNFE = @sTRASNFE, co_sucu_mo = @sco_sucu_mo
        OUTPUT
            inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
            INTO @TableTimestamp
        WHERE
            rowguid_reng_req = @gRowguid_Reng_Req AND  rowguid_reng_imp = @gRowguid_Reng_Imp

        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_mo, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

        IF @dtFe_In IS NOT NULL 
            BEGIN
			-- Insertar Pista
                EXEC pInsertarPista @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_Mo,
                    @sTablaOri = 'saPlantillaCompraReng
```
