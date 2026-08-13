# SP: pActualizarContabilizacionMovimientoCaja
**Tipo**: Actualizar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saMovimientoCaja`](../tables/saMovimientoCaja.md)

## Código (excerpt)
```sql
/*************************************************************************************************
NOMBRE:	pActualizarContabilizacionMovimientoCaja
DESCRIPCION: Marcar como contabilizado el movimiento de caja
CREADO POR: SOFTECH SISTEMAS
CREADO EL: 23/04/2010
**************************************************************************************************/
CREATE PROCEDURE [pActualizarContabilizacionMovimientoCaja]
    (
      @sCo_Doc CHAR(20) ,
      @sFechaCom SMALLDATETIME ,
      @iNumCom INT ,
      @sCo_Us_Mo CHAR(6) ,
      @sCo_Sucu_Mo CHAR(6) ,
      @sMaquina VARCHAR(60)
    )
AS 
    BEGIN
	
        DECLARE @TableTimestamp TABLE
            (
              campo VARCHAR(MAX) ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )

        UPDATE
            saMovimientoCaja
        SET feccom = @sFechaCom, numcom = @iNumCom, fe_us_mo = GETDATE(), co_sucu_mo = @sCo_Sucu_Mo,
            co_us_mo = @sCo_Us_Mo
        OUTPUT
            '[Feccom]=' + CONVERT(NVARCHAR(100), Deleted.feccom, 121) + '->'
            + CONVERT(NVARCHAR(100), ISNULL(Inserted.feccom, 0), 121) + '|[Numcom]='
            + CAST(ISNULL(Deleted.numcom, 0) AS VARCHAR) + '->' + CAST(Inserted.numcom AS VARCHAR), Inserted.fe_us_mo,
            Inserted.rowguid
            INTO 
			@TableTimestamp
        WHERE
            mov_num = @sCo_Doc
		
	
        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER
        DECLARE @campo VARCHAR(MAX)

        SELECT
            @campo = campo, @dtFe_In = fe_us_mo, @rowGuidOri = rowguid
        FROM
            @TableTimestamp
			
	-- Insertar Pista
        EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_Mo,
            @sTablaOri = 'saMovimientoCaja', @rowguidOri = @rowGuidOri, @sTipo_Op = 'M', @sMaquina = @sMaquina,
            @sCampos = @campo
	
    END
```
