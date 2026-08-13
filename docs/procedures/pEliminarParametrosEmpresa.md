# SP: pEliminarParametrosEmpresa
**Tipo**: Eliminar
**Módulo**: General

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			: pEliminarParametrosEmpresa
*DESCRIPCIÓN	: Elimina los parametros de empresa de la tabla par_emp
*AUTOR			: SOFTECH SISTEMAS.
*************************************************************************/

CREATE PROCEDURE [pEliminarParametrosEmpresa]
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
            par_emp
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
                    @sTablaOri = 'par_emp', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E', @sMaquina = @sMaquina,
                    @sCampos = @sCod_EmpOri
            END
    END
```
