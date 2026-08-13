# SP: pSeleccionarInfoSerialesS
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saAjusteReng`](../tables/saAjusteReng.md)
- [`saFacturaVentaReng`](../tables/saFacturaVentaReng.md)
- [`saSeriales`](../tables/saSeriales.md)
- [`saTrasladoReng`](../tables/saTrasladoReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE:			[pSeleccionarSerialesEntrada]
DESCRIPCION:	Seleccionar Seriales de entrada
CREADO POR:		SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarInfoSerialesS]
    (
      @gRowGuid UNIQUEIDENTIFIER ,
      @sTipoDoc CHAR(4)
    )
AS 
    BEGIN
        IF ( @sTipoDoc = 'AJUS' ) 
            BEGIN
                SELECT
                    saAjusteReng.ajue_num, saAjusteReng.reng_num
                FROM
                    ( saSeriales
                      INNER JOIN saAjusteReng ON saSeriales.doc_num_s = saAjusteReng.rowguid
                    )
                WHERE
                    saSeriales.RowGuid = @gRowGuid

            END
        ELSE 
            IF ( @sTipoDoc = 'TRAS' ) 
                BEGIN
                    SELECT
                        saTrasladoReng.tras_num, saTrasladoReng.reng_num
                    FROM
                        ( saSeriales
                          INNER JOIN saTrasladoReng ON saSeriales.doc_num_s = saTrasladoReng.rowguid
                        )
                    WHERE
                        saSeriales.RowGuid = @gRowGuid
                END
         ELSE 
            IF ( @sTipoDoc = 'FACT' ) 
                BEGIN
                    SELECT
                        saFacturaVentaReng.doc_num, saFacturaVentaReng.reng_num
                    FROM
                        ( saSeriales
                          INNER JOIN saFacturaVentaReng ON saSeriales.doc_num_s = saFacturaVentaReng.rowguid
                        )
                    WHERE
                        saSeriales.RowGuid = @gRowGuid
                END
    END
```
