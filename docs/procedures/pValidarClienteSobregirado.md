# SP: pValidarClienteSobregirado
**Tipo**: Validar
**Módulo**: Clientes

## Tablas Referenciadas
- [`saCliente`](../tables/saCliente.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saTipoDocumento`](../tables/saTipoDocumento.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: [pObtenerFacturasVencidasCliente]
DESCRIPCION: Se encarga de verificar si el cliente posee o no facturas vencidas a una fecha 
CREADO POR: SOFTECH SISTEMAS
CREAD EL: 23/07/2010
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pValidarClienteSobregirado]
    (
      @sCodigo CHAR(16) ,
      @deMontoExt DECIMAL(18, 2)
    )
AS 
    BEGIN                  
        DECLARE @deSaldo DECIMAL(18, 2)
        DECLARE @deSaldoFinal DECIMAL(18, 2)
        DECLARE @deSaldo_Neg DECIMAL(18, 2)
        DECLARE @deSaldoLimite DECIMAL(18, 2)
        DECLARE @deValor DECIMAL(18, 2) 
        DECLARE @bEsValido BIT
       

        SELECT
            @deSaldoLimite = mont_cre
        FROM
            saCliente
        WHERE
            co_cli = @sCodigo 

        IF ( @deSaldoLimite <> 0 ) 
            BEGIN
                SELECT
                    @deSaldo = ISNULL(SUM(dv.saldo), 0)
                FROM
                    saDocumentoVenta dv
                    INNER JOIN saTipoDocumento td ON dv.co_tipo_doc = td.co_tipo_doc
                WHERE
					dv.anulado = 0
                    AND dv.co_cli = @sCodigo
                    AND td.tipo_mov = 'DE'      
                                                         
                                                         
                SELECT
                    @deSaldo_Neg = ISNULL(SUM(dv.saldo), 0)
                FROM
                    saDocumentoVenta dv
                    INNER JOIN saTipoDocumento td ON dv.co_tipo_doc = td.co_tipo_doc
                WHERE
                    dv.anulado = 0
                    AND dv.co_cli = @sCodigo
                    AND td.tipo_mov = 'CR'               
              
                SET @deSaldoFinal = @deSaldo - @deSaldo_Neg + @deMontoExt
              
       
                IF ( @deSaldoFinal > @deSaldoLimite ) 
                    SET @bEsValido = 1
                ELSE 
                    SET @bEsValido = 0
                     
            END 
        ELSE 
            SET @bEsValido = 0
       
        SELECT
            @bEsValido AS esValido       
       
    END
```
