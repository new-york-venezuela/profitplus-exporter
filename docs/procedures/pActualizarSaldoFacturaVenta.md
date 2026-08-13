# SP: pActualizarSaldoFacturaVenta
**Tipo**: Actualizar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saFacturaVenta`](../tables/saFacturaVenta.md)

## Código (excerpt)
```sql
/*********************************************************************
*NOMBRE			:	pActualizarSaldoFacturaVenta
*DESCRIPCIÓN	:	Actualizar el Saldo de una Factura de Venta
*AUTOR			:	SOFTECH SISTEMAS
*********************************************************************/

CREATE PROCEDURE [pActualizarSaldoFacturaVenta]
    (
      @sNro_Doc CHAR(20) ,
      @deSaldo DECIMAL(18, 2) ,
      @sCo_Us_Mo CHAR(6) ,
      @sCo_Sucu_Mo CHAR(6) ,
      @sRevisado CHAR(1) = NULL ,
      @sTrasnfe CHAR(1) = NULL ,
      @sMaquina VARCHAR(60) = NULL
    )
AS 
    BEGIN
	
        DECLARE @TableTimestamp TABLE
            (
              validador VARBINARY(MAX) ,
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER ,
              campo VARCHAR(MAX)
            )		
		
        DECLARE @campo VARCHAR(MAX)
		
        UPDATE
            saFacturaVenta
        SET saldo = @deSaldo, co_us_mo = @sCo_Us_Mo, co_sucu_mo = @sCo_Sucu_Mo, fe_us_mo = GETDATE(),
            revisado = @sRevisado, trasnfe = @sTrasnfe
        OUTPUT
            Inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid,
            '[saldo]=' + CAST(Deleted.saldo AS VARCHAR) + '->' + CAST(ISNULL(Inserted.saldo, 0) AS VARCHAR)
            INTO @TableTimestamp
        WHERE
            doc_num = @sNro_Doc
            AND saldo <> @deSaldo
			
        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = GETDATE(), @rowGuidOri = rowguid, @campo = campo
        FROM
            @TableTimestamp

	-- Insertar Pista
        EXEC pInsertarPista @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_Mo,
            @sTablaOri = 'saFacturaVenta', @rowguidOri = @rowGuidOri, @sTipo_Op = 'M', @sMaquina = @sMaquina,
            @sCampos = @campo
			
    END
```
