# SP: pActualizarContabilizacionAjuste
**Tipo**: Actualizar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saAjuste`](../tables/saAjuste.md)

## Código (excerpt)
```sql
/*************************************************************************************************
NOMBRE:	[pActualizarContabilizacionAjuste]
DESCRIPCION: Marcar como contabilizado el ajuste de entrada/salida
CREADO POR: SOFTECH SISTEMAS
CREADO EL: 05/05/2010
**************************************************************************************************/
CREATE PROCEDURE [pActualizarContabilizacionAjuste]
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
            saAjuste
        SET feccom = @sFechaCom, numcom = @iNumCom, fe_us_mo = GETDATE(), co_sucu_mo = @sCo_Sucu_Mo,
            co_us_mo = @sCo_Us_Mo
        OUTPUT
            '[Feccom]=' + CONVERT(NVARCHAR(100), ISNULL(Deleted.feccom, 0), 121) + '->'
            + CONVERT(NVARCHAR(100), Inserted.feccom, 121) + '|[Numcom]=' + CAST(ISNULL(Deleted.numcom, 0) AS VARCHAR)
            + '->' + CAST(Inserted.numcom AS VARCHAR), Inserted.fe_us_mo, Inserted.rowguid
            INTO 
			@TableTimestamp
        WHERE
            ajue_num = @sCo_Doc
		
	
        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER
        DECLARE @campo VARCHAR(MAX)

        SELECT
            @campo = campo, @dtFe_In = fe_us_mo, @rowGuidOri = rowguid
        FROM
            @TableTimestamp
			
	-- Insertar Pista
        EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_Mo,
            @sTablaOri = 'saAjuste', @rowguidOri = @rowGuidOri, @sTipo_Op = 'M', @sMaquina = @sMaquina,
            @sCampos = @campo
	
    END
```
