# SP: pvpEliminarParametrosPuntoDeVenta
**Tipo**: Punto de Venta
**Módulo**: Punto de Venta

## Tablas Referenciadas
- [`pvParEmp`](../tables/pvParEmp.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			: pvpEliminarParametrosPuntoDeVenta
*DESCRIPCIÓN	: Elimina los parametros de Punto de Venta de la tabla pvParEmp
*AUTOR			: SOFTECH SISTEMAS.
*************************************************************************/ 
 
CREATE PROCEDURE [dbo].[pvpEliminarParametrosPuntoDeVenta]
    (
      @sCod_EmpOri CHAR(20) ,
      @tsValidador TIMESTAMP ,
      @sMaquina VARCHAR(60) = NULL ,
      @sCo_Us_Mo CHAR(6) = NULL ,
      @sCo_Sucu_Mo CHAR(6) = NULL ,
      @gRowguid UNIQUEIDENTIFIER = NULL
    )
AS 
    BEGIN

        DECLARE @TableTimestamp TABLE
            (
              rowguid UNIQUEIDENTIFIER
            )

        DELETE FROM
            pvParEmp
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            cod_emp = @sCod_EmpOri
            AND validador = @tsValidador		


        DECLARE @dtFe_De DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_De = GETDATE(), @rowGuidOri = rowguid
        FROM
            @TableTimestamp

        IF @dtFe_De IS NOT NULL 
            BEGIN
			-- Insertar Pista
                EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_De, @sCo_Sucu = @sCo_Sucu_Mo,
                    @sTablaOri = 'pvParEmp', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E', @sMaquina = @sMaquina,
                    @sCampos = @sCod_EmpOri
            END
    END
```
