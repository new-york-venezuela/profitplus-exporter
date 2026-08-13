# SP: pActualizarPlantillaCompraReqRelacion
**Tipo**: Actualizar
**Módulo**: General

## Tablas Referenciadas
- [`saPlantillaCompraReqRelacion`](../tables/saPlantillaCompraReqRelacion.md)
- [`saPlantillaCompraReqRenglon`](../tables/saPlantillaCompraReqRenglon.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			:	pActualizarPlantillaCompraReqRelacion
*DESCRIPCIÓN	:	Actualiza una Plantilla de compra
*AUTOR			:	Softech
**************************************************************************/

CREATE PROCEDURE [dbo].[pActualizarPlantillaCompraReqRelacion]
    (
	    @gRowguid_Reng_Req UNIQUEIDENTIFIER,
		@tsvalidador TIMESTAMP,
		@sEstatus char(2),
		@sCampo1 char(60) = NULL,
		@sCampo2 char(60) = NULL,
		@sCampo3 char(60) = NULL,
		@sCampo4 char(60) = NULL,
		@sCampo5 char(60) = NULL,
		@sCampo6 char(60) = NULL,
		@sCampo7 char(60) = NULL,
		@sCampo8 char(60) = NULL,
		@sRevisado char(1),
		@sTrasnfe char(1),
		@sco_sucu_mo CHAR(6) ,
		@sco_us_mo CHAR(6),
		@growguid UNIQUEIDENTIFIER,
		@sMaquina VARCHAR(60) = NULL,
		@sCampos  VARCHAR(MAX) = NULL
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

        UPDATE
            saPlantillaCompraReqRenglon
        SET 
			estatus = @sEstatus,
            co_us_mo = @sCo_Us_Mo, co_sucu_mo = @sCo_Sucu_Mo,
            fe_us_mo = GETDATE(), revisado = @sRevisado, trasnfe = @sTrasnfe
        OUTPUT
            inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
            INTO @TableTimestamp
        WHERE
            rowguid = @gRowguid_Reng_Req
            AND validador = @tsValidador	

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
                    @sTablaOri = 'saPlantillaCompraReqRelacion', @rowguidOri = @rowGuidOri, @sTipo_Op = 'M', @sMaquina = @sMaquina,
                    @sCampos = @sCampos
            END

        SELECT
            *
        FROM
            @TableTimestamp
    END
```
