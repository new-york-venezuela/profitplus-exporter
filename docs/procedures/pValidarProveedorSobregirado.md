# SP: pValidarProveedorSobregirado
**Tipo**: Validar
**Módulo**: Compras

## Tablas Referenciadas
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saProveedor`](../tables/saProveedor.md)
- [`saTipoDocumento`](../tables/saTipoDocumento.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: [pObtenerFacturasVencidasProveedor]
DESCRIPCION: Se encarga de verificar si el cliente posee o no facturas vencidas a una fecha 
CREADO POR: SOFTECH SISTEMAS
CREAD EL: 28/02/2011
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pValidarProveedorSobregirado]
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
            saProveedor
        WHERE
            co_prov = @sCodigo 

        IF ( @deSaldoLimite <> 0 ) 
            BEGIN
                SELECT
                    @deSaldo = ISNULL(SUM(DC.saldo), 0)
                FROM
                    saDocumentoCompra DC
                    INNER JOIN saTipoDocumento td ON DC.co_tipo_doc = td.co_tipo_doc
                WHERE
                    DC.anulado = 0
                    AND DC.co_Prov = @sCodigo
                    AND td.tipo_mov = 'DE'      
								  
								  
                SELECT
                    @deSaldo_Neg = ISNULL(SUM(DC.saldo), 0)
                FROM
                    saDocumentoCompra DC
                    INNER JOIN saTipoDocumento td ON DC.co_tipo_doc = td.co_tipo_doc
                WHERE
                    DC.anulado = 0
                    AND DC.co_prov = @sCodigo
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
