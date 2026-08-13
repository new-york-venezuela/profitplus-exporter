# SP: RepTrasladoEntreAlmacen
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArticulo`](../tables/saArticulo.md)
- [`saSeriales`](../tables/saSeriales.md)
- [`saTraslado`](../tables/saTraslado.md)
- [`saTrasladoReng`](../tables/saTrasladoReng.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <22/04/2010>
-- Description:	<Formato de Traslados entre Almacénes>
-- =============================================
CREATE PROCEDURE [RepTrasladoEntreAlmacen] 
	-- Add the parameters for the stored procedure here
    @sCo_Numero_d CHAR(20) = NULL ,
    @sCo_Numero_h CHAR(20) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;
    -- Insert statements for procedure here


        SELECT
            ( dbo.getseriales(TR.rowguid) ) AS SerialAsoc, AR.co_art, AR.modelo, AR.art_des, T.*, TR.*,
            'Confirmado' = CASE WHEN T.confirma = 1 THEN 'SI'
                                ELSE 'NO'
                           END
        FROM
            saTraslado AS T
            INNER JOIN saTrasladoReng AS TR ON TR.tras_num = T.tras_num
            INNER JOIN saArticulo AS AR ON AR.co_art = TR.co_art
            LEFT JOIN saSeriales AS SE ON SE.doc_num_s = T.rowguid
        WHERE
            ( @sCo_Numero_d IS NULL
              OR T.tras_num >= @sCo_Numero_d
            )
            AND ( @sCo_Numero_h IS NULL
                  OR T.tras_num <= @sCo_Numero_h
                )
            AND ( T.anulado = 0 )
            AND ( @sCo_Sucursal IS NULL
                  OR T.co_sucu_in = @sCo_Sucursal
                )
        ORDER BY
            T.tras_num
    END
```
