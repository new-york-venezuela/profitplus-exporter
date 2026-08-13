# SP: pActualizarContabilizacionGiroVenta
**Tipo**: Actualizar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)

## Código (excerpt)
```sql
/*************************************************************************************************
NOMBRE:	pActualizarContabilizacionGiroVenta
DESCRIPCION:Actualizar las contabilizaciones de Giro en Venta
CREADO POR: SOFTECH SISTEMAS
CREADO EL: 20/04/2011
**************************************************************************************************/
CREATE PROCEDURE [pActualizarContabilizacionGiroVenta]
    (
      @sCo_Doc CHAR(20) ,
      @sCo_Tipo_Doc CHAR (6),
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
            saDocumentoVenta
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
            (RTRIM(co_tipo_doc) = @sCo_Tipo_Doc)
            AND (RTRIM(nro_doc) = @sCo_Doc)
		
	
        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER
        DECLARE @campo VARCHAR(MAX)

        SELECT
            @campo = campo, @dtFe_In = fe_us_mo, @rowGuidOri = rowguid
        FROM
            @TableTimestamp
			
	-- Insertar Pista
        EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_Mo,
            @sTablaOri = 'saDocumentoVenta', @rowguidOri = @rowGuidOri, @sTipo_Op = 'M', @sMaquina = @sMaquina,
            @sCampos = @campo
	
    END
```
