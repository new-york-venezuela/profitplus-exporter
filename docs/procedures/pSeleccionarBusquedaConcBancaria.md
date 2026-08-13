# SP: pSeleccionarBusquedaConcBancaria
**Tipo**: Seleccionar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saConcBanco`](../tables/saConcBanco.md)
- [`saConciliacionDetalle`](../tables/saConciliacionDetalle.md)
- [`saMovimientoBanco`](../tables/saMovimientoBanco.md)

## Código (excerpt)
```sql
/*************************************************************************************************
*NOMBRE			:	pSeleccionarBusquedaConcBancaria
*DESCRIPCION	:	Selecciona todos los registros de la tabla  saConciliacionDetalle
*CREADO			:	SOFTECH SISTEMAS
**************************************************************************************************/
CREATE PROCEDURE [pSeleccionarBusquedaConcBancaria] ( @sCod_Cta CHAR(6) )
AS 
    BEGIN

        SELECT mb.mov_num, mb.tipo_op, mb.doc_num, mb.fecha, mb.monto_d, mb.monto_d as monto, cd.doc_num as Doc_Num_EdoCuenta
        FROM
            saConciliacionDetalle AS cd
            INNER JOIN saConcBanco AS cb    ON cd.reng_num = cb.reng_num AND cd.co_auto_con = cb.co_auto_con
            INNER JOIN saMovimientoBanco mb ON cb.mov_num = mb.mov_num
        WHERE
            mb.cod_cta = @sCod_Cta

    END
```
