# SP: pValidarProveedorSobregiradoAUnaFecha
**Tipo**: Validar
**Módulo**: Compras

## Tablas Referenciadas
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saTipoDocumento`](../tables/saTipoDocumento.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: [pValidarProveedorSobregiradoAUnaFecha]
DESCRIPCION: Se encarga de verificar si el cliente posee o no facturas vencidas a una fecha 
CREADO POR: SOFTECH SISTEMAS
CREAD EL: 23/07/2010
***************************************************************************************************************/
CREATE PROCEDURE [pValidarProveedorSobregiradoAUnaFecha]
    (
      @deFecha SMALLDATETIME ,
      @sCodigo CHAR(16)
    )
AS 
     BEGIN			
        DECLARE @deSaldo DECIMAL(18, 2)
        DECLARE @deSaldoFinal DECIMAL(18, 2)
        DECLARE @deSaldo_Neg DECIMAL(18, 2)


        SELECT
            @deSaldo = ISNULL(SUM(dc.saldo), 0)
        FROM
            saDocumentoCompra dc
            INNER JOIN saTipoDocumento td ON dc.co_tipo_doc = td.co_tipo_doc
        WHERE
			dc.anulado = 0
            AND dc.co_prov = @sCodigo
            AND DATEDIFF(dd, 00, dc.fec_emis) <= @deFecha
            AND td.tipo_mov = 'DE'      
							  
							  
        SELECT
            @deSaldo_Neg = ISNULL(SUM(dc.saldo), 0)
        FROM
            saDocumentoCompra dc
            INNER JOIN saTipoDocumento td ON dc.co_tipo_doc = td.co_tipo_doc
        WHERE
			dc.anulado = 0 
            AND dc.co_prov = @sCodigo
            AND DATEDIFF(dd, 00, dc.fec_emis) <= @deFecha
            AND td.tipo_mov = 'CR'    
	
        SET @deSaldoFinal = @deSaldo - @deSaldo_Neg 
	
        SELECT
            @deSaldoFinal AS saldo
    END
```
