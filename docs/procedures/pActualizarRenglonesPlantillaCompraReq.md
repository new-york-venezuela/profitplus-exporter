# SP: pActualizarRenglonesPlantillaCompraReq
**Tipo**: Actualizar
**Módulo**: General

## Tablas Referenciadas
- [`saPlantillaCompraReng`](../tables/saPlantillaCompraReng.md)
- [`saPlantillaCompraReqRenglon`](../tables/saPlantillaCompraReqRenglon.md)

## Código (excerpt)
```sql
/***********************************************************************
*NOMBRE			:	pActualizarRenglonesPlantillaCompraReq
*DESCRIPCIÓN	:	Actualiza los renglones de requisicioones
*AUTOR			:	SOFTECH SISTEMAS
*MODIFICADO POR	:	SOFTECH SISTEMAS
************************************************************************/

CREATE PROCEDURE [dbo].[pActualizarRenglonesPlantillaCompraReq]
    (
		@gRowguid_Plantilla_Renglon UNIQUEIDENTIFIER,
		@bSatisface BIT,
		@dFecha_Requerida DateTime,
		@dFecha_Real_Entrega DateTime,
		@sComentario nvarchar(512),
		@sCo_Art char(30),
		@sArt_Des char(120),
		@sCo_Uni char(6),
		--@deTotal_Art decimal(18,5),
		@iRENG_NUMOri int,
		@iRENG_NUM int,
		@sREVISADO char(1),
		@sTRASNFE char(1),
		@sco_sucu_mo char(6),
		@sco_us_mo char(6),
		@growguid UNIQUEIDENTIFIER,
		@sMaquina VARCHAR(60),
		@sCampos VARCHAR(MAX),
		@sEstatus CHAR(1) = '0'
    )
AS 
    BEGIN
        DECLARE @TableTimestamp TABLE
            (
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )

        UPDATE
            saPlantillaCompraReqRenglon
        SET 
			satisface = @bSatisface, fecha_requerida = @dFecha_Requerida, fecha_real_entrega = @dFecha_Real_Entrega,
			comentario = @sComentario, estatus = @sEstatus,
			revisado = @sREVISADO, TRASNFE = @sTRASNFE, co_sucu_mo = @sco_sucu_mo
        OUTPUT
            inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
            INTO @TableTimestamp
        WHERE
            rowguid_plantilla_renglon = @gRowguid_Plantilla_Renglon 

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
                    @sTablaOri = 'saPlantillaCompraReng', @rowguidOri = @rowGuidOri, @sTipo_Op = 'M',
                    @sMaquina = @sMaquina, @sCampos = @sCampos
            END

        SELECT
            *
        FROM
            @TableTimestamp
    END
```
