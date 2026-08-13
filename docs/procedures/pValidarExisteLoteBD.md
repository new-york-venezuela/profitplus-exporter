# SP: pValidarExisteLoteBD
**Tipo**: Validar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saAjusteReng`](../tables/saAjusteReng.md)
- [`saDevolucionProveedorReng`](../tables/saDevolucionProveedorReng.md)
- [`saFacturaVentaReng`](../tables/saFacturaVentaReng.md)
- [`saNotaDespachoVentaReng`](../tables/saNotaDespachoVentaReng.md)
- [`saNotaEntregaVentaReng`](../tables/saNotaEntregaVentaReng.md)
- [`saTipoAjuste`](../tables/saTipoAjuste.md)

## Código (excerpt)
```sql
/***************************************************************************************
*NOMBRE: [pValidarExisteLoteBD] 
*DESCRIPCIÓN : valida si existe un lote asociado al documento
*AUTOR: SOFTECH SISTEMAS
****************************************************************************************/

CREATE PROCEDURE [dbo].[pValidarExisteLoteBD]
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
	
        IF @sTipoDoc = 'FACT' --Factura de Venta 
            BEGIN				
                INSERT  INTO @tablaGenerica
                        ( rowguid ,
                          RengNum      
                        )
                        SELECT  R.rowguid ,
                                R.reng_num
                        FROM    saFacturaVentaReng R
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
            
            IF @sTipoDoc = 'DPRO' --Factura de Venta 
            BEGIN				
                INSERT  INTO @tablaGenerica
                        ( rowguid ,
                          RengNum      
                        )
                        SELECT  R.rowguid ,
                                R.reng_num
                        FROM    saDevolucionProveedorReng R
                        WHERE   R.doc_num = @sCodigoDoc
                        ORDER BY R.reng_num
            END
                IF @sTipoDoc = 'NENT' --Factura de Venta 
            BEGIN				
                INSERT  INTO @tablaGenerica
                        ( rowgu
```
