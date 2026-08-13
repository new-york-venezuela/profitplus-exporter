# SP: pValidarExisteLoteEntradaBD
**Tipo**: Validar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saAjusteReng`](../tables/saAjusteReng.md)
- [`saDevolucionClienteReng`](../tables/saDevolucionClienteReng.md)
- [`saFacturaCompraReng`](../tables/saFacturaCompraReng.md)
- [`saNotaRecepcionCompraReng`](../tables/saNotaRecepcionCompraReng.md)
- [`saTipoAjuste`](../tables/saTipoAjuste.md)

## Código (excerpt)
```sql
/***************************************************************************************
*NOMBRE: [pValidarExisteLoteEntradaBD]  
*DESCRIPCIÓN : valida si existe un lote asociado al documento
*AUTOR: SOFTECH SISTEMAS
****************************************************************************************/

CREATE PROCEDURE [pValidarExisteLoteEntradaBD]
    (
      @sCodigoDoc CHAR(20) ,
      @sTipoDoc CHAR(4)
    )
AS 
    BEGIN
        SET NOCOUNT OFF
        DECLARE @Id AS UNIQUEIDENTIFIER
        DECLARE @RengNUm INT
        
        DECLARE @tablaGenerica TABLE
            (
              rowguid UNIQUEIDENTIFIER ,
              RengNum INT
            )
	
        IF @sTipoDoc = 'COMP' --Factura de Venta 
            BEGIN				
                INSERT  INTO @tablaGenerica
                        ( rowguid ,
                          RengNum      
                        )
                        SELECT  R.rowguid ,
                                R.reng_num
                        FROM    saFacturaCompraReng R
                        WHERE   R.doc_num = @sCodigoDoc
                        ORDER BY R.reng_num
            END
                      
           IF @sTipoDoc = 'AJUS' --Factura de Venta 
            BEGIN				
                INSERT  INTO @tablaGenerica
                        ( rowguid ,
                          RengNum      
                        )
                        SELECT  R.rowguid ,
                                R.reng_num
                                FROM    saAjusteReng R
                                INNER JOIN saTipoAjuste t ON ( R.co_tipo = t.co_tipo )
                        WHERE   R.ajue_num = @sCodigoDoc
                               and t.tipo_trans='0'
                        ORDER BY R.reng_num
            END
            
            IF @sTipoDoc = 'DCLI' --Factura de Venta 
            BEGIN				
                INSERT  INTO @tablaGenerica
                        ( rowguid ,
                          RengNum      
                        )
                        SELECT  R.rowguid ,
                                R.reng_num
                        FROM    saDevolucionClienteReng R
                        WHERE   R.doc_num = @sCodigoDoc
                        ORDER BY R.reng_num
            END
                IF @sTipoDoc = 'NREC' --Factura de Venta 
            BEGIN				
                INSERT  INTO @tablaGenerica
                        ( r
```
