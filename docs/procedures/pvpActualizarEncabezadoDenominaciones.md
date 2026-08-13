# SP: pvpActualizarEncabezadoDenominaciones
**Tipo**: Punto de Venta
**Módulo**: Punto de Venta

## Tablas Referenciadas
- [`pvValeAlimentacion`](../tables/pvValeAlimentacion.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: pvpActualizarEncabezadoDenominaciones
*DESCRIPCIÓN	: Actualiza el Encabezado del Renglon para Indicar que cambio
*AUTOR			: SOFTECH SISTEMAS
**************************************************************************/ 

CREATE PROCEDURE [dbo].[pvpActualizarEncabezadoDenominaciones]
    (
      @sCo_Vale CHAR(6) ,
      @sCo_Us_Mo CHAR(6)= NULL ,
      @sCo_Sucu_Mo CHAR(6) = NULL,
      @sMaquina VARCHAR(60)= NULL ,
      @tsValidador TIMESTAMP ,
      @gRowguid UNIQUEIDENTIFIER = NULL 			
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
        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER
			
        UPDATE
            pvValeAlimentacion
        SET fe_us_mo = GETDATE(), co_us_mo = @sCo_Us_Mo
        OUTPUT
			inserted.validador, 
            inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
            INTO @TableTimestamp
        WHERE
            Co_Vale = @sCo_Vale

        SELECT
            @dtFe_In = fe_us_mo, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

        EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_Mo,
            @sTablaOri = 'pvValeAlimentacion', @rowguidOri = @rowGuidOri, @sTipo_Op = 'M', @sMaquina = @sMaquina

        SELECT
            *
        FROM
            @TableTimestamp

    END
```
